'use client'

// ─────────────────────────────────────────────────────────
// AnnulationsClient — Page RH suivi cachets & annulations
// doc §12.6 — Annulations & Reports
// ─────────────────────────────────────────────────────────
import { useState, useTransition } from 'react'
import Link from 'next/link'

type Affectation = {
  id: string
  collaborateurNom: string
  contractType: string
  poste: string
  cachet: number | null
  confirmationStatus: string
  cachetAnnulation: string | null
  annulationRaison: string | null
  dpaeStatus: string | null
}

type GroupeRepresentation = {
  representationId: string
  date: string
  venueName: string | null
  venueCity: string | null
  annulationReason: string | null
  annulationAt: string | null
  affectations: Affectation[]
}

type Projet = {
  id: string
  title: string
  status: string
  type: string
  color: string
}

type Props = {
  projet: Projet
  groupes: GroupeRepresentation[]
  totalCachetsADecider: number
}

const DPAE_LABELS: Record<string, string> = {
  A_FAIRE: 'À faire',
  ENVOYEE: 'Soumise',
  CONFIRMEE: 'Confirmée',
  NON_REQUISE: 'N/A',
}

const CACHET_LABELS: Record<string, string> = {
  A_DECIDER: 'À décider',
  DU: 'Cachet dû',
  ANNULE: 'Cachet annulé',
}

export function AnnulationsClient({ projet, groupes, totalCachetsADecider }: Props) {
  const [isPending, startTransition] = useTransition()
  const [decisions, setDecisions] = useState<Record<string, string | null>>(
    Object.fromEntries(
      groupes.flatMap((g) =>
        g.affectations.map((a) => [a.id, a.cachetAnnulation])
      )
    )
  )
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  async function trancherCachet(affectationId: string, decision: 'DU' | 'ANNULE') {
    setLoading((prev) => ({ ...prev, [affectationId]: true }))
    try {
      const res = await fetch(`/api/affectations/${affectationId}/cachet`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      if (res.ok) {
        setDecisions((prev) => ({ ...prev, [affectationId]: decision }))
      }
    } finally {
      setLoading((prev) => ({ ...prev, [affectationId]: false }))
    }
  }

  const totalGroupes = groupes.length
  const totalAffectations = groupes.reduce((sum, g) => sum + g.affectations.length, 0)
  const nbADecider = groupes.reduce(
    (sum, g) => sum + g.affectations.filter((a) => decisions[a.id] === 'A_DECIDER').length,
    0
  )

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href={`/projets/${projet.id}`} className="hover:underline">
              {projet.title}
            </Link>
            <span>›</span>
            <span>Annulations</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Annulations & Cachets
          </h1>
        </div>

        <a
          href={`/api/projets/${projet.id}/annulations/export`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ⬇ Exporter CSV
        </a>
      </div>

      {/* Bandeau résumé */}
      {totalAffectations === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-gray-500 text-lg">Aucune annulation sur ce projet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Dates annulées</p>
              <p className="text-2xl font-bold text-gray-900">{totalGroupes}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-500">Affectations annulées</p>
              <p className="text-2xl font-bold text-gray-900">{totalAffectations}</p>
            </div>
            <div className={`border rounded-xl p-4 ${nbADecider > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
              <p className="text-sm text-gray-500">Cachets à décider</p>
              <p className={`text-2xl font-bold ${nbADecider > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                {nbADecider}
              </p>
              {totalCachetsADecider > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Total : {totalCachetsADecider.toFixed(2)} €
                </p>
              )}
            </div>
          </div>

          {/* Groupes par représentation */}
          <div className="space-y-4">
            {groupes.map((groupe) => {
              const dateFormatted = new Date(groupe.date).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })

              const nbDpaesSoumises = groupe.affectations.filter(
                (a) => a.dpaeStatus === 'ENVOYEE' || a.dpaeStatus === 'CONFIRMEE'
              ).length

              return (
                <div key={groupe.representationId} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {/* En-tête représentation */}
                  <div className="bg-red-50 border-b border-red-100 px-5 py-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-red-800">
                          ❌ {dateFormatted}
                          {groupe.venueName && ` — ${groupe.venueName}`}
                          {groupe.venueCity && `, ${groupe.venueCity}`}
                        </p>
                        {groupe.annulationReason && (
                          <p className="text-sm text-red-600 mt-0.5">
                            Raison : &quot;{groupe.annulationReason}&quot;
                          </p>
                        )}
                        {groupe.annulationAt && (
                          <p className="text-xs text-red-500 mt-0.5">
                            Annulée le {new Date(groupe.annulationAt).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                      {nbDpaesSoumises > 0 && (
                        <div className="bg-red-100 border border-red-200 rounded-lg px-3 py-1.5 text-xs text-red-700">
                          ⚠️ {nbDpaesSoumises} DPAE soumise{nbDpaesSoumises > 1 ? 's' : ''} — régularisation URSSAF manuelle
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tableau affectations */}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Collaborateur</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Contrat</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Poste</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-600">Cachet</th>
                        <th className="text-center px-4 py-2 font-medium text-gray-600">DPAE</th>
                        <th className="text-center px-4 py-2 font-medium text-gray-600">Décision cachet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupe.affectations.map((aff) => {
                        const decision = decisions[aff.id]
                        const estCDI = aff.contractType === 'CDI'
                        const isBusy = loading[aff.id]

                        return (
                          <tr key={aff.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                            <td className="px-4 py-3">
                              <span className="font-medium text-gray-900">{aff.collaborateurNom}</span>
                              {aff.confirmationStatus === 'ANNULEE_TARDIVE' && (
                                <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                  ≤48h
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{aff.contractType}</td>
                            <td className="px-4 py-3 text-gray-600">{aff.poste}</td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {aff.cachet != null ? `${aff.cachet.toFixed(2)} €` : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                aff.dpaeStatus === 'ENVOYEE' || aff.dpaeStatus === 'CONFIRMEE'
                                  ? 'bg-green-100 text-green-700'
                                  : aff.dpaeStatus === 'A_FAIRE'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}>
                                {DPAE_LABELS[aff.dpaeStatus ?? ''] ?? '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {estCDI ? (
                                <span className="text-gray-400 text-sm">—</span>
                              ) : decision === 'DU' ? (
                                <span className="text-green-700 font-medium text-sm">✔ Cachet dû</span>
                              ) : decision === 'ANNULE' ? (
                                <span className="text-red-600 font-medium text-sm">✖ Cachet annulé</span>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => trancherCachet(aff.id, 'DU')}
                                    disabled={isBusy}
                                    className="px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 disabled:opacity-50 transition-colors"
                                  >
                                    ✔ Dû
                                  </button>
                                  <button
                                    onClick={() => trancherCachet(aff.id, 'ANNULE')}
                                    disabled={isBusy}
                                    className="px-2.5 py-1 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 transition-colors"
                                  >
                                    ✖ Annulé
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {/* Total cachets A_DECIDER pour cette représentation */}
                  {(() => {
                    const total = groupe.affectations
                      .filter((a) => decisions[a.id] === 'A_DECIDER' && a.cachet)
                      .reduce((sum, a) => sum + (a.cachet ?? 0), 0)
                    if (total === 0) return null
                    return (
                      <div className="px-5 py-2.5 bg-amber-50 border-t border-amber-100 text-sm text-amber-700">
                        💰 Total cachets à décider : <strong>{total.toFixed(2)} €</strong>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
