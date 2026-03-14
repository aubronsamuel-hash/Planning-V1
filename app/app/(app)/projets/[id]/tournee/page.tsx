'use client'
// ─────────────────────────────────────────────────────────
// Page Tournée — /projets/[id]/tournee
// Hébergements, rooming list, chambres
// doc/19-module-tournee.md §19.1 §19.6 — ENTERPRISE uniquement
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────
type ChambreType = 'INDIVIDUELLE' | 'DOUBLE' | 'DOUBLE_USAGE_SIMPLE' | 'SUITE'

type Occupant = {
  id: string
  collaborateurId: string
  nuitDu: string
  notes: string | null
  collaborateur: { user: { id: string; firstName: string; lastName: string } }
}

type Chambre = {
  id: string
  numero: string | null
  type: ChambreType
  notes: string | null
  occupants: Occupant[]
}

type Hebergement = {
  id: string
  nom: string
  adresse: string | null
  ville: string | null
  telephone: string | null
  email: string | null
  checkIn: string
  checkOut: string
  notes: string | null
  roomingListEnvoyeeAt: string | null
  chambres: Chambre[]
}

type Collaborateur = {
  id: string
  nom: string
}

// ── Constantes ──────────────────────────────────────────────
const CHAMBRE_TYPE_LABELS: Record<ChambreType, string> = {
  INDIVIDUELLE: 'Individuelle',
  DOUBLE: 'Double',
  DOUBLE_USAGE_SIMPLE: 'Double usage simple',
  SUITE: 'Suite',
}

// ── Helpers ─────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** Génère la liste des nuits entre checkIn (incl.) et checkOut (excl.) */
function genererNuits(checkIn: string, checkOut: string): string[] {
  const nuits: string[] = []
  const start = new Date(checkIn)
  const end = new Date(checkOut)
  const cur = new Date(start)
  while (cur < end) {
    nuits.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return nuits
}

// ── Page principale ─────────────────────────────────────────
export default function TourneePage() {
  const { id: projetId } = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projetTitre, setProjetTitre] = useState('')
  const [hebergements, setHebergements] = useState<Hebergement[]>([])
  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>([])

  // Modals
  const [hebergementModal, setHebergementModal] = useState<Hebergement | 'add' | null>(null)
  const [chambreModal, setChambreModal] = useState<{ hebergement: Hebergement; chambre: Chambre | 'add' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projets/${projetId}/hebergements`)
      if (res.status === 403) {
        const data = await res.json()
        setError(data.error ?? 'Accès refusé')
        return
      }
      if (!res.ok) { setError('Impossible de charger les hébergements'); return }
      const data = await res.json()
      setHebergements(data)

      // Charger les collaborateurs (pour l'assignation des chambres)
      const collabRes = await fetch('/api/collaborateurs')
      if (collabRes.ok) {
        const collabs = await collabRes.json()
        setCollaborateurs(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (collabs as any[]).map((c: any) => ({
            id: c.id ?? c.collaborateurId,
            nom: c.nom ?? `${c.user?.firstName ?? ''} ${c.user?.lastName ?? ''}`.trim(),
          })).filter((c: Collaborateur) => c.id)
        )
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [projetId])

  // Charger aussi le titre du projet
  useEffect(() => {
    fetch(`/api/projets/${projetId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.title) setProjetTitre(d.title) })
      .catch(() => {})
  }, [projetId])

  useEffect(() => { load() }, [load])

  // ── CRUD Hébergement ──────────────────────────────────────
  async function saveHebergement(data: Record<string, unknown>, id?: string) {
    setSaving(true)
    try {
      const res = id
        ? await fetch(`/api/hebergements/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
        : await fetch(`/api/projets/${projetId}/hebergements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
      if (res.ok) {
        await load()
        setHebergementModal(null)
        showToast(id ? '✅ Hébergement mis à jour.' : '✅ Hébergement ajouté.')
      } else {
        const err = await res.json()
        showToast(`Erreur : ${err.error ?? 'Impossible de sauvegarder'}`)
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteHebergement(id: string) {
    if (!confirm('Supprimer cet hébergement et toutes ses chambres ?')) return
    const res = await fetch(`/api/hebergements/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setHebergements((prev) => prev.filter((h) => h.id !== id))
      showToast('🗑 Hébergement supprimé.')
    }
  }

  // ── CRUD Chambre ──────────────────────────────────────────
  async function saveChambre(
    hebergementId: string,
    data: Record<string, unknown>,
    chambreId?: string
  ) {
    setSaving(true)
    try {
      const res = chambreId
        ? await fetch(`/api/chambres/${chambreId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
        : await fetch(`/api/hebergements/${hebergementId}/chambres`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
      if (res.ok) {
        await load()
        setChambreModal(null)
        showToast(chambreId ? '✅ Chambre mise à jour.' : '✅ Chambre ajoutée.')
      } else {
        const err = await res.json()
        showToast(`Erreur : ${err.error ?? 'Impossible de sauvegarder'}`)
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteChambre(chambreId: string) {
    if (!confirm('Supprimer cette chambre ?')) return
    const res = await fetch(`/api/chambres/${chambreId}`, { method: 'DELETE' })
    if (res.ok) {
      await load()
      showToast('🗑 Chambre supprimée.')
    }
  }

  // ── Envoyer rooming list ──────────────────────────────────
  async function envoyerRoomingList(hebergementId: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/hebergements/${hebergementId}/envoyer`, { method: 'POST' })
      if (res.ok) {
        await load()
        showToast('📧 Rooming list envoyée à l\'hôtel.')
      } else {
        const err = await res.json()
        showToast(`Erreur : ${err.error ?? 'Impossible d\'envoyer'}`)
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Rendu ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    // ENTERPRISE gate
    if (error.includes('ENTERPRISE') || error.includes('Tournée')) {
      return (
        <div className="p-8 max-w-lg mx-auto text-center">
          <div className="text-5xl mb-4">🚌</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Module Tournée</h2>
          <p className="text-gray-500 mb-6">
            Le module Tournée (hébergements, rooming list, flotte) est réservé au plan <strong>ENTERPRISE</strong>.
          </p>
          <Link
            href="/settings/organisation#facturation"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-6 py-3 rounded-xl"
          >
            Passer au plan ENTERPRISE
          </Link>
        </div>
      )
    }
    return <div className="p-6 text-red-600">{error}</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg max-w-sm">
          {toast}
        </div>
      )}

      {/* En-tête */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href={`/projets/${projetId}`} className="hover:text-gray-700">
              {projetTitre || 'Projet'}
            </Link>
            <span>›</span>
            <span className="text-gray-900 font-medium">Tournée</span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">🚌 Module Tournée</h1>
            <button
              onClick={() => setHebergementModal('add')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              + Ajouter un hôtel
            </button>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {hebergements.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-3">🏨</div>
            <p className="text-lg font-medium text-gray-700 mb-2">Aucun hébergement</p>
            <p className="text-sm text-gray-400 mb-6">
              Ajoutez un hôtel pour commencer à gérer la rooming list.
            </p>
            <button
              onClick={() => setHebergementModal('add')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl"
            >
              + Ajouter un hébergement
            </button>
          </div>
        ) : (
          hebergements.map((h) => (
            <HebergementCard
              key={h.id}
              hebergement={h}
              onEdit={() => setHebergementModal(h)}
              onDelete={() => deleteHebergement(h.id)}
              onAddChambre={() => setChambreModal({ hebergement: h, chambre: 'add' })}
              onEditChambre={(c) => setChambreModal({ hebergement: h, chambre: c })}
              onDeleteChambre={(c) => deleteChambre(c.id)}
              onEnvoyer={() => envoyerRoomingList(h.id)}
              saving={saving}
            />
          ))
        )}
      </div>

      {/* Modal hébergement */}
      {hebergementModal !== null && (
        <HebergementModal
          hebergement={hebergementModal === 'add' ? null : hebergementModal}
          onClose={() => setHebergementModal(null)}
          onSave={(data) => saveHebergement(data, hebergementModal === 'add' ? undefined : hebergementModal.id)}
          saving={saving}
        />
      )}

      {/* Modal chambre */}
      {chambreModal !== null && (
        <ChambreModal
          hebergement={chambreModal.hebergement}
          chambre={chambreModal.chambre === 'add' ? null : chambreModal.chambre}
          collaborateurs={collaborateurs}
          onClose={() => setChambreModal(null)}
          onSave={(data) =>
            saveChambre(
              chambreModal.hebergement.id,
              data,
              chambreModal.chambre === 'add' ? undefined : chambreModal.chambre.id
            )
          }
          saving={saving}
        />
      )}
    </div>
  )
}

// ── Carte hébergement ────────────────────────────────────────
function HebergementCard({
  hebergement: h,
  onEdit, onDelete, onAddChambre, onEditChambre, onDeleteChambre, onEnvoyer, saving,
}: {
  hebergement: Hebergement
  onEdit: () => void
  onDelete: () => void
  onAddChambre: () => void
  onEditChambre: (c: Chambre) => void
  onDeleteChambre: (c: Chambre) => void
  onEnvoyer: () => void
  saving: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* En-tête */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            📍 {h.nom}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {formatDate(h.checkIn)} → {formatDate(h.checkOut)}
            {h.ville && ` · ${h.ville}`}
          </p>
          {h.adresse && <p className="text-xs text-gray-400">{h.adresse}</p>}
          <div className="flex gap-4 mt-1 text-xs text-gray-400">
            {h.email && <span>✉ {h.email}</span>}
            {h.telephone && <span>📞 {h.telephone}</span>}
          </div>
          {h.roomingListEnvoyeeAt && (
            <p className="text-xs text-green-600 mt-1">
              ✓ Rooming list envoyée le {new Date(h.roomingListEnvoyeeAt).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {h.email && (
            <button
              onClick={onEnvoyer}
              disabled={saving}
              className="text-xs border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              📧 Envoyer à l&apos;hôtel
            </button>
          )}
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">✏️</button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50">🗑</button>
        </div>
      </div>

      {/* Chambres */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700">
            Chambres ({h.chambres.length})
          </h4>
          <button
            onClick={onAddChambre}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            + Chambre
          </button>
        </div>

        {h.chambres.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            Aucune chambre configurée.
          </p>
        ) : (
          <div className="space-y-2">
            {h.chambres.map((c) => (
              <ChambreRow
                key={c.id}
                chambre={c}
                hebergement={h}
                onEdit={() => onEditChambre(c)}
                onDelete={() => onDeleteChambre(c)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Ligne chambre ─────────────────────────────────────────────
function ChambreRow({
  chambre: c, hebergement: h, onEdit, onDelete,
}: {
  chambre: Chambre
  hebergement: Hebergement
  onEdit: () => void
  onDelete: () => void
}) {
  // Regrouper occupants par nuit
  const nuits = genererNuits(h.checkIn, h.checkOut)
  const occupantsParNuit = nuits.map((nuit) => ({
    nuit,
    occupants: c.occupants.filter((o) => o.nuitDu.slice(0, 10) === nuit),
  }))

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">
            Chambre {c.numero ?? '—'} · {CHAMBRE_TYPE_LABELS[c.type]}
          </span>
        </div>
        {occupantsParNuit.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-3">
            {occupantsParNuit.map(({ nuit, occupants }) => (
              <div key={nuit} className="text-xs text-gray-600">
                <span className="text-gray-400 font-medium">{formatDateShort(nuit)} :</span>{' '}
                {occupants.length === 0
                  ? <span className="text-gray-300 italic">vide</span>
                  : occupants.map((o) => `${o.collaborateur.user.firstName} ${o.collaborateur.user.lastName[0]}.`).join(', ')}
              </div>
            ))}
          </div>
        )}
        {c.notes && <p className="text-xs text-gray-400 mt-1 italic">{c.notes}</p>}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={onEdit} className="p-1 text-gray-400 hover:text-gray-600">✏️</button>
        <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500">🗑</button>
      </div>
    </div>
  )
}

// ── Modal hébergement ────────────────────────────────────────
function HebergementModal({
  hebergement, onClose, onSave, saving,
}: {
  hebergement: Hebergement | null
  onClose: () => void
  onSave: (data: Record<string, unknown>) => void
  saving: boolean
}) {
  const [form, setForm] = useState({
    nom: hebergement?.nom ?? '',
    adresse: hebergement?.adresse ?? '',
    ville: hebergement?.ville ?? '',
    telephone: hebergement?.telephone ?? '',
    email: hebergement?.email ?? '',
    checkIn: hebergement?.checkIn ? hebergement.checkIn.slice(0, 10) : '',
    checkOut: hebergement?.checkOut ? hebergement.checkOut.slice(0, 10) : '',
    notes: hebergement?.notes ?? '',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      nom: form.nom,
      adresse: form.adresse || undefined,
      ville: form.ville || undefined,
      telephone: form.telephone || undefined,
      email: form.email || undefined,
      checkIn: form.checkIn ? new Date(form.checkIn).toISOString() : undefined,
      checkOut: form.checkOut ? new Date(form.checkOut).toISOString() : undefined,
      notes: form.notes || undefined,
    })
  }

  return (
    <Modal title={hebergement ? 'Modifier l\'hébergement' : 'Ajouter un hébergement'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-field">Nom de l&apos;établissement <span className="text-red-500">*</span></label>
          <input required type="text" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })}
            className="input-field" placeholder="Hôtel Ibis Lyon Centre" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-field">Check-in <span className="text-red-500">*</span></label>
            <input required type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Check-out <span className="text-red-500">*</span></label>
            <input required type="date" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} className="input-field" />
          </div>
        </div>

        <div>
          <label className="label-field">Adresse</label>
          <input type="text" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })}
            className="input-field" placeholder="14 Rue de la Barre, 69002 Lyon" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-field">Email hôtel</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-field" placeholder="reception@hotel.fr" />
          </div>
          <div>
            <label className="label-field">Téléphone</label>
            <input type="tel" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              className="input-field" placeholder="04 72 56 89 10" />
          </div>
        </div>

        <div>
          <label className="label-field">Notes internes</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2} className="input-field resize-none"
            placeholder="Navette depuis la gare à 10h…" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
            {saving ? 'Enregistrement…' : hebergement ? 'Mettre à jour' : 'Ajouter l\'hébergement'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Modal chambre ─────────────────────────────────────────────
function ChambreModal({
  hebergement, chambre, collaborateurs, onClose, onSave, saving,
}: {
  hebergement: Hebergement
  chambre: Chambre | null
  collaborateurs: Collaborateur[]
  onClose: () => void
  onSave: (data: Record<string, unknown>) => void
  saving: boolean
}) {
  const nuits = genererNuits(hebergement.checkIn, hebergement.checkOut)

  // Initialiser occupants : { [nuit]: collaborateurId[] }
  const initOccupants = () => {
    const map: Record<string, string[]> = {}
    nuits.forEach((nuit) => {
      map[nuit] = chambre
        ? chambre.occupants
            .filter((o) => o.nuitDu.slice(0, 10) === nuit)
            .map((o) => o.collaborateurId)
        : []
    })
    return map
  }

  const [form, setForm] = useState({
    numero: chambre?.numero ?? '',
    type: (chambre?.type ?? 'INDIVIDUELLE') as ChambreType,
    notes: chambre?.notes ?? '',
  })
  const [occupantsParNuit, setOccupantsParNuit] = useState<Record<string, string[]>>(initOccupants)

  function toggleOccupant(nuit: string, collaborateurId: string) {
    setOccupantsParNuit((prev) => {
      const current = prev[nuit] ?? []
      return {
        ...prev,
        [nuit]: current.includes(collaborateurId)
          ? current.filter((id) => id !== collaborateurId)
          : [...current, collaborateurId],
      }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Construire la liste des occupants à envoyer
    const occupants: Array<{ collaborateurId: string; nuitDu: string }> = []
    nuits.forEach((nuit) => {
      ;(occupantsParNuit[nuit] ?? []).forEach((collaborateurId) => {
        occupants.push({ collaborateurId, nuitDu: new Date(nuit).toISOString() })
      })
    })
    onSave({
      numero: form.numero || undefined,
      type: form.type,
      notes: form.notes || undefined,
      occupants,
    })
  }

  return (
    <Modal
      title={chambre ? 'Modifier la chambre' : 'Ajouter une chambre'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-field">Numéro de chambre</label>
            <input type="text" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })}
              className="input-field" placeholder="101" />
          </div>
          <div>
            <label className="label-field">Type <span className="text-red-500">*</span></label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ChambreType })} className="input-field">
              {(Object.keys(CHAMBRE_TYPE_LABELS) as ChambreType[]).map((t) => (
                <option key={t} value={t}>{CHAMBRE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Occupants par nuit */}
        {nuits.length > 0 && (
          <div>
            <label className="label-field">Occupants par nuit</label>
            {nuits.map((nuit) => (
              <div key={nuit} className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Nuit du {formatDateShort(nuit)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {collaborateurs.length === 0 && (
                    <span className="text-xs text-gray-400 italic">Aucun collaborateur disponible</span>
                  )}
                  {collaborateurs.map((c) => {
                    const selected = (occupantsParNuit[nuit] ?? []).includes(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleOccupant(nuit, c.id)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          selected
                            ? 'bg-indigo-100 border-indigo-300 text-indigo-700 font-medium'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {selected ? '✓ ' : ''}{c.nom}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="label-field">Notes</label>
          <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input-field" placeholder="Ex: arrivée tardive prévue" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
            {saving ? 'Enregistrement…' : chambre ? 'Mettre à jour' : 'Ajouter'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Modal générique ──────────────────────────────────────────
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
