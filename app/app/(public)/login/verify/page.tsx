'use client'
// ─────────────────────────────────────────────────────────
// Page /login/verify — Traitement du magic link
// Appelée depuis l'email ou directement avec ?token=xxx
// Utilise signIn('magic-link', { token }) de NextAuth
// doc/06-regles-decisions.md Règle #16, #17
// ─────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

type Status = 'verifying' | 'success' | 'error'

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: 'Ce lien est invalide ou a déjà été utilisé.',
  'token-expired': 'Ce lien a expiré. Demandez un nouveau lien.',
  'token-used': 'Ce lien a déjà été utilisé.',
}

export default function LoginVerifyPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<Status>('verifying')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMessage('Lien de connexion manquant.')
      return
    }

    async function verify() {
      const result = await signIn('magic-link', {
        token,
        redirect: false,
      })

      if (result?.error) {
        setStatus('error')
        setErrorMessage(ERROR_MESSAGES[result.error] ?? 'Lien invalide ou expiré.')
        return
      }

      if (result?.ok) {
        setStatus('success')
        // Redirection après connexion réussie
        // Le layout app vérifiera onboardingCompletedAt pour rediriger si nécessaire
        setTimeout(() => {
          router.push('/dashboard')
        }, 1200)
      }
    }

    verify()
  }, [token, router])

  if (status === 'verifying') {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="flex justify-center mb-4">
            <svg
              className="animate-spin h-8 w-8 text-indigo-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Vérification en cours…</h2>
          <p className="text-sm text-gray-500 mt-2">Vous allez être redirigé.</p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-lg font-semibold text-gray-900">Connexion réussie !</h2>
          <p className="text-sm text-gray-500 mt-2">Redirection vers votre espace…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="text-5xl mb-4">❌</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Lien invalide</h2>
        <p className="text-sm text-gray-600 mb-6">{errorMessage}</p>
        <a
          href="/login"
          className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg text-sm transition-colors"
        >
          Demander un nouveau lien
        </a>
      </div>
    </div>
  )
}
