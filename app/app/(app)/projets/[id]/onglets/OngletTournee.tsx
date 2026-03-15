'use client'
// ─────────────────────────────────────────────────────────
// Onglet Tournée — Hébergements (rooming list) + Flotte (transport)
// doc/19-module-tournee.md — plan ENTERPRISE requis
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Props = {
  projetId: string
  organisationId: string
  organisationPlan: string
  canEdit: boolean
  canSeeRH: boolean
}

// ── Types ─────────────────────────────────────────────────
type OccupantCollaborateur = {
  id: string
  nuitDu: string
  notes: string | null
  collaborateur: {
    user: { id: string; firstName: string; lastName: string }
  }
}

type Chambre = {
  id: string
  numero: string | null
  type: 'INDIVIDUELLE' | 'DOUBLE' | 'DOUBLE_USAGE_SIMPLE' | 'SUITE'
  notes: string | null
  occupants: OccupantCollaborateur[]
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
  updatedAt: string
  chambres: Chambre[]
}

type Passager = {
  id: string
  role: 'CONDUCTEUR' | 'PASSAGER'
  collaborateur: {
    user: { id: string; firstName: string; lastName: string; phone: string | null }
  }
}

type VehiculeAssignment = {
  id: string
  departLieu: string | null
  departTime: string | null
  arriveeEstimeeTime: string | null
  notes: string | null
  vehicule: { id: string; label: string; type: string; capacitePersonnes: number | null }
  passagers: Passager[]
}

// ── Helpers ───────────────────────────────────────────────
const TYPE_CHAMBRE_LABEL: Record<string, string> = {
  INDIVIDUELLE: 'Individuelle',
  DOUBLE: 'Double',
  DOUBLE_USAGE_SIMPLE: 'Double usage simple',
  SUITE: 'Suite',
}

const TYPE_VEHICULE_EMOJI: Record<string, string> = {
  CAMION: '🚚',
  VAN: '🚐',
  VOITURE: '🚗',
  AUTRE: '🚌',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateCourt(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function getNuitsDansPlage(checkIn: string, checkOut: string): string[] {
  const nuits: string[] = []
  const start = new Date(checkIn)
  const end = new Date(checkOut)
  const current = new Date(start)
  while (current < end) {
    nuits.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return nuits
}

// ─────────────────────────────────────────────────────────
// Bloc d'upgrade (plan < ENTERPRISE)
// ─────────────────────────────────────────────────────────
function UpgradeBlock() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
      <div className="text-5xl mb-4">🚌</div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Module Tournée</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">
        Gérez l'hébergement (rooming list), la flotte de véhicules et les préférences de vos collaborateurs en tournée.
        Disponible sur le plan <strong>Enterprise</strong>.
      </p>
      <Link
        href="/settings/organisation#facturation"
        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
      >
        Passer à Enterprise →
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Modal — Ajouter / Modifier un hébergement
// ─────────────────────────────────────────────────────────
function ModalHebergement({
  projetId,
  hebergement,
  onClose,
  onSaved,
}: {
  projetId: string
  hebergement?: Hebergement
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!hebergement
  const [form, setForm] = useState({
    nom: hebergement?.nom ?? '',
    adresse: hebergement?.adresse ?? '',
    ville: hebergement?.ville ?? '',
    telephone: hebergement?.telephone ?? '',
    email: hebergement?.email ?? '',
    checkIn: hebergement ? hebergement.checkIn.split('T')[0] : '',
    checkOut: hebergement ? hebergement.checkOut.split('T')[0] : '',
    notes: hebergement?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})

    const url = isEdit
      ? `/api/hebergements/${hebergement!.id}`
      : `/api/projets/${projetId}/hebergements`
    const method = isEdit ? 'PATCH' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        onSaved()
        onClose()
      } else {
        const data = await res.json()
        if (data.details?.fieldErrors) setErrors(data.details.fieldErrors)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">
            {isEdit ? 'Modifier l\'hébergement' : 'Ajouter un hébergement'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nom de l'établissement *</label>
            <input
              type="text" required value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Hôtel Ibis Lyon Centre"
            />
            {errors.nom && <p className="text-red-500 text-xs mt-1">{errors.nom[0]}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Check-in *</label>
              <input
                type="date" required value={form.checkIn}
                onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Check-out *</label>
              <input
                type="date" required value={form.checkOut}
                onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Adresse</label>
            <input
              type="text" value={form.adresse}
              onChange={(e) => setForm({ ...form, adresse: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="14 Rue de la Barre, 69002 Lyon"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email hôtel</label>
              <input
                type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="reception@hotel.fr"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
              <input
                type="tel" value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="04 72 56 89 10"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes internes</label>
            <textarea
              rows={2} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Navette depuis la gare à 10h…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60 transition-colors">
              {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter l\'hébergement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Modal — Ajouter / Modifier une chambre + occupants
// ─────────────────────────────────────────────────────────
function ModalChambre({
  hebergement,
  chambre,
  onClose,
  onSaved,
}: {
  hebergement: Hebergement
  chambre?: Chambre
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!chambre
  const nuits = getNuitsDansPlage(hebergement.checkIn, hebergement.checkOut)

  const [type, setType] = useState<string>(chambre?.type ?? 'INDIVIDUELLE')
  const [numero, setNumero] = useState(chambre?.numero ?? '')
  const [notes, setNotes] = useState(chambre?.notes ?? '')
  // occupants: { collaborateurId: string, nuitDu: string, nom: string }[]
  const [occupants, setOccupants] = useState<Array<{ collaborateurId: string; nuitDu: string; notes: string }>>
    (chambre?.occupants.map((o) => ({ collaborateurId: o.collaborateur.user.id, nuitDu: o.nuitDu.split('T')[0], notes: o.notes ?? '' })) ?? [])
  const [newCollabId, setNewCollabId] = useState('')
  const [newNuit, setNewNuit] = useState(nuits[0] ?? '')
  const [saving, setSaving] = useState(false)

  function addOccupant() {
    if (!newCollabId || !newNuit) return
    if (occupants.some((o) => o.collaborateurId === newCollabId && o.nuitDu === newNuit)) return
    setOccupants([...occupants, { collaborateurId: newCollabId, nuitDu: newNuit, notes: '' }])
    setNewCollabId('')
  }

  function removeOccupant(collaborateurId: string, nuitDu: string) {
    setOccupants(occupants.filter((o) => !(o.collaborateurId === collaborateurId && o.nuitDu === nuitDu)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const url = isEdit
      ? `/api/chambres/${chambre!.id}`
      : `/api/hebergements/${hebergement.id}/chambres`
    const method = isEdit ? 'PATCH' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: numero || undefined, type, notes: notes || undefined, occupants }),
      })
      if (res.ok) { onSaved(); onClose() }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-base font-semibold text-gray-900">
            {isEdit ? `Chambre ${chambre?.numero ?? '—'}` : 'Ajouter une chambre'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Numéro</label>
              <input
                type="text" value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="101"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {Object.entries(TYPE_CHAMBRE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Occupants existants */}
          {occupants.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">Occupants assignés</p>
              <div className="space-y-1">
                {occupants.map((o, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium text-gray-600">{formatDateCourt(o.nuitDu)}</span>
                      {' — '}
                      <span className="text-gray-800">{o.collaborateurId}</span>
                    </span>
                    <button type="button" onClick={() => removeOccupant(o.collaborateurId, o.nuitDu)}
                      className="text-gray-400 hover:text-red-500 transition-colors ml-2">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ajouter un occupant */}
          <div className="border border-dashed border-gray-200 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-700 mb-2">Ajouter un occupant</p>
            <div className="flex gap-2">
              <input
                type="text" placeholder="ID collaborateur"
                value={newCollabId} onChange={(e) => setNewCollabId(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select value={newNuit} onChange={(e) => setNewNuit(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {nuits.map((n) => (
                  <option key={n} value={n}>Nuit du {formatDateCourt(n)}</option>
                ))}
              </select>
              <button type="button" onClick={addOccupant}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors">
                + Ajouter
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60 transition-colors">
              {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter la chambre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Carte hébergement
// ─────────────────────────────────────────────────────────
function CarteHebergement({
  hebergement,
  canEdit,
  onEdit,
  onRefresh,
}: {
  hebergement: Hebergement
  canEdit: boolean
  onEdit: () => void
  onRefresh: () => void
}) {
  const [showAddChambre, setShowAddChambre] = useState(false)
  const [editChambre, setEditChambre] = useState<Chambre | null>(null)
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [envoiMessage, setEnvoiMessage] = useState<string | null>(null)

  // Détecter si modifiée depuis dernier envoi
  const modifieDepuisEnvoi = hebergement.roomingListEnvoyeeAt
    ? new Date(hebergement.updatedAt) > new Date(hebergement.roomingListEnvoyeeAt)
    : false

  async function envoyerRoomingList() {
    if (!hebergement.email) return
    setEnvoiEnCours(true)
    setEnvoiMessage(null)
    try {
      const res = await fetch(`/api/hebergements/${hebergement.id}/envoyer`, { method: 'POST' })
      if (res.ok) {
        setEnvoiMessage('✅ Rooming list envoyée')
        onRefresh()
      } else {
        setEnvoiMessage('❌ Erreur lors de l\'envoi')
      }
    } finally {
      setEnvoiEnCours(false)
    }
  }

  async function supprimerHebergement() {
    if (!confirm(`Supprimer "${hebergement.nom}" ? Cette action est irréversible.`)) return
    await fetch(`/api/hebergements/${hebergement.id}`, { method: 'DELETE' })
    onRefresh()
  }

  async function supprimerChambre(chambreId: string) {
    if (!confirm('Supprimer cette chambre et ses occupants ?')) return
    await fetch(`/api/chambres/${chambreId}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* En-tête hébergement */}
      <div className="flex items-start justify-between p-4 bg-gray-50 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">📍</span>
            <h3 className="font-semibold text-gray-900">{hebergement.nom}</h3>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 ml-7">
            {formatDate(hebergement.checkIn)} → {formatDate(hebergement.checkOut)}
            {hebergement.ville && ` · ${hebergement.ville}`}
          </p>
          {hebergement.telephone && (
            <p className="text-sm text-gray-500 ml-7">📞 {hebergement.telephone}</p>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button onClick={onEdit}
              className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-2.5 py-1 rounded-lg transition-colors">
              ✏️ Modifier
            </button>
            <button onClick={supprimerHebergement}
              className="text-sm text-red-500 hover:text-red-700 border border-red-100 hover:border-red-200 px-2.5 py-1 rounded-lg transition-colors">
              🗑️
            </button>
          </div>
        )}
      </div>

      {/* Rooming list */}
      <div className="p-4">
        {/* Barre d'actions */}
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">Chambres & Attribution</h4>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button onClick={() => setShowAddChambre(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-300 px-2.5 py-1 rounded-lg transition-colors">
                + Chambre
              </button>
            )}
            {hebergement.email && canEdit && (
              <button onClick={envoyerRoomingList} disabled={envoiEnCours}
                className="text-xs text-green-700 hover:text-green-900 border border-green-200 hover:border-green-300 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-60">
                {envoiEnCours ? 'Envoi…' : '📧 Envoyer à l\'hôtel'}
              </button>
            )}
          </div>
        </div>

        {/* Badges statut envoi */}
        {hebergement.roomingListEnvoyeeAt && (
          <div className="mb-3">
            {modifieDepuisEnvoi ? (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                ⚠️ Modifiée depuis le dernier envoi — {formatDate(hebergement.roomingListEnvoyeeAt)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                ✅ Envoyée le {new Date(hebergement.roomingListEnvoyeeAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à {new Date(hebergement.roomingListEnvoyeeAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}
        {envoiMessage && <p className="text-xs text-gray-600 mb-3">{envoiMessage}</p>}

        {hebergement.chambres.length === 0 ? (
          <div className="text-sm text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-lg">
            Aucune chambre — cliquez sur « + Chambre » pour commencer
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="text-left px-3 py-2 font-medium">Chambre</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-left px-3 py-2 font-medium">Occupants par nuit</th>
                  {canEdit && <th className="px-3 py-2"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {hebergement.chambres.map((chambre) => {
                  // Grouper occupants par nuit
                  const nuitsMap = new Map<string, string[]>()
                  for (const occ of chambre.occupants) {
                    const nuit = occ.nuitDu.split('T')[0]
                    const label = formatDateCourt(nuit)
                    if (!nuitsMap.has(label)) nuitsMap.set(label, [])
                    const nom = `${occ.collaborateur.user.firstName} ${occ.collaborateur.user.lastName}`
                    nuitsMap.get(label)!.push(nom)
                  }

                  return (
                    <tr key={chambre.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-gray-900">{chambre.numero ?? '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600">{TYPE_CHAMBRE_LABEL[chambre.type]}</td>
                      <td className="px-3 py-2.5">
                        {nuitsMap.size === 0 ? (
                          <span className="text-gray-400 italic text-xs">Non assignée</span>
                        ) : (
                          <div className="space-y-0.5">
                            {Array.from(nuitsMap.entries()).map(([nuit, noms]) => (
                              <div key={nuit} className="text-xs">
                                <span className="font-medium text-gray-500">{nuit}</span>
                                {' : '}
                                <span className="text-gray-800">{noms.join(', ')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditChambre(chambre)}
                              className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded transition-colors">
                              ✏️
                            </button>
                            <button onClick={() => supprimerChambre(chambre.id)}
                              className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded transition-colors">
                              🗑️
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {hebergement.notes && (
          <p className="mt-3 text-xs text-gray-500 italic border-t border-gray-100 pt-3">
            Note interne : {hebergement.notes}
          </p>
        )}
      </div>

      {/* Modals */}
      {showAddChambre && (
        <ModalChambre
          hebergement={hebergement}
          onClose={() => setShowAddChambre(false)}
          onSaved={onRefresh}
        />
      )}
      {editChambre && (
        <ModalChambre
          hebergement={hebergement}
          chambre={editChambre}
          onClose={() => setEditChambre(null)}
          onSaved={onRefresh}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Section Transport
// ─────────────────────────────────────────────────────────
function SectionTransport({
  projetId,
  organisationId,
  canEdit,
}: {
  projetId: string
  organisationId: string
  canEdit: boolean
}) {
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">Transport & Flotte</h2>
        {canEdit && (
          <Link
            href={`/settings/organisation/flotte`}
            className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            ⚙️ Gérer la flotte
          </Link>
        )}
      </div>
      <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-6 text-center text-sm text-gray-500">
        <div className="text-3xl mb-2">🚐</div>
        <p>Les assignations transport se gèrent depuis chaque représentation.</p>
        <p className="text-xs text-gray-400 mt-1">
          Accédez à une représentation → onglet Feuille de route → section Transport
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────
export function OngletTournee({ projetId, organisationId, organisationPlan, canEdit, canSeeRH }: Props) {
  const [hebergements, setHebergements] = useState<Hebergement[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddHebergement, setShowAddHebergement] = useState(false)
  const [editHebergement, setEditHebergement] = useState<Hebergement | null>(null)

  // Guard plan ENTERPRISE
  if (organisationPlan !== 'ENTERPRISE') {
    return <UpgradeBlock />
  }

  const fetchHebergements = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projets/${projetId}/hebergements`)
      if (res.ok) setHebergements(await res.json())
    } finally {
      setLoading(false)
    }
  }, [projetId])

  useEffect(() => { fetchHebergements() }, [fetchHebergements])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* ── Section Hébergements ──────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">Hébergements</h2>
        {canEdit && (
          <button
            onClick={() => setShowAddHebergement(true)}
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            + Ajouter un hôtel
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Chargement…</div>
      ) : hebergements.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">🏨</div>
          <p className="text-sm text-gray-500">Aucun hébergement configuré pour ce projet.</p>
          {canEdit && (
            <button
              onClick={() => setShowAddHebergement(true)}
              className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 underline"
            >
              Ajouter le premier hébergement
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {hebergements.map((h) => (
            <CarteHebergement
              key={h.id}
              hebergement={h}
              canEdit={canEdit}
              onEdit={() => setEditHebergement(h)}
              onRefresh={fetchHebergements}
            />
          ))}
        </div>
      )}

      {/* ── Section Transport ─────────────────────────────── */}
      <SectionTransport
        projetId={projetId}
        organisationId={organisationId}
        canEdit={canEdit}
      />

      {/* ── Modals ────────────────────────────────────────── */}
      {showAddHebergement && (
        <ModalHebergement
          projetId={projetId}
          onClose={() => setShowAddHebergement(false)}
          onSaved={fetchHebergements}
        />
      )}
      {editHebergement && (
        <ModalHebergement
          projetId={projetId}
          hebergement={editHebergement}
          onClose={() => setEditHebergement(null)}
          onSaved={fetchHebergements}
        />
      )}
    </div>
  )
}
