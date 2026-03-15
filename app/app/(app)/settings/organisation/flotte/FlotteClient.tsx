'use client'
// ─────────────────────────────────────────────────────────
// Gestion de la flotte de véhicules — /settings/organisation/flotte
// doc/19-module-tournee.md §19.2 — DIRECTEUR uniquement
// ─────────────────────────────────────────────────────────
import { useState } from 'react'
import Link from 'next/link'

type Conducteur = {
  id: string
  user: { id: string; firstName: string; lastName: string }
}

type Vehicule = {
  id: string
  label: string
  type: 'CAMION' | 'VAN' | 'VOITURE' | 'AUTRE'
  immatriculation: string | null
  capacitePersonnes: number | null
  capaciteChargement: string | null
  actif: boolean
  conducteurHabituel: Conducteur | null
}

type Props = {
  organisationId: string
  vehiculesInitiaux: Vehicule[]
  conducteursDisponibles: Conducteur[]
}

const TYPE_VEHICULE_EMOJI: Record<string, string> = {
  CAMION: '🚚',
  VAN: '🚐',
  VOITURE: '🚗',
  AUTRE: '🚌',
}

const TYPE_VEHICULE_LABEL: Record<string, string> = {
  CAMION: 'Camion',
  VAN: 'Van',
  VOITURE: 'Voiture',
  AUTRE: 'Autre',
}

// ── Modal Véhicule ─────────────────────────────────────────
function ModalVehicule({
  organisationId,
  vehicule,
  conducteurs,
  onClose,
  onSaved,
}: {
  organisationId: string
  vehicule?: Vehicule
  conducteurs: Conducteur[]
  onClose: () => void
  onSaved: (v: Vehicule) => void
}) {
  const isEdit = !!vehicule
  const [form, setForm] = useState({
    label: vehicule?.label ?? '',
    type: vehicule?.type ?? 'VAN',
    immatriculation: vehicule?.immatriculation ?? '',
    capacitePersonnes: vehicule?.capacitePersonnes?.toString() ?? '',
    capaciteChargement: vehicule?.capaciteChargement ?? '',
    conducteurHabituelId: vehicule?.conducteurHabituel?.id ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})

    const url = isEdit
      ? `/api/vehicules/${vehicule!.id}`
      : `/api/organisations/${organisationId}/vehicules`
    const method = isEdit ? 'PATCH' : 'POST'

    const body = {
      label: form.label,
      type: form.type,
      immatriculation: form.immatriculation || undefined,
      capacitePersonnes: form.capacitePersonnes ? parseInt(form.capacitePersonnes) : undefined,
      capaciteChargement: form.capaciteChargement || undefined,
      conducteurHabituelId: form.conducteurHabituelId || null,
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const data = await res.json()
        onSaved(data)
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">
            {isEdit ? 'Modifier le véhicule' : 'Ajouter un véhicule'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Libellé *</label>
            <input
              type="text" required value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Van 9 places, Camion plateau…"
            />
            {errors.label && <p className="text-red-500 text-xs mt-1">{errors.label[0]}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'CAMION' | 'VAN' | 'VOITURE' | 'AUTRE' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {Object.entries(TYPE_VEHICULE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{TYPE_VEHICULE_EMOJI[k]} {v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Immatriculation</label>
              <input
                type="text" value={form.immatriculation}
                onChange={(e) => setForm({ ...form, immatriculation: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="AB-123-CD"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Capacité (personnes)</label>
              <input
                type="number" min="1" value={form.capacitePersonnes}
                onChange={(e) => setForm({ ...form, capacitePersonnes: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="9"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Charge utile</label>
              <input
                type="text" value={form.capaciteChargement}
                onChange={(e) => setForm({ ...form, capaciteChargement: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="3,5T"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Conducteur habituel</label>
            <select value={form.conducteurHabituelId}
              onChange={(e) => setForm({ ...form, conducteurHabituelId: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">— Aucun —</option>
              {conducteurs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.user.firstName} {c.user.lastName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60 transition-colors">
              {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter le véhicule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────
export function FlotteClient({ organisationId, vehiculesInitiaux, conducteursDisponibles }: Props) {
  const [vehicules, setVehicules] = useState<Vehicule[]>(vehiculesInitiaux)
  const [showAdd, setShowAdd] = useState(false)
  const [editVehicule, setEditVehicule] = useState<Vehicule | null>(null)

  function handleSaved(v: Vehicule) {
    setVehicules((prev) => {
      const idx = prev.findIndex((x) => x.id === v.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = v
        return next
      }
      return [...prev, v]
    })
  }

  async function archiverVehicule(id: string) {
    if (!confirm('Archiver ce véhicule ? Il ne sera plus disponible pour de nouvelles tournées.')) return
    const res = await fetch(`/api/vehicules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actif: false }),
    })
    if (res.ok) {
      setVehicules((prev) => prev.filter((v) => v.id !== id))
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/settings/organisation"
            className="text-gray-400 hover:text-gray-600 text-sm">
            ← Paramètres
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-semibold text-gray-900">Flotte de véhicules</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors"
        >
          + Ajouter un véhicule
        </button>
      </div>

      {vehicules.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center">
          <div className="text-4xl mb-3">🚐</div>
          <p className="text-sm text-gray-500 mb-1">Aucun véhicule dans la flotte</p>
          <p className="text-xs text-gray-400 mb-4">Ajoutez des véhicules pour les assigner aux tournées</p>
          <button onClick={() => setShowAdd(true)}
            className="text-sm text-indigo-600 hover:text-indigo-800 underline">
            Ajouter le premier véhicule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicules.map((v) => (
            <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{TYPE_VEHICULE_EMOJI[v.type]}</span>
                <div>
                  <p className="font-medium text-gray-900">{v.label}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    {v.immatriculation && <span>{v.immatriculation}</span>}
                    {v.capacitePersonnes && <span>{v.capacitePersonnes} places</span>}
                    {v.capaciteChargement && <span>Charge : {v.capaciteChargement}</span>}
                    {v.conducteurHabituel && (
                      <span>
                        Conducteur habituel : {v.conducteurHabituel.user.firstName} {v.conducteurHabituel.user.lastName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditVehicule(v)}
                  className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors">
                  ✏️ Modifier
                </button>
                <button onClick={() => archiverVehicule(v.id)}
                  className="text-sm text-red-500 hover:text-red-700 border border-red-100 px-2.5 py-1 rounded-lg transition-colors">
                  🗑️ Archiver
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <ModalVehicule
          organisationId={organisationId}
          conducteurs={conducteursDisponibles}
          onClose={() => setShowAdd(false)}
          onSaved={handleSaved}
        />
      )}
      {editVehicule && (
        <ModalVehicule
          organisationId={organisationId}
          vehicule={editVehicule}
          conducteurs={conducteursDisponibles}
          onClose={() => setEditVehicule(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
