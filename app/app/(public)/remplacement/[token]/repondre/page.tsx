'use client'
// ─────────────────────────────────────────────────────────
// Page publique /remplacement/[token]/repondre
// Réponse d'un candidat à une proposition de remplacement urgent
// Accessible sans connexion via magic token 4h
// doc/10-remplacements-urgents.md §10.3
// ─────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type PropositionInfo = {
  prenom: string
  projetTitre: string
  projetColorCode: string
  representationDate: string
  representationLieu: string
  poste: string
  heureDebut: string
  heureFin: string
  cachet: number | null
  expiresAt: string
  status: 'EN_ATTENTE' | 'ACCEPTEE' | 'REFUSEE' | 'EXPIREE'
}

type PageStatus = 'loading' | 'ready' | 'accepted' | 'refused' | 'expired' | 'error'

export default function RepondreRemplacementPage() {
  const { token } = useParams<{ token: string }>()
  const [pageStatus, setPageStatus] = useState<PageStatus>('loading')
  const [info, setInfo] = useState<PropositionInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      setPageStatus('error')
      setErrorMessage('Lien invalide.')
      return
    }

    async function fetchProposition() {
      try {
        const res = await fetch(`/api/remplacements/repondre?token=${token}`)
        const data = await res.json()

        if (!res.ok) {
          if (res.status === 410) {
            setPageStatus('expired')
          } else {
            setPageStatus('error')
            setErrorMessage(data.error ?? 'Lien invalide ou expiré.')
          }
          return
        }

        setInfo(data)

        if (data.status === 'ACCEPTEE') setPageStatus('accepted')
        else if (data.status === 'REFUSEE') setPageStatus('refused')
        else if (data.status === 'EXPIREE') setPageStatus('expired')
        else setPageStatus('ready')
      } catch {
        setPageStatus('error')
        setErrorMessage('Erreur réseau. Vérifiez votre connexion.')
      }
    }

    fetchProposition()
  }, [token])

  async function handleAction(action: 'ACCEPTEE' | 'REFUSEE') {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/remplacements/repondre?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error ?? 'Une erreur est survenue.')
        return
      }

      setPageStatus(action === 'ACCEPTEE' ? 'accepted' : 'refused')
    } catch {
      setErrorMessage('Erreur réseau. Veuillez réessayer.')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Rendu ──────────────────────────────────────────────

  if (pageStatus === 'loading') {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-500">Chargement…</p>
        </div>
      </Layout>
    )
  }

  if (pageStatus === 'expired') {
    return (
      <Layout>
        <div className="text-center py-8">
          <div className="text-5xl mb-4">⏰</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Lien expiré</h2>
          <p className="text-gray-600 text-sm">
            Ce lien était valable 4 heures. Il est arrivé à expiration.
          </p>
          <p className="text-gray-400 text-sm mt-3">
            Contactez le régisseur pour obtenir une nouvelle proposition.
          </p>
        </div>
      </Layout>
    )
  }

  if (pageStatus === 'error') {
    return (
      <Layout>
        <div className="text-center py-8">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Lien invalide</h2>
          <p className="text-gray-600 text-sm">{errorMessage}</p>
        </div>
      </Layout>
    )
  }

  if (pageStatus === 'accepted') {
    return (
      <Layout>
        <div className="text-center py-8">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Vous avez accepté le remplacement !
          </h2>
          {info && (
            <div className="text-gray-600 text-sm space-y-1 mt-4">
              <p className="font-medium text-base">{info.projetTitre}</p>
              <p>{info.representationDate}</p>
              {info.representationLieu && <p>📍 {info.representationLieu}</p>}
              <p>
                {info.poste} · {info.heureDebut} – {info.heureFin}
              </p>
              {info.cachet !== null && (
                <p>💶 Cachet : {(info.cachet / 100).toFixed(2)} €</p>
              )}
            </div>
          )}
          <p className="text-green-600 text-sm mt-4 font-medium">
            Le régisseur a été notifié de votre disponibilité.
          </p>
        </div>
      </Layout>
    )
  }

  if (pageStatus === 'refused') {
    return (
      <Layout>
        <div className="text-center py-8">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Vous avez décliné le remplacement
          </h2>
          <p className="text-gray-600 text-sm mt-2">
            Votre réponse a bien été transmise au régisseur.
          </p>
        </div>
      </Layout>
    )
  }

  // ── État ready : formulaire ───────────────────────────
  return (
    <Layout>
      {info && (
        <div className="space-y-6">
          {/* En-tête urgence */}
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <span className="text-red-600 font-bold text-lg">⚡</span>
            <div>
              <p className="font-semibold text-red-800 text-sm">Remplacement urgent</p>
              <p className="text-red-600 text-xs">
                Ce lien expire à{' '}
                {new Date(info.expiresAt).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Bonjour {info.prenom},
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              Vous êtes sollicité(e) en urgence pour cette date :
            </p>
          </div>

          {/* Détail */}
          <div
            className="rounded-xl p-5 space-y-3 border"
            style={{ borderColor: info.projetColorCode + '40', backgroundColor: info.projetColorCode + '08' }}
          >
            <p
              className="font-bold text-lg"
              style={{ color: info.projetColorCode }}
            >
              {info.projetTitre}
            </p>
            <p className="text-gray-700 font-medium">{info.poste}</p>
            <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm text-gray-600">
              <p>📅 <span className="font-medium">{info.representationDate}</span></p>
              {info.representationLieu && <p>📍 {info.representationLieu}</p>}
              <p>
                🕐 {info.heureDebut} – {info.heureFin}
              </p>
              {info.cachet !== null && (
                <p>
                  💶 Cachet :{' '}
                  <span className="font-medium">{(info.cachet / 100).toFixed(2)} €</span>
                </p>
              )}
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Boutons */}
          <div className="flex gap-3">
            <button
              onClick={() => handleAction('ACCEPTEE')}
              disabled={actionLoading}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-3 px-4 rounded-xl transition-colors text-sm"
            >
              ✓ Je suis disponible
            </button>
            <button
              onClick={() => handleAction('REFUSEE')}
              disabled={actionLoading}
              className="flex-1 bg-white hover:bg-gray-50 disabled:bg-gray-100 border border-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl transition-colors text-sm"
            >
              ✗ Je ne suis pas disponible
            </button>
          </div>

          <p className="text-xs text-center text-gray-400">
            Votre réponse est immédiate et transmise au régisseur.
          </p>
        </div>
      )}
    </Layout>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6">
        <span className="text-xl font-semibold text-indigo-600">🎭 Spectacle Vivant</span>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
