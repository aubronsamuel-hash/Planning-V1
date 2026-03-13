'use client'
// ─────────────────────────────────────────────────────────
// Onglet Représentations — liste + ajout unitaire / en série
// doc/04 §6.3 — tableau représentations
// ─────────────────────────────────────────────────────────
import { useState } from 'react'
import type { Representation } from '../ProjetDetailClient'

type Props = {
  projetId: string
  representations: Representation[]
  canEdit: boolean
  onRepresentationsChange: (reprs: Representation[]) => void
  onGoToPlanning: (repId: string) => void
}

const TYPE_LABELS: Record<string, string> = {
  REPRESENTATION: 'Représentation',
  REPETITION: 'Répétition',
  FILAGE: 'Filage',
  GENERALE: 'Générale',
  AVANT_PREMIERE: 'Avant-première',
  INTERVENTION: 'Intervention',
  EVENEMENT: 'Événement',
}

const STATUT_VISUEL: Record<string, { icon: string; label: string; className: string }> = {
  VERT:  { icon: '✅', label: 'OK', className: 'text-green-700' },
  JAUNE: { icon: '🟡', label: 'Partiel', className: 'text-yellow-600' },
  ROUGE: { icon: '🔴', label: 'Incomplet', className: 'text-red-600' },
}

const JOURS_SEMAINE = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
  { value: 0, label: 'Dim' },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatTime(t: string | null): string {
  return t ? t.replace(':', 'h') : '—'
}

type ModalMode = null | 'unique' | 'serie'

export function OngletRepresentations({ projetId, representations, canEdit, onRepresentationsChange, onGoToPlanning }: Props) {
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ repId: string; x: number; y: number } | null>(null)

  // Form unitaire
  const [formUnique, setFormUnique] = useState({
    date: '',
    type: 'REPRESENTATION',
    showStartTime: '',
    showEndTime: '',
    getInTime: '',
    getOutTime: '',
    venueName: '',
    venueCity: '',
  })

  // Form série
  const [formSerie, setFormSerie] = useState({
    dateDebut: '',
    dateFin: '',
    joursActifs: [] as number[],
    type: 'REPRESENTATION',
    showStartTime: '',
    showEndTime: '',
    getInTime: '',
    venueName: '',
    venueCity: '',
  })

  function toggleJour(j: number) {
    setFormSerie((prev) => ({
      ...prev,
      joursActifs: prev.joursActifs.includes(j)
        ? prev.joursActifs.filter((x) => x !== j)
        : [...prev.joursActifs, j],
    }))
  }

  async function handleCreateUnique(e: React.FormEvent) {
    e.preventDefault()
    if (!formUnique.date) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projets/${projetId}/representations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'unique',
          date: formUnique.date,
          type: formUnique.type,
          showStartTime: formUnique.showStartTime || undefined,
          showEndTime: formUnique.showEndTime || undefined,
          getInTime: formUnique.getInTime || undefined,
          getOutTime: formUnique.getOutTime || undefined,
          venueName: formUnique.venueName || undefined,
          venueCity: formUnique.venueCity || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Erreur')
        return
      }
      // Recharger la liste
      await refreshReprs()
      setModalMode(null)
      setFormUnique({ date: '', type: 'REPRESENTATION', showStartTime: '', showEndTime: '', getInTime: '', getOutTime: '', venueName: '', venueCity: '' })
    } catch {
      setError('Impossible de contacter le serveur')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateSerie(e: React.FormEvent) {
    e.preventDefault()
    if (!formSerie.dateDebut || !formSerie.dateFin || formSerie.joursActifs.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projets/${projetId}/representations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'serie',
          dateDebut: formSerie.dateDebut,
          dateFin: formSerie.dateFin,
          joursActifs: formSerie.joursActifs,
          type: formSerie.type,
          showStartTime: formSerie.showStartTime || undefined,
          showEndTime: formSerie.showEndTime || undefined,
          getInTime: formSerie.getInTime || undefined,
          venueName: formSerie.venueName || undefined,
          venueCity: formSerie.venueCity || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Erreur')
        return
      }
      const d = await res.json()
      await refreshReprs()
      setModalMode(null)
      setFormSerie({ dateDebut: '', dateFin: '', joursActifs: [], type: 'REPRESENTATION', showStartTime: '', showEndTime: '', getInTime: '', venueName: '', venueCity: '' })
    } catch {
      setError('Impossible de contacter le serveur')
    } finally {
      setSaving(false)
    }
  }

  async function refreshReprs() {
    const res = await fetch(`/api/projets/${projetId}/representations`)
    if (res.ok) {
      const data = await res.json()
      onRepresentationsChange(data)
    }
  }

  return (
    <div className="p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-gray-900">
          Représentations ({representations.length})
        </h2>
        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => { setModalMode('unique'); setError(null) }}
              className="text-sm border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-800 transition-colors"
            >
              + Ajouter
            </button>
            <button
              onClick={() => { setModalMode('serie'); setError(null) }}
              className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              + Série
            </button>
          </div>
        )}
      </div>

      {/* Empty state */}
      {representations.length === 0 && (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">📅</p>
          <p className="text-gray-500 mb-2">Aucune représentation pour l'instant</p>
          {canEdit && (
            <p className="text-sm text-gray-400">
              Ajoutez une représentation unitaire ou créez une série de dates récurrentes.
            </p>
          )}
        </div>
      )}

      {/* Tableau */}
      {representations.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Heure</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Lieu</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Type</th>
                <th className="text-left px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {representations.map((rep) => {
                const sv = STATUT_VISUEL[rep.statutVisuel]
                return (
                  <tr
                    key={rep.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={(e) => {
                      setContextMenu({ repId: rep.id, x: e.clientX, y: e.clientY })
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatDate(rep.date)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      {formatTime(rep.showStartTime)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {rep.venueName
                        ? <>{rep.venueName}{rep.venueCity ? <span className="text-gray-400"> · {rep.venueCity}</span> : ''}</>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                      {TYPE_LABELS[rep.type] ?? rep.type}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${sv.className}`}>{sv.icon} {sv.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">
        ✅ Tous postes pourvus · 🟡 Postes non critiques manquants · 🔴 Poste critique manquant
      </p>

      {/* ── Menu contextuel (clic sur une ligne) ─────────── */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-40 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-48"
            style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: contextMenu.y }}
          >
            <button
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => { setContextMenu(null); onGoToPlanning(contextMenu.repId) }}
            >
              📋 Voir la grille
            </button>
            {canEdit && (
              <button
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                onClick={() => setContextMenu(null)}
              >
                ❌ Annuler / Reporter
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Modal ajout unitaire ──────────────────────────── */}
      {modalMode === 'unique' && (
        <Modal title="Nouvelle représentation" onClose={() => { if (!saving) setModalMode(null) }}>
          <form onSubmit={handleCreateUnique} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Date <span className="text-red-500">*</span></label>
                <input type="date" required value={formUnique.date}
                  onChange={(e) => setFormUnique({ ...formUnique, date: e.target.value })}
                  className="input-field" />
              </div>
              <div>
                <label className="label-field">Type</label>
                <select value={formUnique.type}
                  onChange={(e) => setFormUnique({ ...formUnique, type: e.target.value })}
                  className="input-field">
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Heure de début (Get-in)</label>
                <input type="time" value={formUnique.getInTime}
                  onChange={(e) => setFormUnique({ ...formUnique, getInTime: e.target.value })}
                  className="input-field" />
              </div>
              <div>
                <label className="label-field">Heure du show</label>
                <input type="time" value={formUnique.showStartTime}
                  onChange={(e) => setFormUnique({ ...formUnique, showStartTime: e.target.value })}
                  className="input-field" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Lieu</label>
                <input type="text" placeholder="Théâtre du Châtelet" value={formUnique.venueName}
                  onChange={(e) => setFormUnique({ ...formUnique, venueName: e.target.value })}
                  className="input-field" />
              </div>
              <div>
                <label className="label-field">Ville</label>
                <input type="text" placeholder="Paris" value={formUnique.venueCity}
                  onChange={(e) => setFormUnique({ ...formUnique, venueCity: e.target.value })}
                  className="input-field" />
              </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            <ModalActions saving={saving} onCancel={() => setModalMode(null)} label="Ajouter" />
          </form>
        </Modal>
      )}

      {/* ── Modal création en série ───────────────────────── */}
      {modalMode === 'serie' && (
        <Modal title="Créer une série de représentations" onClose={() => { if (!saving) setModalMode(null) }}>
          <form onSubmit={handleCreateSerie} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Date de début <span className="text-red-500">*</span></label>
                <input type="date" required value={formSerie.dateDebut}
                  onChange={(e) => setFormSerie({ ...formSerie, dateDebut: e.target.value })}
                  className="input-field" />
              </div>
              <div>
                <label className="label-field">Date de fin <span className="text-red-500">*</span></label>
                <input type="date" required value={formSerie.dateFin}
                  onChange={(e) => setFormSerie({ ...formSerie, dateFin: e.target.value })}
                  className="input-field" />
              </div>
            </div>

            <div>
              <label className="label-field">Jours de représentation <span className="text-red-500">*</span></label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {JOURS_SEMAINE.map((j) => (
                  <button
                    key={j.value}
                    type="button"
                    onClick={() => toggleJour(j.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      formSerie.joursActifs.includes(j.value)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {j.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Type</label>
                <select value={formSerie.type}
                  onChange={(e) => setFormSerie({ ...formSerie, type: e.target.value })}
                  className="input-field">
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="label-field">Heure du show</label>
                <input type="time" value={formSerie.showStartTime}
                  onChange={(e) => setFormSerie({ ...formSerie, showStartTime: e.target.value })}
                  className="input-field" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Lieu</label>
                <input type="text" value={formSerie.venueName}
                  onChange={(e) => setFormSerie({ ...formSerie, venueName: e.target.value })}
                  className="input-field" />
              </div>
              <div>
                <label className="label-field">Ville</label>
                <input type="text" value={formSerie.venueCity}
                  onChange={(e) => setFormSerie({ ...formSerie, venueCity: e.target.value })}
                  className="input-field" />
              </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            <ModalActions saving={saving} onCancel={() => setModalMode(null)} label="Créer la série" />
          </form>
        </Modal>
      )}
    </div>
  )
}

// ── Composants utilitaires ─────────────────────────────────
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function ModalActions({ saving, onCancel, label }: { saving: boolean; onCancel: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button type="button" onClick={onCancel} disabled={saving}
        className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
        Annuler
      </button>
      <button type="submit" disabled={saving}
        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
        {saving ? 'En cours...' : label}
      </button>
    </div>
  )
}
