'use client'
// ─────────────────────────────────────────────────────────
// Hook feature flags — basé sur le plan dans le JWT
// doc/23-architecture-technique.md §23.4
// ⚠️ Cache UI uniquement — toujours vérifier côté serveur
//    avec org.plan depuis la DB (jamais session.organizationPlan)
// ─────────────────────────────────────────────────────────
import { useSession } from 'next-auth/react'
import { PLAN_LIMITS, type PlanLimits } from '@/lib/plans'

export function useFeature(feature: keyof PlanLimits['features']): boolean {
  const { data: session } = useSession()
  const plan = session?.user?.organizationPlan
  if (!plan) return false
  return PLAN_LIMITS[plan].features[feature]
}

export function useOrganizationPlan() {
  const { data: session } = useSession()
  return session?.user?.organizationPlan ?? null
}

export function useIsChefOn(equipeId: string | null): boolean {
  const { data: session } = useSession()
  if (!equipeId || !session) return false
  return session.user.chefEquipes.includes(equipeId)
}
