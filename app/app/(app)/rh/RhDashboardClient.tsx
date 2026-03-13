'use client'
// ─────────────────────────────────────────────────────────
// RhDashboardClient — Dashboard RH interactif
// doc/06 Règles #3, #9, #11
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import type { DpaeItem } from '@/app/api/rh/route'

// ── Types ──────────────────────────────────────────────────
type DpaeGrouped = {
  aFaire: DpaeItem[]
  envoyee: DpaeItem[]
  confirmee: DpaeItem[]
}

type Onglet = 'aFaire' | 'envoyee' | 'confirmee'

const ONGLET_LABELS: Record<Onglet, string> = {
  aFaire:    'À faire',
  envoyee:   'Envoyée',
  confirmee: 'Confirmée',
}

const ONGLET_COLORS: Record<Onglet, string> = {
  aFaire:    'text-red-700 bg-red-100',
  envoyee:   'text-amber-700 bg-amber-100',
  confirmee: 'text-green-700 bg-green-100',
}

const CONTRACT_LABELS: Record<string, string> = {
  CDI:          'CDI',
  CDD:          'CDD',
  INTERMITTENT: 'Intermittent',
}

// ── Props ──────────────────────────────────────────────────
type Props = {
  canExportCsv: boolean
  organizationPlan: string
}

// ── Composant principal ────────────────────────────────────
export function RhDashboardClient({ canExportCsv, organizationPlan }: Props) {
  const [data, setData] = useState<DpaeGrouped | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [ongletActif, setOngletActif] = useState<Onglet>('aFaire')
  const [actionEnCours, setActionEnCours] = useState<string | null>(null)
  const [erreurAction, setErreurAction] = useState<string | null>(null)
  const [exportEnCours, setExportEnCours] = useState(false)

  // ── Chargement initial ─────────────────────────────────────
  const charger = useCallback(async () => {
    setLoading(true)
    setErreur(null)
    try {
      const res = await fetch('/api/rh')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Erreur lors du chargement des DPAE')
      }
      const json: DpaeGrouped = await res.json()
      setData(json)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    charger()
  }, [charger])

  // ── Action : changer le statut DPAE ───────────────────────
  async function changerStatut(
    affectationId: string,
    nouveauStatut: 'ENVOYEE' | 'CONFIRMEE'
  ) {
    setActionEnCours(affectationId)
    setErreurAction(null)
    try {
      const res = await fetch(`/api/rh/${affectationId}/dpae`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dpaeStatus: nouveauStatut }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setErreurAction(body.error ?? 'Erreur lors de la mise à jour')
        return
      }
      // Recharger les données
      await charger()
    } catch {
      setErreurAction('Impossible de contacter le serveur')
    } finally {
      setActionEnCours(null)
    }
  }

  // ── Export CSV ─────────────────────────────────────────────
  async function exporterCsv() {
    if (!canExportCsv) return
    setExportEnCours(true)
    try {
      const res = await fetch('/api/rh/export-csv')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setErreurAction(body.error ?? 'Erreur lors de l\'export')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const today = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `export-paie-${today}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setErreurAction('Impossible de générer l\'export')
    } finally {
      setExportEnCours(false)
    }
  }

  // ── Données de l'onglet actif ──────────────────────────────
  const itemsActifs: DpaeItem[] = data ? data[ongletActif] : []
  const compteurs = data
    ? { aFaire: data.aFaire.length, envoyee: data.envoyee.length, confirmee: data.confirmee.length }
    : { aFaire: 0, envoyee: 0, confirmee: 0 }

  // ── Rendu ──────────────────────────────────────────────────
  return (
    <div className="p-6">
      {/* ── En-tête ───────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard RH</h1>
          <p className="text-sm text-gray-500 mt-1">Gestion des DPAE — Déclarations Préalables à l'Embauche</p>
        </div>

        {/* Bouton Export CSV */}
        <div className="relative group">
          <button
            onClick={exporterCsv}
            disabled={!canExportCsv || exportEnCours}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors ${
              canExportCsv
                ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {exportEnCours ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Export en cours...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Exporter CSV
              </>
            )}
          </button>
          {/* Tooltip plan FREE */}
          {!canExportCsv && (
            <div className="absolute right-0 top-full mt-2 w-56 z-10 hidden group-hover:block">
              <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
                Disponible à partir du plan PRO.{' '}
                <a href="/settings/organisation#facturation" className="underline">
                  Passer au plan supérieur
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Message d'erreur action ────────────────────────── */}
      {erreurAction && (
        <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <span className="text-red-500 flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </span>
          <p className="text-sm text-red-700 flex-1">{erreurAction}</p>
          <button
            onClick={() => setErreurAction(null)}
            className="text-red-400 hover:text-red-600 flex-shrink-0"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Onglets ────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200 mb-6">
        {(Object.keys(ONGLET_LABELS) as Onglet[]).map((onglet) => (
          <button
            key={onglet}
            onClick={() => { setOngletActif(onglet); setErreurAction(null) }}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              ongletActif === onglet
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {ONGLET_LABELS[onglet]}
            {!loading && (
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold ${
                  ongletActif === onglet ? ONGLET_COLORS[onglet] : 'text-gray-500 bg-gray-100'
                }`}
              >
                {compteurs[onglet]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── État de chargement ─────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-gray-400">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">Chargement des DPAE...</span>
          </div>
        </div>
      )}

      {/* ── Erreur de chargement ───────────────────────────── */}
      {!loading && erreur && (
        <div className="text-center py-20">
          <p className="text-sm text-red-600 mb-4">{erreur}</p>
          <button
            onClick={charger}
            className="text-sm text-indigo-600 hover:underline"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* ── Tableau ────────────────────────────────────────── */}
      {!loading && !erreur && data && (
        <>
          {itemsActifs.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">
                {ongletActif === 'confirmee' ? '✓' : ongletActif === 'envoyee' ? '📤' : '📋'}
              </p>
              <h2 className="text-base font-medium text-gray-700 mb-1">
                Aucune DPAE &laquo;{ONGLET_LABELS[ongletActif]}&raquo;
              </h2>
              <p className="text-sm text-gray-400">
                {ongletActif === 'aFaire'
                  ? 'Toutes les DPAE ont été envoyées ou confirmées.'
                  : ongletActif === 'envoyee'
                  ? 'Aucune DPAE en attente de confirmation.'
                  : 'Aucune DPAE confirmée pour l\'instant.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                    <th className="text-left px-4 py-3">Collaborateur</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Type</th>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Représentation</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Projet</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Poste</th>
                    <th className="text-left px-4 py-3 hidden xl:table-cell">Cachet HT</th>
                    <th className="text-right px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {itemsActifs.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      {/* Collaborateur */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{item.collaborateurNom}</p>
                        <p className="text-xs text-gray-400 truncate max-w-40">{item.email}</p>
                      </td>

                      {/* Type contrat */}
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          item.contractType === 'INTERMITTENT'
                            ? 'text-purple-700 bg-purple-50'
                            : 'text-blue-700 bg-blue-50'
                        }`}>
                          {CONTRACT_LABELS[item.contractType] ?? item.contractType}
                        </span>
                      </td>

                      {/* Date de la représentation */}
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(item.representationDate).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Type représentation + lieu */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-gray-700 capitalize text-xs">
                          {item.representationTitre.toLowerCase().replace(/_/g, ' ')}
                        </p>
                        {item.venueName && (
                          <p className="text-xs text-gray-400 truncate max-w-32">{item.venueName}</p>
                        )}
                      </td>

                      {/* Projet */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <p className="text-gray-700 font-medium text-xs truncate max-w-36">{item.projetTitre}</p>
                      </td>

                      {/* Poste */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <p className="text-gray-600 text-xs truncate max-w-28">{item.posteLabel}</p>
                      </td>

                      {/* Cachet HT */}
                      <td className="px-4 py-3 hidden xl:table-cell text-gray-700">
                        {item.cachetHT !== null && item.cachetHT !== undefined
                          ? `${(item.cachetHT / 100).toFixed(2).replace('.', ',')} €`
                          : <span className="text-gray-400">—</span>
                        }
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {ongletActif === 'aFaire' && (
                          <button
                            onClick={() => changerStatut(item.id, 'ENVOYEE')}
                            disabled={actionEnCours === item.id}
                            className="inline-flex items-center gap-1.5 text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {actionEnCours === item.id ? (
                              <>
                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                En cours...
                              </>
                            ) : (
                              'Marquer envoyée'
                            )}
                          </button>
                        )}

                        {ongletActif === 'envoyee' && (
                          <button
                            onClick={() => changerStatut(item.id, 'CONFIRMEE')}
                            disabled={actionEnCours === item.id}
                            className="inline-flex items-center gap-1.5 text-xs font-medium bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {actionEnCours === item.id ? (
                              <>
                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                En cours...
                              </>
                            ) : (
                              'Marquer confirmée'
                            )}
                          </button>
                        )}

                        {ongletActif === 'confirmee' && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Confirmée
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pied de tableau — récapitulatif */}
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  {itemsActifs.length} DPAE &laquo;{ONGLET_LABELS[ongletActif]}&raquo;
                </p>
                {!canExportCsv && (
                  <p className="text-xs text-gray-400">
                    Plan {organizationPlan} ·{' '}
                    <a href="/settings/organisation#facturation" className="text-indigo-500 hover:underline">
                      Passer au plan PRO pour exporter
                    </a>
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
