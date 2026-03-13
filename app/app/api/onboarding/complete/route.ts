// ─────────────────────────────────────────────────────────
// POST /api/onboarding/complete — Finalisation du wizard
// Marque Organization.onboardingCompletedAt
// doc/14-onboarding.md §14.7, §14.8
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { requireOrgSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { internalError } from '@/lib/api-response'

export async function POST() {
  try {
    const { session, error } = await requireOrgSession({ write: true })
    if (error) return error

    await prisma.organization.update({
      where: { id: session.user.organizationId! },
      data: { onboardingCompletedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/onboarding/complete]', err)
    return internalError()
  }
}
