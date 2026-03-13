'use client'
// ─────────────────────────────────────────────────────────
// Page /onboarding/equipe — Étape 3/3 du wizard
// Invitation optionnelle de 1 à 3 collaborateurs
// doc/14-onboarding.md §14.2 Étape 3
// ─────────────────────────────────────────────────────────
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Invitation = { email: string; role: string }

const ROLES = [
  { value: 'REGISSEUR', label: 'Régisseur' },
  { value: 'RH', label: 'RH / Admin paie' },
  { value: 'COLLABORATEUR', label: 'Collaborateur' },
]

export default function OnboardingEquipePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSkipping, setIsSkipping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invitations, setInvitations] = useState<Invitation[]>([
    { email: '', role: 'REGISSEUR' },
  ])

  function addInvitation() {
    if (invitations.length < 3) {
      setInvitations([...invitations, { email: '', role: 'COLLABORATEUR' }])
    }
  }

  function updateInvitation(index: number, field: keyof Invitation, value: string) {
    const updated = [...invitations]
    updated[index] = { ...updated[index], [field]: value }
    setInvitations(updated)
    setError(null)
  }

  function removeInvitation(index: number) {
    if (invitations.length > 1) {
      setInvitations(invitations.filter((_, i) => i !== index))
    }
  }

  async function handleTerminer() {
    // Filtrer les invitations vides
    const valid = invitations.filter((inv) => inv.email.trim() !== '')

    setIsLoading(true)
    setError(null)

    try {
      if (valid.length > 0) {
        const res = await fetch('/api/onboarding/equipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invitations: valid }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Erreur lors de l\'envoi des invitations.')
          return
        }
      }

      // Marquer l'onboarding comme terminé
      const completeRes = await fetch('/api/onboarding/complete', { method: 'POST' })
      if (!completeRes.ok) {
        setError('Erreur lors de la finalisation de l\'onboarding.')
        return
      }

      router.push('/dashboard')
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSkip() {
    setIsSkipping(true)
    setError(null)

    try {
      const completeRes = await fetch('/api/onboarding/complete', { method: 'POST' })
      if (!completeRes.ok) {
        setError('Erreur lors de la finalisation de l\'onboarding.')
        setIsSkipping(false)
        return
      }
      router.push('/dashboard')
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
      setIsSkipping(false)
    }
  }

  return (
    <div className="w-full max-w-lg">
      {/* Barre de progression */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
          <span className="font-medium text-indigo-600">Étape 3 / 3</span>
          <span>Votre équipe</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full">
          <div className="h-1.5 bg-indigo-600 rounded-full" style={{ width: '100%' }} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Qui travaille avec vous ?</h1>
        <p className="text-gray-500 text-sm mb-8">
          Invitez jusqu'à 3 personnes ici. D'autres pourront être invitées depuis /équipe.
        </p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {invitations.map((inv, index) => (
            <div key={index} className="flex gap-3 items-start">
              <div className="flex-1">
                <input
                  type="email"
                  placeholder="email@structure.fr"
                  value={inv.email}
                  onChange={(e) => updateInvitation(index, 'email', e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="w-44">
                <select
                  value={inv.role}
                  onChange={(e) => updateInvitation(index, 'role', e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              {invitations.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeInvitation(index)}
                  className="mt-2 text-gray-300 hover:text-red-400 text-lg leading-none"
                  aria-label="Supprimer"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {invitations.length < 3 && (
            <button
              type="button"
              onClick={addInvitation}
              className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              + Ajouter une autre personne
            </button>
          )}

          <p className="text-xs text-gray-400 pt-2">
            💡 Les intermittents n'ont pas besoin de créer un compte. Ils reçoivent un lien et
            répondent directement.
          </p>
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
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
              disabled={isSkipping || isLoading}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Passer cette étape
            </button>
            <button
              type="button"
              onClick={handleTerminer}
              disabled={isLoading || isSkipping}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 px-6 rounded-lg transition-colors text-sm"
            >
              {isLoading ? 'Envoi des invitations…' : 'Terminer ✓'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
