'use client'
// ─────────────────────────────────────────────────────────
// Éditeur Feuille de route — /projets/[id]/planning/[representationId]/feuille-de-route
// Vue régisseur : déroulé, transport, contacts + publication
// doc/11 §11.2, §11.3, §11.5, §11.6, §11.9.3
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────
type PhaseType =
  | 'DECHARGEMENT' | 'MONTAGE' | 'BALANCES' | 'CATERING' | 'ECHAUFFEMENT'
  | 'REPRESENTATION' | 'ENTRACTE' | 'DEMONTAGE' | 'PAUSE' | 'AUTRE'

type ContactType = 'VENUE' | 'CATERING' | 'SECURITE' | 'HOTEL' | 'URGENCE' | 'AUTRE'

type Phase = {
  id: string; ordre: number; type: PhaseType; labelCustom: string | null
  startTime: string; endTime: string | null; lieu: string | null; notes: string | null
}
type Contact = {
  id: string; nom: string; role: string; type: ContactType
  telephone: string | null; email: string | null; notes: string | null
}
type Affectation = {
  id: string; startTime: string; endTime: string
  confirmationStatus: string; contractTypeUsed: string
  collaborateur: { id: string; nom: string; avatarUrl: string | null }
  poste: string
  equipe: { id: string; name: string; icon: string | null }
}
type FDR = {
  id: string; statut: 'BROUILLON' | 'PUBLIEE' | 'ARCHIVEE'
  notesGenerales: string | null; transportInfo: string | null; publishedAt: string | null
  phases: Phase[]; contacts: Contact[]
}
type Representation = {
  id: string; date: string; showStartTime: string | null; showEndTime: string | null
  venueName: string | null; venueCity: string | null; venueAddress: string | null
}
type Projet = { id: string; title: string; colorCode: string }

// ── Constantes d'affichage ─────────────────────────────────
const PHASE_ICONS: Record<PhaseType, string> = {
  DECHARGEMENT: '📦', MONTAGE: '🔧', BALANCES: '🎛️', CATERING: '🍽️',
  ECHAUFFEMENT: '🎭', REPRESENTATION: '🎭', ENTRACTE: '⏸️',
  DEMONTAGE: '📦', PAUSE: '☕', AUTRE: '📋',
}
const PHASE_LABELS: Record<PhaseType, string> = {
  DECHARGEMENT: 'Déchargement', MONTAGE: 'Montage', BALANCES: 'Balances / Repet tech',
  CATERING: 'Catering', ECHAUFFEMENT: 'Échauffement', REPRESENTATION: 'Représentation',
  ENTRACTE: 'Entracte', DEMONTAGE: 'Démontage', PAUSE: 'Pause', AUTRE: 'Autre',
}
const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  VENUE: 'Salle', CATERING: 'Catering', SECURITE: 'Sécurité',
  HOTEL: 'Hôtel', URGENCE: 'Urgence', AUTRE: 'Autre',
}
const CONFIRMATION_COLORS: Record<string, string> = {
  CONFIRMEE: 'bg-green-100 text-green-700',
  EN_ATTENTE: 'bg-orange-100 text-orange-700',
  REFUSEE: 'bg-red-100 text-red-700',
  NON_REQUISE: 'bg-gray-100 text-gray-500',
}
const STATUT_CONFIG = {
  BROUILLON: { label: 'Brouillon', dot: 'bg-red-400',    badge: 'bg-red-50 text-red-700 border-red-200' },
  PUBLIEE:   { label: 'Publiée',   dot: 'bg-green-400',  badge: 'bg-green-50 text-green-700 border-green-200' },
  ARCHIVEE:  { label: 'Archivée',  dot: 'bg-gray-400',   badge: 'bg-gray-50 text-gray-600 border-gray-200' },
}

const PHASE_TYPES = Object.keys(PHASE_LABELS) as PhaseType[]
const CONTACT_TYPES = Object.keys(CONTACT_TYPE_LABELS) as ContactType[]

// ── Helpers ────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function formatTime(t: string) { return t.replace(':', 'h') }

// ── Page principale ────────────────────────────────────────
export default function FeuilleDeRoutePage({
  params,
}: {
  params: { id: string; representationId: string }
}) {
  const { id: projetId, representationId } = params

  const [loading, setLoading] = useState(true)
  const [fdr, setFdr] = useState<FDR | null>(null)
  const [representation, setRepresentation] = useState<Representation | null>(null)
  const [projet, setProjet] = useState<Projet | null>(null)
  const [affectations, setAffectations] = useState<Affectation[]>([])

  // Modals
  const [phaseModal, setPhaseModal] = useState<'add' | Phase | null>(null)
  const [contactModal, setContactModal] = useState<'add' | Contact | null>(null)
  const [confirmPublier, setConfirmPublier] = useState(false)
  const [copierModal, setCopierModal] = useState(false)
  const [fdrsSources, setFdrsSources] = useState<FdrSource[]>([])
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Sauvegarde auto (transport + notes générales)
  const [transportDraft, setTransportDraft] = useState('')
  const [notesDraft, setNotesDraft] = useState('')
  const [savingAuto, setSavingAuto] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projets/${projetId}/representations/${representationId}/feuille-de-route`)
      if (!res.ok) { setError('Impossible de charger la feuille de route'); return }
      const data = await res.json()
      setFdr(data.fdr)
      setRepresentation(data.representation)
      setProjet(data.projet)
      setAffectations(data.affectations)
      setTransportDraft(data.fdr.transportInfo ?? '')
      setNotesDraft(data.fdr.notesGenerales ?? '')
    } finally {
      setLoading(false)
    }
  }, [projetId, representationId])

  useEffect(() => { load() }, [load])

  // ── Sauvegarder transport + notes (debounce 1s) ────────────
  useEffect(() => {
    if (!fdr) return
    const timeout = setTimeout(async () => {
      if (transportDraft === (fdr.transportInfo ?? '') && notesDraft === (fdr.notesGenerales ?? '')) return
      setSavingAuto(true)
      await fetch(`/api/feuille-de-route/${fdr.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transportInfo: transportDraft || null, notesGenerales: notesDraft || null }),
      })
      setFdr((prev) => prev ? { ...prev, transportInfo: transportDraft || null, notesGenerales: notesDraft || null } : prev)
      setSavingAuto(false)
    }, 1000)
    return () => clearTimeout(timeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transportDraft, notesDraft])

  // ── Publier ────────────────────────────────────────────────
  async function handlePublier() {
    if (!fdr) return
    setSaving(true)
    const res = await fetch(`/api/feuille-de-route/${fdr.id}/publier`, { method: 'POST' })
    setSaving(false)
    setConfirmPublier(false)
    if (res.ok) {
      const data = await res.json()
      setFdr((prev) => prev ? { ...prev, statut: data.statut, publishedAt: data.publishedAt } : prev)
      showToast('✅ Feuille de route publiée — tous les collaborateurs ont été notifiés.')
    }
  }

  // ── Charger les sources pour "Copier depuis" ───────────────
  async function openCopierModal() {
    const res = await fetch(`/api/projets/${projetId}/fdr-sources`)
    if (res.ok) {
      const data = await res.json()
      // Exclure la représentation courante
      const sources = (data as FdrSource[]).filter((s) => s.id !== representationId)
      setFdrsSources(sources)
    }
    setCopierModal(true)
  }

  async function handleCopier() {
    if (!fdr || !selectedSource) return
    setSaving(true)
    const res = await fetch(`/api/feuille-de-route/${fdr.id}/copier-depuis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceFeuilleDeRouteId: selectedSource }),
    })
    setSaving(false)
    if (res.ok) {
      const data = await res.json()
      setFdr((prev) => prev ? { ...prev, ...data } : data)
      setTransportDraft(data.transportInfo ?? '')
      setNotesDraft(data.notesGenerales ?? '')
      setCopierModal(false)
      setSelectedSource(null)
      showToast('📋 Feuille de route copiée. Vérifiez les horaires avant publication.')
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (error || !fdr || !representation || !projet) return (
    <div className="p-6 text-red-600">{error ?? 'Feuille de route introuvable'}</div>
  )

  const statut = STATUT_CONFIG[fdr.statut]
  const estPubliable = fdr.statut !== 'ARCHIVEE'

  // Grouper affectations par équipe
  const equipeMap = new Map<string, { name: string; icon: string | null; membres: Affectation[] }>()
  for (const a of affectations) {
    if (!equipeMap.has(a.equipe.id)) {
      equipeMap.set(a.equipe.id, { name: a.equipe.name, icon: a.equipe.icon, membres: [] })
    }
    equipeMap.get(a.equipe.id)!.membres.push(a)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Toast ──────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg max-w-sm">
          {toast}
        </div>
      )}

      {/* ── En-tête ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href={`/projets/${projetId}`} className="hover:text-gray-700">
              {projet.title}
            </Link>
            <span>›</span>
            <Link href={`/projets/${projetId}?onglet=representations`} className="hover:text-gray-700">
              Représentations
            </Link>
            <span>›</span>
            <span className="text-gray-900 font-medium">Feuille de route</span>
          </div>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                🗺️ Feuille de route — {projet.title}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5 capitalize">
                {formatDate(representation.date)}
                {representation.venueName && ` · ${representation.venueName}`}
                {representation.venueCity && `, ${representation.venueCity}`}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Badge statut */}
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${statut.badge}`}>
                <span className={`w-2 h-2 rounded-full ${statut.dot}`} />
                {statut.label}
                {fdr.publishedAt && fdr.statut === 'PUBLIEE' && (
                  <span className="text-xs opacity-70 ml-1">
                    · {new Date(fdr.publishedAt).toLocaleDateString('fr-FR')}
                  </span>
                )}
              </span>

              {/* Copier depuis */}
              <button
                onClick={openCopierModal}
                className="text-sm border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-800 transition-colors"
              >
                📋 Copier depuis…
              </button>

              {/* Publier */}
              {estPubliable && (
                <button
                  onClick={() => setConfirmPublier(true)}
                  disabled={saving}
                  className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
                    fdr.statut === 'PUBLIEE'
                      ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {fdr.statut === 'PUBLIEE' ? '🔄 Mettre à jour' : '📤 Publier aux équipes'}
                </button>
              )}

              {savingAuto && (
                <span className="text-xs text-gray-400">Sauvegarde…</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Corps ───────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Colonne gauche (2/3) ─────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Déroulé de la journée */}
          <Section title="Déroulé de la journée" action={
            <button
              onClick={() => setPhaseModal('add')}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              + Ajouter une phase
            </button>
          }>
            {fdr.phases.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                Aucune phase ajoutée — commencez par ajouter le déchargement ou la représentation.
              </p>
            ) : (
              <div className="space-y-2">
                {fdr.phases.map((phase) => (
                  <PhaseRow
                    key={phase.id}
                    phase={phase}
                    onEdit={() => setPhaseModal(phase)}
                    onDelete={async () => {
                      await fetch(`/api/feuille-de-route/${fdr.id}/phases/${phase.id}`, { method: 'DELETE' })
                      setFdr((prev) => prev ? { ...prev, phases: prev.phases.filter((p) => p.id !== phase.id) } : prev)
                    }}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Transport */}
          <Section title="Transport">
            <textarea
              value={transportDraft}
              onChange={(e) => setTransportDraft(e.target.value)}
              rows={4}
              placeholder="Van départ Gare du Nord à 09h45 — contact Marc 06 12 34 56&#10;Retour départ 16h30 depuis le théâtre"
              className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Champ texte libre · Pour la gestion de flotte structurée, voir le Module Tournée.
            </p>
          </Section>

          {/* Notes générales */}
          <Section title="Notes générales">
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={3}
              placeholder="Informations visibles de toute l'équipe…"
              className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </Section>

          {/* Contacts locaux */}
          <Section title="Contacts locaux" action={
            <button
              onClick={() => setContactModal('add')}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              + Ajouter un contact
            </button>
          }>
            {fdr.contacts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                Aucun contact ajouté pour cette date.
              </p>
            ) : (
              <div className="divide-y divide-gray-50">
                {fdr.contacts.map((c) => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    onEdit={() => setContactModal(c)}
                    onDelete={async () => {
                      await fetch(`/api/feuille-de-route/${fdr.id}/contacts/${c.id}`, { method: 'DELETE' })
                      setFdr((prev) => prev ? { ...prev, contacts: prev.contacts.filter((x) => x.id !== c.id) } : prev)
                    }}
                  />
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* ── Colonne droite (1/3) — équipe ───────────────── */}
        <div>
          <Section title={`Équipe au complet (${affectations.length})`}>
            {affectations.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Aucune affectation sur cette date.</p>
            ) : (
              <div className="space-y-4">
                {Array.from(equipeMap.entries()).map(([, equipe]) => (
                  <div key={equipe.name}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      {equipe.icon} {equipe.name} ({equipe.membres.length})
                    </p>
                    <div className="space-y-1.5">
                      {equipe.membres.map((a) => (
                        <div key={a.id} className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-600 flex-shrink-0">
                            {a.collaborateur.nom.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{a.collaborateur.nom}</p>
                            <p className="text-xs text-gray-500">{a.poste} · {formatTime(a.startTime)}→{formatTime(a.endTime)}</p>
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${CONFIRMATION_COLORS[a.confirmationStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                            {a.confirmationStatus === 'CONFIRMEE' ? '🔵' :
                             a.confirmationStatus === 'EN_ATTENTE' ? '🟠' :
                             a.confirmationStatus === 'REFUSEE' ? '🔴' : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────── */}

      {/* Confirmation publication */}
      {confirmPublier && (
        <Modal title={fdr.statut === 'PUBLIEE' ? 'Mettre à jour la feuille de route' : 'Publier aux équipes'} onClose={() => setConfirmPublier(false)}>
          <p className="text-sm text-gray-600 mb-4">
            {fdr.statut === 'PUBLIEE'
              ? 'Les collaborateurs affectés recevront une notification de mise à jour.'
              : `Cette feuille de route sera visible de tous les collaborateurs affectés à cette représentation (${affectations.length} personnes). Continuer ?`}
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmPublier(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
              Annuler
            </button>
            <button onClick={handlePublier} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
              {saving ? 'Publication…' : fdr.statut === 'PUBLIEE' ? 'Mettre à jour' : 'Publier'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal phase */}
      {phaseModal !== null && (
        <PhaseModal
          phase={phaseModal === 'add' ? null : phaseModal}
          onClose={() => setPhaseModal(null)}
          onSave={async (data) => {
            if (phaseModal === 'add') {
              const res = await fetch(`/api/feuille-de-route/${fdr.id}/phases`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
              })
              if (res.ok) {
                const phase = await res.json()
                setFdr((prev) => prev ? { ...prev, phases: [...prev.phases, phase].sort((a, b) => a.ordre - b.ordre) } : prev)
                setPhaseModal(null)
              }
            } else {
              const res = await fetch(`/api/feuille-de-route/${fdr.id}/phases/${phaseModal.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
              })
              if (res.ok) {
                const updated = await res.json()
                setFdr((prev) => prev ? { ...prev, phases: prev.phases.map((p) => p.id === updated.id ? updated : p).sort((a, b) => a.ordre - b.ordre) } : prev)
                setPhaseModal(null)
              }
            }
          }}
        />
      )}

      {/* Modal contact */}
      {contactModal !== null && (
        <ContactModal
          contact={contactModal === 'add' ? null : contactModal}
          onClose={() => setContactModal(null)}
          onSave={async (data) => {
            if (contactModal === 'add') {
              const res = await fetch(`/api/feuille-de-route/${fdr.id}/contacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
              })
              if (res.ok) {
                const contact = await res.json()
                setFdr((prev) => prev ? { ...prev, contacts: [...prev.contacts, contact] } : prev)
                setContactModal(null)
              }
            } else {
              const res = await fetch(`/api/feuille-de-route/${fdr.id}/contacts/${contactModal.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
              })
              if (res.ok) {
                const updated = await res.json()
                setFdr((prev) => prev ? { ...prev, contacts: prev.contacts.map((c) => c.id === updated.id ? updated : c) } : prev)
                setContactModal(null)
              }
            }
          }}
        />
      )}

      {/* Modal copier depuis */}
      {copierModal && (
        <Modal title="Copier depuis une autre date" onClose={() => { setCopierModal(false); setSelectedSource(null) }}>
          {fdrsSources.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              Aucune feuille de route publiée ou archivée disponible sur ce projet.
            </p>
          ) : (
            <div className="space-y-2 mb-4 max-h-72 overflow-y-auto">
              {fdrsSources.map((s) => (
                <label
                  key={s.feuilleDeRoute!.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    selectedSource === s.feuilleDeRoute!.id
                      ? 'border-indigo-400 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="source"
                    value={s.feuilleDeRoute!.id}
                    checked={selectedSource === s.feuilleDeRoute!.id}
                    onChange={() => setSelectedSource(s.feuilleDeRoute!.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      🗺️ {new Date(s.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      {s.venueName && ` · ${s.venueName}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {s.feuilleDeRoute!.phasesCount} phase{s.feuilleDeRoute!.phasesCount > 1 ? 's' : ''}
                      · {s.feuilleDeRoute!.contactsCount} contact{s.feuilleDeRoute!.contactsCount > 1 ? 's' : ''}
                      {s.feuilleDeRoute!.transportInfo ? ' · Transport ✓' : ''}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {fdrsSources.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 mb-4">
              Ce qui sera copié : ✅ Phases · ✅ Transport · ✅ Contacts · ✅ Notes générales<br />
              ❌ Statut (repart en Brouillon) · ❌ Équipe (dépend de la date)
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={() => { setCopierModal(false); setSelectedSource(null) }} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
              Annuler
            </button>
            {fdrsSources.length > 0 && (
              <button
                onClick={handleCopier}
                disabled={!selectedSource || saving}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg"
              >
                {saving ? 'Copie…' : 'Copier cette feuille de route'}
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Sous-composants ────────────────────────────────────────

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function PhaseRow({ phase, onEdit, onDelete }: { phase: Phase; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 group">
      <div className="w-14 text-right flex-shrink-0">
        <span className="text-sm font-semibold text-gray-900">{formatTime(phase.startTime)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">
          {PHASE_ICONS[phase.type]} {phase.labelCustom ?? PHASE_LABELS[phase.type]}
          {phase.endTime && <span className="text-gray-400 font-normal"> → {formatTime(phase.endTime)}</span>}
        </p>
        {phase.lieu && <p className="text-xs text-gray-500 mt-0.5">{phase.lieu}</p>}
        {phase.notes && <p className="text-xs text-gray-400 italic">{phase.notes}</p>}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={onEdit} className="p-1 text-gray-400 hover:text-gray-600">✏️</button>
        <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500">🗑</button>
      </div>
    </div>
  )
}

function ContactRow({ contact, onEdit, onDelete }: { contact: Contact; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 py-3 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{contact.nom}</p>
        <p className="text-xs text-gray-500">{contact.role} · {CONTACT_TYPE_LABELS[contact.type]}</p>
        {contact.telephone && (
          <a href={`tel:${contact.telephone}`} className="text-xs text-indigo-600 hover:underline">
            📞 {contact.telephone}
          </a>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={onEdit} className="p-1 text-gray-400 hover:text-gray-600">✏️</button>
        <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500">🗑</button>
      </div>
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ── Modal Phase ────────────────────────────────────────────
function PhaseModal({ phase, onClose, onSave }: {
  phase: Phase | null
  onClose: () => void
  onSave: (data: Record<string, unknown>) => Promise<void>
}) {
  const [form, setForm] = useState({
    type: (phase?.type ?? 'DECHARGEMENT') as PhaseType,
    labelCustom: phase?.labelCustom ?? '',
    startTime: phase?.startTime ?? '',
    endTime: phase?.endTime ?? '',
    lieu: phase?.lieu ?? '',
    notes: phase?.notes ?? '',
    ordre: phase?.ordre ?? 99,
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave({
      type: form.type,
      labelCustom: form.type === 'AUTRE' ? form.labelCustom || undefined : undefined,
      startTime: form.startTime,
      endTime: form.endTime || undefined,
      lieu: form.lieu || undefined,
      notes: form.notes || undefined,
      ordre: form.ordre,
    })
    setSaving(false)
  }

  return (
    <Modal title={phase ? 'Modifier la phase' : 'Ajouter une phase'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-field">Type <span className="text-red-500">*</span></label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PhaseType })} className="input-field">
              {PHASE_TYPES.map((t) => (
                <option key={t} value={t}>{PHASE_ICONS[t]} {PHASE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Ordre</label>
            <input type="number" min={1} value={form.ordre} onChange={(e) => setForm({ ...form, ordre: Number(e.target.value) })} className="input-field" />
          </div>
        </div>

        {form.type === 'AUTRE' && (
          <div>
            <label className="label-field">Label personnalisé</label>
            <input type="text" value={form.labelCustom} onChange={(e) => setForm({ ...form, labelCustom: e.target.value })} className="input-field" placeholder="Ex: Réunion de production" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-field">Heure de début <span className="text-red-500">*</span></label>
            <input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Heure de fin</label>
            <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="input-field" />
          </div>
        </div>

        <div>
          <label className="label-field">Lieu</label>
          <input type="text" value={form.lieu} onChange={(e) => setForm({ ...form, lieu: e.target.value })} className="input-field" placeholder="Ex: Hall technique — Niveau -1" />
        </div>

        <div>
          <label className="label-field">Notes</label>
          <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field" placeholder="Informations complémentaires…" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">Annuler</button>
          <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
            {saving ? 'Enregistrement…' : phase ? 'Mettre à jour' : 'Ajouter'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Modal Contact ──────────────────────────────────────────
function ContactModal({ contact, onClose, onSave }: {
  contact: Contact | null
  onClose: () => void
  onSave: (data: Record<string, unknown>) => Promise<void>
}) {
  const [form, setForm] = useState({
    nom:       contact?.nom ?? '',
    role:      contact?.role ?? '',
    type:      (contact?.type ?? 'VENUE') as ContactType,
    telephone: contact?.telephone ?? '',
    email:     contact?.email ?? '',
    notes:     contact?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave({
      nom:       form.nom,
      role:      form.role,
      type:      form.type,
      telephone: form.telephone || undefined,
      email:     form.email || undefined,
      notes:     form.notes || undefined,
    })
    setSaving(false)
  }

  return (
    <Modal title={contact ? 'Modifier le contact' : 'Ajouter un contact'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-field">Nom <span className="text-red-500">*</span></label>
            <input required type="text" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="input-field" placeholder="Jean-Pierre Roy" />
          </div>
          <div>
            <label className="label-field">Rôle <span className="text-red-500">*</span></label>
            <input required type="text" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input-field" placeholder="Régisseur général" />
          </div>
        </div>

        <div>
          <label className="label-field">Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ContactType })} className="input-field">
            {CONTACT_TYPES.map((t) => (
              <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-field">Téléphone</label>
            <input type="tel" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} className="input-field" placeholder="06 12 34 56 78" />
          </div>
          <div>
            <label className="label-field">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="contact@theatre.fr" />
          </div>
        </div>

        <div>
          <label className="label-field">Notes</label>
          <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field" placeholder="Disponible de 9h à 18h" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">Annuler</button>
          <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
            {saving ? 'Enregistrement…' : contact ? 'Mettre à jour' : 'Ajouter'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Type FDR source (pour "copier depuis") — correspond à /api/projets/[id]/fdr-sources
type FdrSource = {
  id: string
  date: string
  venueName: string | null
  venueCity: string | null
  feuilleDeRoute: {
    id: string
    statut: 'PUBLIEE' | 'ARCHIVEE'
    transportInfo: string | null
    phasesCount: number
    contactsCount: number
  } | null
}
