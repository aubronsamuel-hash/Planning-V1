'use client'
// ─────────────────────────────────────────────────────────
// Page /onboarding/premier-projet — Étape 2/3 du wizard
// Création optionnelle du premier spectacle
// doc/14-onboarding.md §14.2 Étape 2
// ─────────────────────────────────────────────────────────
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PROJET_TYPES = [
  { value: 'THEATRE', label: 'Théâtre' },
  { value: 'COMEDIE_MUSICALE', label: 'Comédie musicale' },
  { value: 'CONCERT', label: 'Concert' },
  { value: 'OPERA', label: 'Opéra' },
  { value: 'DANSE', label: 'Danse' },
  { value: 'CIRQUE', label: 'Cirque' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'EVENEMENT', label: 'Événement' },
  { value: 'AUTRE', label: 'Autre' },
]

export default function OnboardingPremierProjetPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSkipping, setIsSkipping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    titre: '',
    type: 'THEATRE',
    dateDebut: '',
    dateFin: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titre.trim()) {
      setError('Le nom du spectacle est requis.')
      return
    }
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/onboarding/premier-projet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre: form.titre.trim(),
          type: form.type,
          dateDebut: form.dateDebut || null,
          dateFin: form.dateFin || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue.')
        return
      }

      router.push('/onboarding/equipe')
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSkip() {
    setIsSkipping(true)
    router.push('/onboarding/equipe')
  }

  return (
    <div className="w-full max-w-lg">
      {/* Barre de progression */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
          <span className="font-medium text-indigo-600">Étape 2 / 3</span>
          <span>Votre premier spectacle</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full">
          <div className="h-1.5 bg-indigo-600 rounded-full" style={{ width: '66%' }} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Créez votre premier spectacle.</h1>
        <p className="text-gray-500 text-sm mb-8">
          Vous pourrez ajouter des représentations et affecter votre équipe ensuite.
        </p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="titre">
              Nom du spectacle
            </label>
            <input
              id="titre"
              name="titre"
              type="text"
              autoFocus
              value={form.titre}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Peter Pan"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="type">
              Type
            </label>
            <select
              id="type"
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            >
              {PROJET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="dateDebut">
                Date de début
              </label>
              <input
                id="dateDebut"
                name="dateDebut"
                type="date"
                value={form.dateDebut}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="dateFin">
                Date de fin{' '}
                <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <input
                id="dateFin"
                name="dateFin"
                type="date"
                value={form.dateFin}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Retour
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSkip}
                disabled={isSkipping}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Passer cette étape
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 px-6 rounded-lg transition-colors text-sm"
              >
                {isLoading ? 'Création…' : 'Suivant →'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
