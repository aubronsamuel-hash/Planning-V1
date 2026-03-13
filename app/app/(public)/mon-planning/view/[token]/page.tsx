'use client'
// ─────────────────────────────────────────────────────────
// Page /mon-planning/view/[token] — Planning en lecture seule
// Accessible sans connexion via magic link PLANNING_VIEW
// doc/06-regles-decisions.md Règle #16
// doc/04-pages-interfaces-ux.md
// ─────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Affectation = {
  id: string
  projetTitre: string
  projetColor: string
  representationDate: string
  representationLieu: string
  poste: string
  heureDebut: string
  heureFin: string
  cachet: number | null
  confirmationStatus: string
}

type PlanningData = {
  collaborateurPrenom: string
  collaborateurNom: string
  affectations: Affectation[]
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  CONFIRMEE: { label: 'Confirmée', color: 'bg-green-100 text-green-700' },
  EN_ATTENTE: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700' },
  REFUSEE: { label: 'Refusée', color: 'bg-red-100 text-red-700' },
  NON_REQUISE: { label: 'Planifiée', color: 'bg-blue-100 text-blue-700' },
  ANNULEE: { label: 'Annulée', color: 'bg-gray-100 text-gray-500' },
  ANNULEE_TARDIVE: { label: 'Annulée', color: 'bg-gray-100 text-gray-500' },
}

export default function MonPlanningViewPage() {
  const { token } = useParams<{ token: string }>()
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<PlanningData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Lien invalide.')
      setIsLoading(false)
      return
    }

    async function fetchPlanning() {
      try {
        const res = await fetch(`/api/planning/view?token=${token}`)
        const json = await res.json()

        if (!res.ok) {
          setError(json.error ?? 'Lien invalide ou expiré.')
          return
        }

        setData(json)
      } catch {
        setError('Erreur réseau. Vérifiez votre connexion.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPlanning()
  }, [token])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6">
        <span className="text-xl font-semibold text-indigo-600">🎭 Spectacle Vivant</span>
      </header>

      <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        {isLoading && (
          <div className="text-center py-16">
            <p className="text-gray-400">Chargement de votre planning…</p>
          </div>
        )}

        {error && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Lien invalide ou expiré</h2>
            <p className="text-gray-600 text-sm">{error}</p>
            <p className="text-gray-400 text-sm mt-4">
              Contactez votre régisseur pour obtenir un nouveau lien.
            </p>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Mon planning — {data.collaborateurPrenom} {data.collaborateurNom}
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                {data.affectations.length} affectation{data.affectations.length !== 1 ? 's' : ''}
              </p>
            </div>

            {data.affectations.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
                Aucune affectation à venir.
              </div>
            ) : (
              <div className="space-y-3">
                {data.affectations.map((aff) => {
                  const statusInfo = STATUS_LABELS[aff.confirmationStatus] ?? {
                    label: aff.confirmationStatus,
                    color: 'bg-gray-100 text-gray-500',
                  }
                  return (
                    <div
                      key={aff.id}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-1 h-full min-h-[40px] rounded-full flex-shrink-0 mt-1"
                            style={{ backgroundColor: aff.projetColor }}
                          />
                          <div>
                            <p className="font-semibold text-gray-900">{aff.projetTitre}</p>
                            <p className="text-gray-500 text-sm">{aff.poste}</p>
                          </div>
                        </div>
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <p>📅 {aff.representationDate}</p>
                        <p>🕐 {aff.heureDebut} – {aff.heureFin}</p>
                        <p className="col-span-2">📍 {aff.representationLieu}</p>
                        {aff.cachet !== null && (
                          <p>💶 {(aff.cachet / 100).toFixed(2)} €</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="text-center text-xs text-gray-400 pt-4">
              Ce lien vous donne accès en lecture seule à votre planning.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
