// ─────────────────────────────────────────────────────────
// POST /api/onboarding/organisation — Étape 1 du wizard
// Met à jour la ville de l'organisation
// doc/14-onboarding.md §14.2 Étape 1
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrgSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validationError, internalError } from '@/lib/api-response'

const Schema = z.object({
  city: z.string().max(100).optional(),
})

export async function POST(req: Request) {
  try {
    const { session, error } = await requireOrgSession({ write: true })
    if (error) return error

    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    await prisma.organization.update({
      where: { id: session.user.organizationId! },
      data: {
        city: parsed.data.city ?? null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/onboarding/organisation]', err)
    return internalError()
  }
}
