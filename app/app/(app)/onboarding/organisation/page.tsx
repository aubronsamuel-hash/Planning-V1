'use client'
// ─────────────────────────────────────────────────────────
// Page /onboarding/organisation — Étape 1/3 du wizard
// Configuration de l'organisation (nom, ville, logo)
// doc/14-onboarding.md §14.2 Étape 1
// ─────────────────────────────────────────────────────────
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardingOrganisationPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    city: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/onboarding/organisation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: form.city }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue.')
        return
      }

      router.push('/onboarding/premier-projet')
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-lg">
      {/* Barre de progression */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
          <span className="font-medium text-indigo-600">Étape 1 / 3</span>
          <span>Configuration de votre organisation</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full">
          <div className="h-1.5 bg-indigo-600 rounded-full" style={{ width: '33%' }} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          🎭 Bienvenue ! Configurons votre espace.
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          Ces informations seront visibles par vos collaborateurs.
        </p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="city">
              Ville principale
            </label>
            <input
              id="city"
              name="city"
              type="text"
              autoFocus
              autoComplete="address-level2"
              value={form.city}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Lille"
            />
          </div>

          {/* Logo — upload optionnel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Logo{' '}
              <span className="text-gray-400 font-normal">(optionnel — PNG/JPG, max 2 Mo)</span>
            </label>
            <div className="border border-dashed border-gray-300 rounded-lg px-4 py-6 text-center text-sm text-gray-400 hover:border-indigo-300 transition-colors cursor-pointer">
              <span>+ Ajouter un logo</span>
              <p className="text-xs mt-1">Disponible depuis les paramètres de l'organisation</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 px-6 rounded-lg transition-colors text-sm"
            >
              {isLoading ? 'Enregistrement…' : 'Suivant →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
