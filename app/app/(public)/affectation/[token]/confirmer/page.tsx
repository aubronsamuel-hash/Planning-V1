'use client'
// ─────────────────────────────────────────────────────────
// Page /affectation/[token]/confirmer — Confirmation d'affectation
// Accessible sans connexion via magic link CONFIRMATION
// doc/06-regles-decisions.md Règles #14, #15
// doc/04-pages-interfaces-ux.md
// Confirmation atomique : chaque clic = action immédiate
// ─────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type AffectationInfo = {
  collaborateurPrenom: string
  projetTitre: string
  representationDate: string
  representationLieu: string
  poste: string
  heureDebut: string
  heureFin: string
  cachet: number | null
  confirmationStatus: string
}

type Status = 'loading' | 'ready' | 'confirmed' | 'refused' | 'error'

export default function ConfirmerAffectationPage() {
  const { token } = useParams<{ token: string }>()
  const [status, setStatus] = useState<Status>('loading')
  const [info, setInfo] = useState<AffectationInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMessage('Lien invalide.')
      return
    }

    async function fetchAffectation() {
      try {
        const res = await fetch(`/api/affectations/confirmer?token=${token}`)
        const data = await res.json()

        if (!res.ok) {
          setStatus('error')
          setErrorMessage(data.error ?? 'Lien invalide ou expiré.')
          return
        }

        setInfo(data)

        // Si déjà confirmée ou refusée, afficher le statut direct
        if (data.confirmationStatus === 'CONFIRMEE') {
          setStatus('confirmed')
        } else if (data.confirmationStatus === 'REFUSEE') {
          setStatus('refused')
        } else {
          setStatus('ready')
        }
      } catch {
        setStatus('error')
        setErrorMessage('Erreur réseau. Vérifiez votre connexion.')
      }
    }

    fetchAffectation()
  }, [token])

  async function handleAction(action: 'CONFIRMEE' | 'REFUSEE') {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/affectations/confirmer?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error ?? 'Une erreur est survenue.')
        return
      }

      setStatus(action === 'CONFIRMEE' ? 'confirmed' : 'refused')
    } catch {
      setErrorMessage('Erreur réseau. Veuillez réessayer.')
    } finally {
      setActionLoading(false)
    }
  }

  // ── États de chargement / erreur ─────────────────────────

  if (status === 'loading') {
    return (
      <ConfirmLayout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-500">Chargement de votre affectation…</p>
        </div>
      </ConfirmLayout>
    )
  }

  if (status === 'error') {
    return (
      <ConfirmLayout>
        <div className="text-center py-8">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Lien invalide ou expiré</h2>
          <p className="text-gray-600 text-sm">{errorMessage}</p>
          <p className="text-gray-400 text-sm mt-4">
            Contactez votre régisseur pour obtenir un nouveau lien.
          </p>
        </div>
      </ConfirmLayout>
    )
  }

  if (status === 'confirmed') {
    return (
      <ConfirmLayout>
        <div className="text-center py-8">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Affectation confirmée !</h2>
          {info && (
            <div className="text-gray-600 text-sm space-y-1 mt-4">
              <p className="font-medium">{info.projetTitre}</p>
              <p>{info.representationDate} · {info.representationLieu}</p>
              <p>{info.poste} · {info.heureDebut} – {info.heureFin}</p>
            </div>
          )}
          <p className="text-green-600 text-sm mt-4 font-medium">
            Votre présence a bien été enregistrée.
          </p>
        </div>
      </ConfirmLayout>
    )
  }

  if (status === 'refused') {
    return (
      <ConfirmLayout>
        <div className="text-center py-8">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Affectation refusée</h2>
          <p className="text-gray-600 text-sm mt-2">
            Votre réponse a bien été transmise au régisseur.
          </p>
        </div>
      </ConfirmLayout>
    )
  }

  // ── État ready : formulaire de confirmation ───────────────

  return (
    <ConfirmLayout>
      {info && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Confirmez votre présence</h2>
            <p className="text-gray-500 text-sm mt-1">
              Bonjour {info.collaborateurPrenom}, voici votre affectation :
            </p>
          </div>

          {/* Détail de l'affectation */}
          <div className="bg-gray-50 rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-gray-900 text-lg">{info.projetTitre}</p>
                <p className="text-gray-500 text-sm">{info.poste}</p>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-3 space-y-1.5 text-sm text-gray-600">
              <p>📅 <span className="font-medium">{info.representationDate}</span></p>
              <p>📍 {info.representationLieu}</p>
              <p>🕐 {info.heureDebut} – {info.heureFin}</p>
              {info.cachet !== null && (
                <p>💶 Cachet : <span className="font-medium">{(info.cachet / 100).toFixed(2)} €</span></p>
              )}
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Boutons de confirmation / refus */}
          <div className="flex gap-3">
            <button
              onClick={() => handleAction('CONFIRMEE')}
              disabled={actionLoading}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-3 px-4 rounded-xl transition-colors text-sm"
            >
              ✓ Je confirme ma présence
            </button>
            <button
              onClick={() => handleAction('REFUSEE')}
              disabled={actionLoading}
              className="flex-1 bg-white hover:bg-gray-50 disabled:bg-gray-100 border border-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl transition-colors text-sm"
            >
              ✗ Je ne serai pas disponible
            </button>
          </div>

          <p className="text-xs text-center text-gray-400">
            Votre réponse est enregistrée immédiatement et transmise au régisseur.
          </p>
        </div>
      )}
    </ConfirmLayout>
  )
}

function ConfirmLayout({ children }: { children: React.ReactNode }) {
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
