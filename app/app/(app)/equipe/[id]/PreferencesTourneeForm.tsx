'use client'
// ─────────────────────────────────────────────────────────
// Section Préférences tournée — Client Component
// Affichage + édition inline via PATCH /api/collaborateurs/[id]/preferences-tournee
// doc/19-module-tournee.md §19.3 — ENTERPRISE uniquement, RH/Directeur
// ─────────────────────────────────────────────────────────
import { useState } from 'react'

type PreferenceChambre = 'SANS_PREFERENCE' | 'INDIVIDUELLE' | 'PARTAGEE_ACCEPTEE'
type RegimeAlimentaire = 'STANDARD' | 'VEGETARIEN' | 'VEGAN' | 'SANS_PORC' | 'HALAL' | 'KASHER' | 'AUTRE'

type Props = {
  collaborateurId: string
  initial: {
    preferenceChambre: PreferenceChambre
    regimeAlimentaire: RegimeAlimentaire
    allergies: string | null
    permisConduire: boolean
    permisCategorie: string | null
    notesTournee: string | null
  }
}

const CHAMBRE_LABEL: Record<PreferenceChambre, string> = {
  SANS_PREFERENCE: 'Sans préférence',
  INDIVIDUELLE: 'Individuelle',
  PARTAGEE_ACCEPTEE: 'Partagée acceptée',
}

const REGIME_LABEL: Record<RegimeAlimentaire, string> = {
  STANDARD: 'Standard',
  VEGETARIEN: 'Végétarien',
  VEGAN: 'Végan',
  SANS_PORC: 'Sans porc',
  HALAL: 'Halal',
  KASHER: 'Kasher',
  AUTRE: 'Autre',
}

export default function PreferencesTourneeForm({ collaborateurId, initial }: Props) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState(initial)
  const [form, setForm] = useState(initial)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/collaborateurs/${collaborateurId}/preferences-tournee`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json?.error ?? 'Une erreur est survenue')
        return
      }
      const updated = await res.json()
      setData({
        preferenceChambre: updated.preferenceChambre,
        regimeAlimentaire: updated.regimeAlimentaire,
        allergies: updated.allergies,
        permisConduire: updated.permisConduire,
        permisCategorie: updated.permisCategorie,
        notesTournee: updated.notesTournee,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setForm(data)
    setError(null)
    setEditing(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          🚌 Préférences tournée
        </h3>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            Modifier
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          {/* Chambre */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Chambre</label>
            <select
              value={form.preferenceChambre}
              onChange={(e) => setForm({ ...form, preferenceChambre: e.target.value as PreferenceChambre })}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {(Object.keys(CHAMBRE_LABEL) as PreferenceChambre[]).map((k) => (
                <option key={k} value={k}>{CHAMBRE_LABEL[k]}</option>
              ))}
            </select>
          </div>

          {/* Régime */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Régime alimentaire</label>
            <select
              value={form.regimeAlimentaire}
              onChange={(e) => setForm({ ...form, regimeAlimentaire: e.target.value as RegimeAlimentaire })}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {(Object.keys(REGIME_LABEL) as RegimeAlimentaire[]).map((k) => (
                <option key={k} value={k}>{REGIME_LABEL[k]}</option>
              ))}
            </select>
          </div>

          {/* Allergies */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Allergies</label>
            <input
              type="text"
              value={form.allergies ?? ''}
              onChange={(e) => setForm({ ...form, allergies: e.target.value || null })}
              placeholder="ex: gluten, lactose"
              maxLength={500}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Permis */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.permisConduire}
                onChange={(e) => setForm({ ...form, permisConduire: e.target.checked, permisCategorie: e.target.checked ? form.permisCategorie : null })}
                className="rounded border-gray-300 text-indigo-600"
              />
              Permis de conduire
            </label>
            {form.permisConduire && (
              <input
                type="text"
                value={form.permisCategorie ?? ''}
                onChange={(e) => setForm({ ...form, permisCategorie: e.target.value || null })}
                placeholder="ex: B, BE, C"
                maxLength={20}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-28 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>

          {/* Notes tournée */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes logistiques</label>
            <textarea
              value={form.notesTournee ?? ''}
              onChange={(e) => setForm({ ...form, notesTournee: e.target.value || null })}
              placeholder="Notes libres pour la logistique tournée…"
              rows={3}
              maxLength={1000}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5 font-medium disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Chambre</span>
            <span className="text-gray-900">{CHAMBRE_LABEL[data.preferenceChambre]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Régime</span>
            <span className="text-gray-900">{REGIME_LABEL[data.regimeAlimentaire]}</span>
          </div>
          {data.allergies && (
            <div className="flex justify-between gap-2">
              <span className="text-gray-500 flex-shrink-0">Allergies</span>
              <span className="text-gray-900 text-right">{data.allergies}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Permis</span>
            <span className="text-gray-900">
              {data.permisConduire
                ? `Oui${data.permisCategorie ? ` (${data.permisCategorie})` : ''}`
                : 'Non'}
            </span>
          </div>
          {data.notesTournee && (
            <div className="pt-1 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-gray-700 text-xs leading-relaxed">{data.notesTournee}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
