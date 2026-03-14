'use client'
// ─────────────────────────────────────────────────────────
// Page Flotte — /settings/organisation/flotte
// Gestion des véhicules de l'organisation
// doc/19-module-tournee.md §19.2 §19.6 — ENTERPRISE + DIRECTEUR
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

// ── Types ──────────────────────────────────────────────────
type VehiculeType = 'CAMION' | 'VAN' | 'VOITURE' | 'AUTRE'

type Vehicule = {
  id: string
  label: string
  type: VehiculeType
  immatriculation: string | null
  capacitePersonnes: number | null
  capaciteChargement: string | null
  actif: boolean
  conducteurHabituel: { id: string; firstName: string; lastName: string } | null
}

// ── Constantes ──────────────────────────────────────────────
const TYPE_ICONS: Record<VehiculeType, string> = {
  CAMION: '🚚',
  VAN: '🚐',
  VOITURE: '🚗',
  AUTRE: '🚘',
}

const TYPE_LABELS: Record<VehiculeType, string> = {
  CAMION: 'Camion',
  VAN: 'Van',
  VOITURE: 'Voiture',
  AUTRE: 'Autre',
}

// ── Page principale ──────────────────────────────────────────
export default function FlottePage() {
  const { data: session } = useSession()
  const orgId = session?.user?.organizationId
  const orgPlan = session?.user?.organizationPlan
  const orgRole = session?.user?.organizationRole

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vehicules, setVehicules] = useState<Vehicule[]>([])
  const [showArchives, setShowArchives] = useState(false)

  const [vehiculeModal, setVehiculeModal] = useState<Vehicule | 'add' | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/organisations/${orgId}/vehicules?actif=${!showArchives}`)
      if (res.status === 403) {
        const data = await res.json()
        setError(data.error ?? 'Accès refusé')
        return
      }
      if (!res.ok) { setError('Impossible de charger la flotte'); return }
      setVehicules(await res.json())
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [orgId, showArchives])

  useEffect(() => { load() }, [load])

  async function saveVehicule(data: Record<string, unknown>, id?: string) {
    if (!orgId) return
    setSaving(true)
    try {
      const res = id
        ? await fetch(`/api/vehicules/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
        : await fetch(`/api/organisations/${orgId}/vehicules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
      if (res.ok) {
        await load()
        setVehiculeModal(null)
        showToast(id ? '✅ Véhicule mis à jour.' : '✅ Véhicule ajouté.')
      } else {
        const err = await res.json()
        showToast(`Erreur : ${err.error ?? 'Impossible de sauvegarder'}`)
      }
    } finally {
      setSaving(false)
    }
  }

  async function archiverVehicule(id: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/vehicules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif: false }),
      })
      if (res.ok) {
        await load()
        showToast('📦 Véhicule archivé.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function restaurerVehicule(id: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/vehicules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif: true }),
      })
      if (res.ok) {
        await load()
        showToast('✅ Véhicule restauré.')
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Guards ────────────────────────────────────────────────
  if (orgPlan && orgPlan !== 'ENTERPRISE') {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="text-5xl mb-4">🚌</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Gestion de flotte</h2>
        <p className="text-gray-500 mb-6">
          La gestion de flotte est disponible uniquement sur le plan <strong>ENTERPRISE</strong>.
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

  if (orgRole && orgRole !== 'DIRECTEUR') {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Accès restreint</h2>
        <p className="text-gray-500">
          Seul le Directeur peut gérer la flotte de véhicules.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    if (error.includes('ENTERPRISE') || error.includes('Tournée')) {
      return (
        <div className="p-8 max-w-lg mx-auto text-center">
          <div className="text-5xl mb-4">🚌</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Module Tournée requis</h2>
          <p className="text-gray-500 mb-6">{error}</p>
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

  const actifs = vehicules.filter((v) => v.actif)
  const archives = vehicules.filter((v) => !v.actif)

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg max-w-sm">
          {toast}
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/settings/organisation" className="hover:text-gray-700">Organisation</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Flotte de véhicules</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">🚌 Flotte de véhicules</h1>
          <p className="text-sm text-gray-500 mt-0.5">{actifs.length} véhicule{actifs.length !== 1 ? 's' : ''} actif{actifs.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setVehiculeModal('add')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Ajouter un véhicule
        </button>
      </div>

      {/* Liste actifs */}
      {actifs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center mb-4">
          <div className="text-4xl mb-3">🚘</div>
          <p className="text-gray-500">Aucun véhicule dans la flotte.</p>
          <button
            onClick={() => setVehiculeModal('add')}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl"
          >
            + Ajouter un véhicule
          </button>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {actifs.map((v) => (
            <VehiculeCard
              key={v.id}
              vehicule={v}
              onEdit={() => setVehiculeModal(v)}
              onArchiver={() => archiverVehicule(v.id)}
            />
          ))}
        </div>
      )}

      {/* Archives */}
      {archives.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchives(!showArchives)}
            className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-3"
          >
            {showArchives ? '▾' : '▸'} {archives.length} véhicule{archives.length > 1 ? 's' : ''} archivé{archives.length > 1 ? 's' : ''}
          </button>
          {showArchives && (
            <div className="space-y-3 opacity-60">
              {archives.map((v) => (
                <VehiculeCard
                  key={v.id}
                  vehicule={v}
                  archived
                  onEdit={() => setVehiculeModal(v)}
                  onRestaurer={() => restaurerVehicule(v.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal véhicule */}
      {vehiculeModal !== null && (
        <VehiculeModal
          vehicule={vehiculeModal === 'add' ? null : vehiculeModal}
          onClose={() => setVehiculeModal(null)}
          onSave={(data) => saveVehicule(data, vehiculeModal === 'add' ? undefined : vehiculeModal.id)}
          saving={saving}
        />
      )}
    </div>
  )
}

// ── Carte véhicule ─────────────────────────────────────────────
function VehiculeCard({
  vehicule: v,
  archived = false,
  onEdit,
  onArchiver,
  onRestaurer,
}: {
  vehicule: Vehicule
  archived?: boolean
  onEdit: () => void
  onArchiver?: () => void
  onRestaurer?: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{TYPE_ICONS[v.type]}</span>
        <div>
          <p className="font-medium text-gray-900">
            {v.label}
            {archived && <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Archivé</span>}
          </p>
          <div className="flex gap-3 mt-0.5 text-xs text-gray-500">
            <span>{TYPE_LABELS[v.type]}</span>
            {v.immatriculation && <span>🔤 {v.immatriculation}</span>}
            {v.capacitePersonnes && <span>👥 {v.capacitePersonnes} places</span>}
            {v.capaciteChargement && <span>📦 {v.capaciteChargement}</span>}
          </div>
          {v.conducteurHabituel && (
            <p className="text-xs text-gray-400 mt-0.5">
              Conducteur habituel : {v.conducteurHabituel.firstName} {v.conducteurHabituel.lastName}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onEdit} className="text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 px-2.5 py-1 rounded-lg">
          ✏️ Modifier
        </button>
        {!archived && onArchiver && (
          <button onClick={onArchiver} className="text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 px-2.5 py-1 rounded-lg">
            📦 Archiver
          </button>
        )}
        {archived && onRestaurer && (
          <button onClick={onRestaurer} className="text-xs border border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-2.5 py-1 rounded-lg">
            ↩ Restaurer
          </button>
        )}
      </div>
    </div>
  )
}

// ── Modal véhicule ─────────────────────────────────────────────
function VehiculeModal({
  vehicule, onClose, onSave, saving,
}: {
  vehicule: Vehicule | null
  onClose: () => void
  onSave: (data: Record<string, unknown>) => void
  saving: boolean
}) {
  const [form, setForm] = useState({
    label: vehicule?.label ?? '',
    type: (vehicule?.type ?? 'VAN') as VehiculeType,
    immatriculation: vehicule?.immatriculation ?? '',
    capacitePersonnes: vehicule?.capacitePersonnes?.toString() ?? '',
    capaciteChargement: vehicule?.capaciteChargement ?? '',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      label: form.label,
      type: form.type,
      immatriculation: form.immatriculation || undefined,
      capacitePersonnes: form.capacitePersonnes ? parseInt(form.capacitePersonnes) : undefined,
      capaciteChargement: form.capaciteChargement || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {vehicule ? 'Modifier le véhicule' : 'Ajouter un véhicule'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="label-field">Nom / Description <span className="text-red-500">*</span></label>
            <input required type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="input-field" placeholder="Van 9 places" />
          </div>

          <div>
            <label className="label-field">Type <span className="text-red-500">*</span></label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as VehiculeType })} className="input-field">
              {(Object.keys(TYPE_LABELS) as VehiculeType[]).map((t) => (
                <option key={t} value={t}>{TYPE_ICONS[t]} {TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Immatriculation</label>
              <input type="text" value={form.immatriculation} onChange={(e) => setForm({ ...form, immatriculation: e.target.value })}
                className="input-field" placeholder="AB-123-CD" />
            </div>
            <div>
              <label className="label-field">Nb. places personnes</label>
              <input type="number" min={1} max={99} value={form.capacitePersonnes}
                onChange={(e) => setForm({ ...form, capacitePersonnes: e.target.value })}
                className="input-field" placeholder="9" />
            </div>
          </div>

          <div>
            <label className="label-field">Charge utile / Chargement</label>
            <input type="text" value={form.capaciteChargement} onChange={(e) => setForm({ ...form, capaciteChargement: e.target.value })}
              className="input-field" placeholder="3,5T — ou volume scénique" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
              {saving ? 'Enregistrement…' : vehicule ? 'Mettre à jour' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
