'use client'
// ─────────────────────────────────────────────────────────
// Page /signup — Inscription nouvelle organisation
// doc/14-onboarding.md §14.1
// ─────────────────────────────────────────────────────────
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const ORGANIZATION_TYPES = [
  { value: 'theatre', label: 'Théâtre' },
  { value: 'compagnie_danse', label: 'Compagnie de danse' },
  { value: 'compagnie_theatrale', label: 'Compagnie théâtrale' },
  { value: 'producteur', label: 'Producteur' },
  { value: 'salle_concert', label: 'Salle de concert' },
  { value: 'festival', label: 'Festival' },
  { value: 'autre', label: 'Autre' },
]

export default function SignupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    organizationName: '',
    organizationType: 'theatre',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue. Veuillez réessayer.')
        return
      }

      setSentEmail(form.email)
      setEmailSent(true)
    } catch {
      setError('Erreur réseau. Vérifiez votre connexion et réessayez.')
    } finally {
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="text-5xl mb-4">📬</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Vérifiez votre email</h2>
          <p className="text-gray-600 mb-6">
            Nous avons envoyé un lien de connexion à{' '}
            <span className="font-medium text-gray-900">{sentEmail}</span>.
          </p>
          <p className="text-sm text-gray-500">
            Le lien est valable <span className="font-medium">15 minutes</span>. Vérifiez aussi vos
            spams si vous ne le voyez pas.
          </p>
          <div className="mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={() => setEmailSent(false)}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              ← Modifier mon adresse email
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Créez votre espace de gestion</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Essai gratuit 14 jours · Pas de carte bancaire requise
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="firstName">
                Prénom
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                autoComplete="given-name"
                value={form.firstName}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Marc"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="lastName">
                Nom
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                autoComplete="family-name"
                value={form.lastName}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Dupont"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
              Email professionnel
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="marc@theatre-du-nord.fr"
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="organizationName"
            >
              Nom de votre structure
            </label>
            <input
              id="organizationName"
              name="organizationName"
              type="text"
              required
              value={form.organizationName}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Théâtre du Nord"
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="organizationType"
            >
              Type de structure
            </label>
            <select
              id="organizationType"
              name="organizationType"
              value={form.organizationType}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            >
              {ORGANIZATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
          >
            {isLoading ? 'Création en cours…' : 'Créer mon espace →'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
