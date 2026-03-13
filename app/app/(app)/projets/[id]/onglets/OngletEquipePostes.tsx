'use client'
// ─────────────────────────────────────────────────────────
// Onglet Équipe & Postes — structure équipes, postes, isCritique
// doc/04 §6.3 — Onglet Équipe & Postes
// doc/03 §5.4
// ─────────────────────────────────────────────────────────
import { useState } from 'react'
import type { Equipe, MembreOrg, Collaborateur } from '../ProjetDetailClient'

type Props = {
  projetId: string
  equipes: Equipe[]
  membresOrg: MembreOrg[]
  collaborateurs: Collaborateur[]
  canEdit: boolean
  onEquipesChange: (equipes: Equipe[]) => void
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  CDI: 'CDI', CDD: 'CDD', INTERMITTENT: 'Intermittent', INDIFFERENT: 'Indifférent',
}

export function OngletEquipePostes({ projetId, equipes, membresOrg, collaborateurs, canEdit, onEquipesChange }: Props) {
  const [modalEquipe, setModalEquipe] = useState(false)
  const [modalPoste, setModalPoste] = useState<{ equipeId: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formEquipe, setFormEquipe] = useState({ name: '', icon: '', chefUserId: '' })
  const [formPoste, setFormPoste] = useState({
    name: '',
    requiredCount: 1,
    isCritique: false,
    contractTypePreference: 'INDIFFERENT',
    defaultStartTime: '',
    defaultEndTime: '',
  })

  async function refreshEquipes() {
    const res = await fetch(`/api/projets/${projetId}/equipes`)
    if (res.ok) {
      const data = await res.json()
      onEquipesChange(data.map((e: Equipe) => ({
        ...e,
        chef: e.membres.find((m) => m.role === 'CHEF')?.user ?? null,
      })))
    }
  }

  async function handleCreateEquipe(evt: React.FormEvent) {
    evt.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projets/${projetId}/equipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formEquipe.name.trim(),
          icon: formEquipe.icon || undefined,
          chefUserId: formEquipe.chefUserId || undefined,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erreur'); return }
      await refreshEquipes()
      setModalEquipe(false)
      setFormEquipe({ name: '', icon: '', chefUserId: '' })
    } catch { setError('Serveur inaccessible') }
    finally { setSaving(false) }
  }

  async function handleCreatePoste(evt: React.FormEvent) {
    evt.preventDefault()
    if (!modalPoste) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projets/${projetId}/equipes/${modalPoste.equipeId}/postes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formPoste.name.trim(),
          requiredCount: formPoste.requiredCount,
          isCritique: formPoste.isCritique,
          contractTypePreference: formPoste.contractTypePreference,
          defaultStartTime: formPoste.defaultStartTime || undefined,
          defaultEndTime: formPoste.defaultEndTime || undefined,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erreur'); return }
      await refreshEquipes()
      setModalPoste(null)
      setFormPoste({ name: '', requiredCount: 1, isCritique: false, contractTypePreference: 'INDIFFERENT', defaultStartTime: '', defaultEndTime: '' })
    } catch { setError('Serveur inaccessible') }
    finally { setSaving(false) }
  }

  return (
    <div className="p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-gray-900">
          Équipe & Postes
        </h2>
        {canEdit && (
          <button
            onClick={() => { setModalEquipe(true); setError(null) }}
            className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            + Nouvelle équipe
          </button>
        )}
      </div>

      {/* Empty state */}
      {equipes.length === 0 && (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">👥</p>
          <p className="text-gray-500 mb-2">Aucune équipe configurée</p>
          {canEdit && (
            <p className="text-sm text-gray-400">Créez vos équipes (Technique, Salle, Billetterie…) et définissez les postes requis.</p>
          )}
        </div>
      )}

      {/* Liste des équipes */}
      <div className="space-y-6">
        {equipes.map((equipe) => (
          <div key={equipe.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header équipe */}
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                {equipe.icon && <span className="text-lg">{equipe.icon}</span>}
                <div>
                  <h3 className="font-semibold text-gray-900">{equipe.name}</h3>
                  {equipe.chef && (
                    <p className="text-xs text-gray-500">
                      Chef : {equipe.chef.firstName} {equipe.chef.lastName}
                    </p>
                  )}
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={() => { setModalPoste({ equipeId: equipe.id }); setError(null) }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 px-2.5 py-1 rounded-lg hover:border-indigo-300 transition-colors"
                >
                  + Ajouter un poste
                </button>
              )}
            </div>

            {/* Postes */}
            {equipe.postesRequis.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400">Aucun poste défini</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-5 py-2.5">Poste</th>
                    <th className="text-center px-3 py-2.5">Requis</th>
                    <th className="text-center px-3 py-2.5">Critique</th>
                    <th className="text-left px-3 py-2.5 hidden md:table-cell">Type contrat</th>
                    <th className="text-left px-3 py-2.5 hidden lg:table-cell">Horaires défaut</th>
                    <th className="text-right px-5 py-2.5 hidden sm:table-cell">Affectations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {equipe.postesRequis.map((poste) => (
                    <tr key={poste.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <span className="font-medium text-gray-900">{poste.name}</span>
                      </td>
                      <td className="px-3 py-3 text-center text-gray-600">{poste.requiredCount}</td>
                      <td className="px-3 py-3 text-center">
                        {poste.isCritique ? (
                          <span className="text-red-500 font-bold" title="Poste critique — 🔴 si non pourvu">☑</span>
                        ) : (
                          <span className="text-gray-300">☐</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-500 hidden md:table-cell">
                        {CONTRACT_TYPE_LABELS[poste.contractTypePreference] ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-gray-400 hidden lg:table-cell text-xs">
                        {poste.defaultStartTime && poste.defaultEndTime
                          ? `${poste.defaultStartTime} → ${poste.defaultEndTime}`
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-right hidden sm:table-cell">
                        <span className={`text-sm font-medium ${poste.affectationsCount >= poste.requiredCount ? 'text-green-600' : 'text-orange-600'}`}>
                          {poste.affectationsCount}/{poste.requiredCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>

      {/* ── Modal nouvelle équipe ─────────────────────────── */}
      {modalEquipe && (
        <ModalWrap title="Nouvelle équipe" onClose={() => { if (!saving) { setModalEquipe(false); setError(null) } }}>
          <form onSubmit={handleCreateEquipe} className="space-y-4">
            <div>
              <label className="label-field">Nom de l'équipe <span className="text-red-500">*</span></label>
              <input required type="text" placeholder="Ex: Technique, Salle, Billetterie..."
                value={formEquipe.name}
                onChange={(e) => setFormEquipe({ ...formEquipe, name: e.target.value })}
                className="input-field" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Icône <span className="text-gray-400 font-normal">(facultatif)</span></label>
                <input type="text" placeholder="🔧" maxLength={4}
                  value={formEquipe.icon}
                  onChange={(e) => setFormEquipe({ ...formEquipe, icon: e.target.value })}
                  className="input-field" />
              </div>
              <div>
                <label className="label-field">Chef de poste <span className="text-gray-400 font-normal">(facultatif)</span></label>
                <select value={formEquipe.chefUserId}
                  onChange={(e) => setFormEquipe({ ...formEquipe, chefUserId: e.target.value })}
                  className="input-field">
                  <option value="">— Choisir —</option>
                  {membresOrg.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.nom}</option>
                  ))}
                </select>
              </div>
            </div>
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <ModalActions saving={saving} onCancel={() => { setModalEquipe(false); setError(null) }} label="Créer l'équipe" />
          </form>
        </ModalWrap>
      )}

      {/* ── Modal nouveau poste ───────────────────────────── */}
      {modalPoste && (
        <ModalWrap title="Nouveau poste" onClose={() => { if (!saving) { setModalPoste(null); setError(null) } }}>
          <form onSubmit={handleCreatePoste} className="space-y-4">
            <div>
              <label className="label-field">Intitulé du poste <span className="text-red-500">*</span></label>
              <input required type="text" placeholder="Ex: Machiniste, Régisseur son..."
                value={formPoste.name}
                onChange={(e) => setFormPoste({ ...formPoste, name: e.target.value })}
                className="input-field" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Nombre requis <span className="text-red-500">*</span></label>
                <input required type="number" min={1} max={99}
                  value={formPoste.requiredCount}
                  onChange={(e) => setFormPoste({ ...formPoste, requiredCount: parseInt(e.target.value) || 1 })}
                  className="input-field" />
              </div>
              <div>
                <label className="label-field">Type contrat préféré</label>
                <select value={formPoste.contractTypePreference}
                  onChange={(e) => setFormPoste({ ...formPoste, contractTypePreference: e.target.value })}
                  className="input-field">
                  {Object.entries(CONTRACT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formPoste.isCritique}
                  onChange={(e) => setFormPoste({ ...formPoste, isCritique: e.target.checked })}
                  className="w-4 h-4 text-red-500 rounded border-gray-300 focus:ring-red-400" />
                <span className="text-sm text-gray-700 font-medium">
                  Poste critique 🔴
                </span>
              </label>
              <p className="text-xs text-gray-400 ml-6 mt-0.5">
                Si non pourvu → représentation marquée 🔴 sur le planning global (Règle #33)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Heure début (défaut)</label>
                <input type="time" value={formPoste.defaultStartTime}
                  onChange={(e) => setFormPoste({ ...formPoste, defaultStartTime: e.target.value })}
                  className="input-field" />
              </div>
              <div>
                <label className="label-field">Heure fin (défaut)</label>
                <input type="time" value={formPoste.defaultEndTime}
                  onChange={(e) => setFormPoste({ ...formPoste, defaultEndTime: e.target.value })}
                  className="input-field" />
              </div>
            </div>

            {error && <ErrorMsg>{error}</ErrorMsg>}
            <ModalActions saving={saving} onCancel={() => { setModalPoste(null); setError(null) }} label="Ajouter le poste" />
          </form>
        </ModalWrap>
      )}
    </div>
  )
}

function ModalWrap({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
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
        className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">Annuler</button>
      <button type="submit" disabled={saving}
        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
        {saving ? 'En cours...' : label}
      </button>
    </div>
  )
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{children}</p>
}
