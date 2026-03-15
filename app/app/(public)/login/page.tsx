'use client'
// ─────────────────────────────────────────────────────────
// Page /login — Connexion via magic link
// doc/14-onboarding.md §14.5
// doc/06-regles-decisions.md Règle #16, #17
// Flux principal : email → magic link → /login/verify
// ─────────────────────────────────────────────────────────
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'

const ERROR_MESSAGES: Record<string, string> = {
  'missing-token': 'Lien de connexion manquant. Demandez un nouveau lien.',
  'invalid-token': 'Lien de connexion invalide. Demandez un nouveau lien.',
  'token-used': 'Ce lien a déjà été utilisé. Demandez un nouveau lien.',
  'token-expired': 'Ce lien a expiré. Demandez un nouveau lien.',
  CredentialsSignin: 'Lien invalide ou expiré. Demandez un nouveau lien.',
}

function LoginContent() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState<string | null>(
    errorParam ? (ERROR_MESSAGES[errorParam] ?? 'Une erreur est survenue. Réessayez.') : null
  )

  // Formulaire mot de passe (secondaire — comptes ACTIVE uniquement)
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/magic-link/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      // Toujours 200 (pour ne pas révéler si l'email existe)
      if (res.ok) {
        setEmailSent(true)
      } else {
        setError('Une erreur est survenue. Veuillez réessayer.')
      }
    } catch {
      setError('Erreur réseau. Vérifiez votre connexion et réessayez.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setPasswordLoading(true)
    setError(null)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Email ou mot de passe incorrect.')
      setPasswordLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  if (emailSent) {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="text-5xl mb-4">📬</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Consultez vos emails</h2>
          <p className="text-gray-600 text-sm mb-4">
            Si un compte existe pour{' '}
            <span className="font-medium text-gray-900">{email}</span>, vous recevrez un lien de
            connexion valable <span className="font-medium">15 minutes</span>.
          </p>
          <p className="text-xs text-gray-400">Pensez à vérifier vos spams.</p>
          <div className="mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={() => { setEmailSent(false); setEmail('') }}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              ← Utiliser un autre email
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Connexion</h1>
          <p className="text-gray-500 mt-1 text-sm">Recevez un lien de connexion par email</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!showPassword ? (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null) }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="marc@theatre-du-nord.fr"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
            >
              {isLoading ? 'Envoi en cours…' : 'Recevoir mon lien de connexion'}
            </button>

            <p className="text-center text-xs text-gray-400 mt-2">
              Un email vous sera envoyé avec un lien valable 15 minutes.
            </p>
          </form>
        ) : (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email-pwd">
                Email
              </label>
              <input
                id="email-pwd"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
            >
              {passwordLoading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100 text-center space-y-2">
          <button
            onClick={() => { setShowPassword(!showPassword); setError(null) }}
            className="text-xs text-gray-400 hover:text-gray-600 block w-full"
          >
            {showPassword ? 'Connexion par lien email →' : 'Se connecter avec mot de passe'}
          </button>
          <p className="text-sm text-gray-500">
            Pas encore de compte ?{' '}
            <Link href="/signup" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Créer un espace →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-sm"><div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-400 text-sm">Chargement…</div></div>}>
      <LoginContent />
    </Suspense>
  )
}
