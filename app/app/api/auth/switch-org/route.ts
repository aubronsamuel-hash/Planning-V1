// ─────────────────────────────────────────────────────────
// POST /api/auth/switch-org — Changement d'organisation active
// doc/23-architecture-technique.md §23.1
// Règle #30 — Navigation multi-organisation
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { validationError, internalError } from '@/lib/api-response'
import logger from '@/lib/logger'

const SwitchOrgSchema = z.object({
  organizationId: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = SwitchOrgSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { organizationId } = parsed.data

    // Vérifier que l'utilisateur est bien membre de cette organisation
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId,
        },
      },
      include: {
        organization: {
          select: { id: true, name: true, suspendedAt: true },
        },
      },
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'Organisation introuvable ou accès refusé', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    if (membership.organization.suspendedAt) {
      return NextResponse.json(
        { error: 'Organisation suspendue — contactez le support', code: 'ORG_SUSPENDED' },
        { status: 403 }
      )
    }

    // Le changement de contexte est géré via le callback `jwt` de NextAuth
    // déclenché par session.update() côté client (trigger: 'update')
    return NextResponse.json({
      success: true,
      organizationId,
      organizationName: membership.organization.name,
    })
  } catch (err) {
    void logger.error('POST /api/auth/switch-org', err, { route: 'POST /api/auth/switch-org' })
    return internalError()
  }
}
