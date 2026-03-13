// ─────────────────────────────────────────────────────────
// Page /onboarding — Point d'entrée du wizard
// Redirige vers la première étape non complétée
// doc/14-onboarding.md §14.2, §14.7
// ─────────────────────────────────────────────────────────
import { redirect } from 'next/navigation'

export default function OnboardingPage() {
  // Redirige toujours vers l'étape 1
  redirect('/onboarding/organisation')
}
