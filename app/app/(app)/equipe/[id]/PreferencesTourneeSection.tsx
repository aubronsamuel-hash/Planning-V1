'use client'
// ─────────────────────────────────────────────────────────
// Section Préférences Tournée — fiche collaborateur
// doc/19-module-tournee.md §19.3 — données sensibles, RH/DIRECTEUR uniquement
// ─────────────────────────────────────────────────────────
import { useState } from 'react'

type Preferences = {
  preferenceChambre: string
  regimeAlimentaire: string
  allergies: string | null
  permisConduire: boolean
  permisCategorie: string | null
}

type Props = {
  collaborateurId: string
  initial: Preferences
}

const PREFERENCE_CHAMBRE_LABEL: Record<string, string> = {
  SANS_PREFERENCE: 'Sans préférence',
  INDIVIDUELLE: 'Chambre individuelle',
  PARTAGEE_ACCEPTEE: 'Partagée acceptée',
}

const REGIME_LABEL: Record<string, string> = {
  STANDARD: 'Standard',
  VEGETARIEN: 'Végétarien',
  VEGAN: 'Végétalien',
  SANS_PORC: 'Sans porc',
  HALAL: 'Halal',
  KASHER: 'Kasher',
  AUTRE: 'Autre',
}

export function PreferencesTourneeSection({ collaborateurId, initial }: Props) {
  const [prefs, setPrefs] = useState<Preferences>(initial)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Preferences>(initial)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/collaborateurs/${collaborateurId}/preferences-tournee`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferenceChambre: form.preferenceChambre,
          regimeAlimentaire: form.regimeAlimentaire,
          allergies: form.allergies || null,
          permisConduire: form.permisConduire,
          permisCategorie: form.permisConduire ? (form.permisCategorie || null) : null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setPrefs({ ...form, ...data })
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setForm(prefs)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="bg-white rounded-xl border border-indigo-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            🚌 Préférences tournée
          </h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Préférence chambre</label>
            <select
              value={form.preferenceChambre}
              onChange={(e) => setForm({ ...form, preferenceChambre: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {Object.entries(PREFERENCE_CHAMBRE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Régime alimentaire</label>
            <select
              value={form.regimeAlimentaire}
              onChange={(e) => setForm({ ...form, regimeAlimentaire: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {Object.entries(REGIME_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Allergies alimentaires</label>
            <input
              type="text"
              value={form.allergies ?? ''}
              onChange={(e) => setForm({ ...form, allergies: e.target.value || null })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="gluten, lactose…"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.permisConduire}
                onChange={(e) => setForm({ ...form, permisConduire: e.target.checked })}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Permis de conduire
            </label>
            {form.permisConduire && (
              <input
                type="text"
                value={form.permisCategorie ?? ''}
                onChange={(e) => setForm({ ...form, permisCategorie: e.target.value || null })}
                className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Catégorie : B, BE, C…"
              />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60 transition-colors"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          🚌 Préférences tournée
        </h3>
        <button
          onClick={() => { setForm(prefs); setEditing(true) }}
          className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2 py-1 rounded-lg transition-colors"
        >
          ✏️ Éditer
        </button>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Hébergement</span>
          <span className="text-gray-900">{PREFERENCE_CHAMBRE_LABEL[prefs.preferenceChambre] ?? prefs.preferenceChambre}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Régime alimentaire</span>
          <span className="text-gray-900">{REGIME_LABEL[prefs.regimeAlimentaire] ?? prefs.regimeAlimentaire}</span>
        </div>
        {prefs.allergies && (
          <div className="flex justify-between">
            <span className="text-gray-500">Allergies</span>
            <span className="text-gray-900">{prefs.allergies}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Permis de conduire</span>
          <span className="text-gray-900">
            {prefs.permisConduire
              ? `Oui${prefs.permisCategorie ? ` — Permis ${prefs.permisCategorie}` : ''}`
              : 'Non'}
          </span>
        </div>
      </div>
    </div>
  )
}
