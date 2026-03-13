'use client'
// ─────────────────────────────────────────────────────────
// Onglet Planning — Grille d'affectation
// doc/04 §6.3 — Grille régisseur (colonnes = dates, lignes = postes)
// doc/06 Règles #2 (conflit), #3 (DPAE), #14 (confirmationStatus)
// SSE : doc/23 §23.6
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Equipe, Collaborateur } from '../ProjetDetailClient'

type Props = {
  projetId: string
  projetColorCode: string
  equipes: Equipe[]
  collaborateurs: Collaborateur[]
  canEdit: boolean
}

// ── Types API planning ─────────────────────────────────────
type RepresentationGrille = {
  id: string
  date: string
  type: string
  status: string
  showStartTime: string | null
  venueName: string | null
  venueCity: string | null
}

type AffectationGrille = {
  id: string
  collaborateurId: string
  confirmationStatus: string
  contractTypeUsed: string
  startTime: string
  endTime: string
  hasConflict: boolean
  dpaeStatus: string
  collaborateur: {
    user: { id: string; firstName: string; lastName: string; avatarUrl: string | null }
  }
}

type CelluleGrille = {
  representationId: string
  affectations: AffectationGrille[]
  manquants: number
  statut: 'COMPLET' | 'INCOMPLET' | 'CRITIQUE'
}

type PosteGrille = {
  id: string
  name: string
  requiredCount: number
  isCritique: boolean
  contractTypePreference: string
  defaultStartTime: string | null
  defaultEndTime: string | null
  cellules: CelluleGrille[]
}

type EquipeGrille = {
  id: string
  name: string
  icon: string | null
  color: string | null
  chef: { id: string; firstName: string; lastName: string } | null
  postes: PosteGrille[]
}

type GrilleData = {
  projetId: string
  representations: RepresentationGrille[]
  equipes: EquipeGrille[]
}

// ── Légende couleurs contrat ───────────────────────────────
const CONTRACT_COLORS: Record<string, string> = {
  CDI:         'bg-blue-100 text-blue-800 border-blue-200',
  CDD:         'bg-yellow-100 text-yellow-800 border-yellow-200',
  INTERMITTENT:'bg-orange-100 text-orange-800 border-orange-200',
}

const CONFIRM_BADGE: Record<string, string> = {
  CONFIRMEE:    '🔵', // CDI/CDD = non requis donc bleu aussi
  EN_ATTENTE:   '🟠',
  REFUSEE:      '❌',
  NON_REQUISE:  '',   // CDI/CDD — pas de badge
}

function formatDateCourte(iso: string): string {
  const d = new Date(iso)
  const jour = d.toLocaleDateString('fr-FR', { weekday: 'short' })
  const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  return `${jour}\n${date}`
}

function formatTime(t: string | null): string {
  return t ? t.replace(':', 'h') : ''
}

// ── Composant principal ────────────────────────────────────
export function OngletPlanning({ projetId, projetColorCode, equipes, collaborateurs, canEdit }: Props) {
  const [grille, setGrille] = useState<GrilleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [equipeFiltre, setEquipeFiltre] = useState<string>('')
  const [monthFiltre, setMonthFiltre] = useState<string>('')

  // Modal affectation
  const [modalCell, setModalCell] = useState<{ posteId: string; representationId: string; posteName: string } | null>(null)
  const [formAff, setFormAff] = useState({
    collaborateurId: '',
    contractTypeUsed: 'INTERMITTENT' as 'CDI' | 'CDD' | 'INTERMITTENT',
    remuneration: '',
    heuresContrat: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // SSE — mises à jour temps réel
  const sseRef = useRef<EventSource | null>(null)

  const fetchGrille = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (monthFiltre) params.set('month', monthFiltre)
      if (equipeFiltre) params.set('equipeId', equipeFiltre)
      const res = await fetch(`/api/planning/${projetId}?${params.toString()}`)
      if (!res.ok) throw new Error('Erreur serveur')
      const data = await res.json()
      setGrille(data)
    } catch {
      setError('Impossible de charger la grille')
    } finally {
      setLoading(false)
    }
  }, [projetId, monthFiltre, equipeFiltre])

  // Charger la grille au montage + changement de filtres
  useEffect(() => {
    fetchGrille()
  }, [fetchGrille])

  // Connexion SSE pour les mises à jour temps réel
  useEffect(() => {
    const sse = new EventSource(`/api/planning/${projetId}/stream`)
    sseRef.current = sse

    sse.addEventListener('affectation_created', () => { fetchGrille() })
    sse.addEventListener('affectation_updated', () => { fetchGrille() })
    sse.addEventListener('affectation_deleted', () => { fetchGrille() })

    return () => {
      sse.close()
      sseRef.current = null
    }
  }, [projetId, fetchGrille])

  async function handleAffectation(e: React.FormEvent) {
    e.preventDefault()
    if (!modalCell || !formAff.collaborateurId) return
    setSaving(true)
    setSaveError(null)

    // Trouver le Collaborateur record pour l'userId sélectionné
    const collab = collaborateurs.find((c) => c.id === formAff.collaborateurId)
    if (!collab) { setSaveError('Collaborateur introuvable'); setSaving(false); return }

    try {
      const res = await fetch('/api/affectations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collaborateurId: formAff.collaborateurId,
          representationId: modalCell.representationId,
          posteRequisId: modalCell.posteId,
          contractTypeUsed: formAff.contractTypeUsed,
          remuneration: formAff.remuneration ? Math.round(parseFloat(formAff.remuneration) * 100) : undefined,
          heuresContrat: formAff.heuresContrat ? parseInt(formAff.heuresContrat) : undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setSaveError(d.error ?? 'Erreur lors de l\'affectation')
        return
      }
      // SSE rafraîchira automatiquement la grille
      setModalCell(null)
      setFormAff({ collaborateurId: '', contractTypeUsed: 'INTERMITTENT', remuneration: '', heuresContrat: '' })
    } catch {
      setSaveError('Serveur inaccessible')
    } finally {
      setSaving(false)
    }
  }

  // ── Filtres disponibles ────────────────────────────────
  const moisDisponibles = grille
    ? Array.from(new Set(grille.representations.map((r) => r.date.slice(0, 7)))).sort()
    : []

  const equipesAffiches = grille
    ? (equipeFiltre ? grille.equipes.filter((e) => e.id === equipeFiltre) : grille.equipes)
    : []

  // ── Render ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Chargement de la grille...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <p className="text-red-500 mb-3">⚠️ {error}</p>
          <button onClick={fetchGrille} className="text-sm text-indigo-600 hover:underline">Réessayer</button>
        </div>
      </div>
    )
  }

  if (!grille || grille.representations.length === 0) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-3xl mb-3">📋</p>
        <p className="text-gray-500">Aucune représentation à afficher</p>
        <p className="text-sm text-gray-400 mt-1">Ajoutez d'abord des représentations dans l'onglet "Représentations".</p>
      </div>
    )
  }

  if (grille.equipes.length === 0) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-3xl mb-3">👥</p>
        <p className="text-gray-500">Aucune équipe avec des postes définis</p>
        <p className="text-sm text-gray-400 mt-1">Configurez vos équipes et postes dans l'onglet "Équipe & Postes".</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Filtres ─────────────────────────────────────── */}
      <div className="px-6 py-3 border-b border-gray-100 bg-white flex items-center gap-3 flex-wrap sticky top-0 z-10">
        <select
          value={equipeFiltre}
          onChange={(e) => setEquipeFiltre(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">Toutes les équipes</option>
          {grille.equipes.map((e) => (
            <option key={e.id} value={e.id}>{e.icon ?? ''} {e.name}</option>
          ))}
        </select>

        {moisDisponibles.length > 1 && (
          <select
            value={monthFiltre}
            onChange={(e) => setMonthFiltre(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">Tous les mois</option>
            {moisDisponibles.map((m) => {
              const [y, mo] = m.split('-')
              const label = new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
              return <option key={m} value={m}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>
            })}
          </select>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {grille.representations.length} dates · mis à jour en temps réel
        </span>
      </div>

      {/* ── Grille (scroll horizontal) ───────────────────── */}
      <div className="flex-1 overflow-auto p-4">
        <div className="inline-block min-w-full">
          <table className="border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                {/* Colonne poste (sticky) */}
                <th className="sticky left-0 z-20 bg-white min-w-48 px-4 py-3 border-b-2 border-r border-gray-200 text-left text-gray-500 uppercase tracking-wide font-medium">
                  Poste
                </th>
                {/* Colonnes représentations */}
                {grille.representations.map((rep) => {
                  const parts = formatDateCourte(rep.date).split('\n')
                  return (
                    <th
                      key={rep.id}
                      className="min-w-28 px-2 py-2 border-b-2 border-r border-gray-100 text-center"
                    >
                      <div className="font-medium text-gray-500 capitalize">{parts[0]}</div>
                      <div className="font-bold text-gray-900">{parts[1]}</div>
                      {rep.showStartTime && (
                        <div className="text-gray-400 font-normal">{formatTime(rep.showStartTime)}</div>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {equipesAffiches.map((equipe) => (
                <>
                  {/* Ligne header équipe */}
                  <tr key={`header-${equipe.id}`}>
                    <td
                      colSpan={grille!.representations.length + 1}
                      className="sticky left-0 px-4 py-2 bg-gray-50 border-y border-gray-200 font-semibold text-gray-700"
                    >
                      {equipe.icon && <span className="mr-1.5">{equipe.icon}</span>}
                      {equipe.name}
                      {equipe.chef && (
                        <span className="ml-3 text-xs text-gray-400 font-normal">
                          Chef : {equipe.chef.firstName} {equipe.chef.lastName}
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Lignes postes */}
                  {equipe.postes.map((poste) => (
                    Array.from({ length: poste.requiredCount }).map((_, slotIdx) => (
                      <tr
                        key={`${poste.id}-slot-${slotIdx}`}
                        className={slotIdx === 0 ? 'border-t border-gray-50' : ''}
                      >
                        {/* Label poste (seulement sur le premier slot) */}
                        <td className="sticky left-0 z-10 bg-white border-r border-gray-100 px-4 py-1.5">
                          {slotIdx === 0 ? (
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-800">{poste.name}</span>
                              <span className="text-gray-400">({poste.requiredCount})</span>
                              {poste.isCritique && <span title="Poste critique" className="text-red-500 text-xs">🔴</span>}
                            </div>
                          ) : null}
                        </td>

                        {/* Cellules par représentation */}
                        {poste.cellules.map((cell) => {
                          const aff = cell.affectations[slotIdx]
                          const isManquant = slotIdx >= cell.affectations.length

                          return (
                            <td
                              key={`${cell.representationId}-${slotIdx}`}
                              className="border-r border-b border-gray-50 px-1.5 py-1 min-w-28 align-top"
                            >
                              {aff ? (
                                // Collaborateur affecté
                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs ${CONTRACT_COLORS[aff.contractTypeUsed] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                  <span className="font-medium truncate max-w-20">
                                    {aff.collaborateur.user.firstName} {aff.collaborateur.user.lastName.charAt(0)}.
                                  </span>
                                  {aff.hasConflict && <span title="Conflit horaire">⚠️</span>}
                                  <span className="ml-auto">{CONFIRM_BADGE[aff.confirmationStatus] ?? ''}</span>
                                </div>
                              ) : isManquant && canEdit ? (
                                // Poste vide — bouton affecter
                                <button
                                  onClick={() => {
                                    setModalCell({
                                      posteId: poste.id,
                                      representationId: cell.representationId,
                                      posteName: poste.name,
                                    })
                                    setSaveError(null)
                                    setFormAff({ collaborateurId: '', contractTypeUsed: 'INTERMITTENT', remuneration: '', heuresContrat: '' })
                                  }}
                                  className={`w-full text-center px-2 py-1 rounded-md border text-xs font-medium transition-colors ${
                                    poste.isCritique
                                      ? 'border-red-200 text-red-500 hover:bg-red-50'
                                      : 'border-gray-200 text-gray-400 hover:bg-gray-50 hover:border-gray-300'
                                  }`}
                                >
                                  {poste.isCritique ? '🔴 +' : '[+]'}
                                </button>
                              ) : isManquant ? (
                                <div className={`text-center px-2 py-1 text-xs rounded-md ${poste.isCritique ? 'text-red-400' : 'text-gray-300'}`}>
                                  {poste.isCritique ? '🔴' : '—'}
                                </div>
                              ) : null}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Légende */}
        <div className="mt-4 flex items-center gap-6 text-xs text-gray-400 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded bg-blue-100 border border-blue-200" /> CDI
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded bg-yellow-100 border border-yellow-200" /> CDD
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded bg-orange-100 border border-orange-200" /> Intermittent
          </span>
          <span>🔵 Confirmé · 🟠 En attente · ❌ Refusé · ⚠️ Conflit horaire</span>
        </div>
      </div>

      {/* ── Modal affecter un collaborateur ─────────────── */}
      {modalCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (!saving) setModalCell(null) }} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Affecter un collaborateur</h2>
                <p className="text-sm text-gray-400 mt-0.5">Poste : {modalCell.posteName}</p>
              </div>
              <button onClick={() => setModalCell(null)} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
            </div>
            <form onSubmit={handleAffectation} className="px-6 py-5 space-y-4">
              <div>
                <label className="label-field">Collaborateur <span className="text-red-500">*</span></label>
                <select required value={formAff.collaborateurId}
                  onChange={(e) => setFormAff({ ...formAff, collaborateurId: e.target.value })}
                  className="input-field">
                  <option value="">— Choisir —</option>
                  {collaborateurs.map((c) => (
                    <option key={c.id} value={c.id}>{c.nom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-field">Type de contrat <span className="text-red-500">*</span></label>
                <select value={formAff.contractTypeUsed}
                  onChange={(e) => setFormAff({ ...formAff, contractTypeUsed: e.target.value as 'CDI' | 'CDD' | 'INTERMITTENT' })}
                  className="input-field">
                  <option value="INTERMITTENT">Intermittent 🟠</option>
                  <option value="CDI">CDI 🔵</option>
                  <option value="CDD">CDD 🟡</option>
                </select>
                {formAff.contractTypeUsed === 'INTERMITTENT' && (
                  <p className="text-xs text-orange-600 mt-1">
                    → Un email de confirmation sera envoyé. DPAE générée automatiquement. (Règles #3, #14)
                  </p>
                )}
                {formAff.contractTypeUsed === 'CDD' && (
                  <p className="text-xs text-yellow-600 mt-1">
                    → Confirmation non requise. DPAE générée automatiquement. (Règle #3)
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Rémunération (€)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00"
                    value={formAff.remuneration}
                    onChange={(e) => setFormAff({ ...formAff, remuneration: e.target.value })}
                    className="input-field" />
                </div>
                {formAff.contractTypeUsed !== 'CDI' && (
                  <div>
                    <label className="label-field">Heures déclarées</label>
                    <input type="number" min="0" placeholder="Ex: 8"
                      value={formAff.heuresContrat}
                      onChange={(e) => setFormAff({ ...formAff, heuresContrat: e.target.value })}
                      className="input-field" />
                  </div>
                )}
              </div>

              {saveError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalCell(null)} disabled={saving}
                  className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
                  Annuler
                </button>
                <button type="submit" disabled={saving || !formAff.collaborateurId}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
                  {saving ? 'Affectation...' : 'Affecter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
