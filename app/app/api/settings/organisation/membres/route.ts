// ─────────────────────────────────────────────────────────
// GET /api/settings/organisation/membres — Lister membres + invitations
// doc/02-roles-permissions.md · doc/06-regles-decisions.md Règle #7
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError, notFound } from '@/lib/api-response'
import logger from '@/lib/logger'

// ── GET — Lister membres + invitations ────────────────────
export async function GET(_req: Request) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'DIRECTEUR' })
    if (error) return error

    const organizationId = session.user.organizationId!

    // Vérifier que l'org existe
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    })
    if (!org) return notFound('Organisation')

    // Charger tous les membres avec les infos utilisateur
    const memberships = await prisma.organizationMembership.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { joinedAt: 'asc' },
      ],
    })

    // Compter les directeurs (pour la règle dernier directeur)
    const directeursCount = memberships.filter((m) => m.role === 'DIRECTEUR').length

    // Enrichir avec le flag isInvitationPending
    const result = memberships.map((m) => ({
      id: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      invitedById: m.invitedById,
      isInvitationPending: m.joinedAt === null,
      user: {
        id: m.user.id,
        email: m.user.email,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
      },
    }))

    return NextResponse.json({
      membres: result,
      directeursCount,
      total: result.length,
    })
  } catch (err) {
    void logger.error('GET /api/settings/organisation/membres', err, { route: 'GET /api/settings/organisation/membres' })
    return internalError()
  }
}
