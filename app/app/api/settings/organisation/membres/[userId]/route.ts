// ─────────────────────────────────────────────────────────
// PATCH /api/settings/organisation/membres/[userId] — Changer le rôle
// DELETE /api/settings/organisation/membres/[userId] — Retirer un membre
// doc/02-roles-permissions.md · doc/06-regles-decisions.md Règle #7
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { validationError, internalError, notFound, conflict } from '@/lib/api-response'
import type { OrganizationRole } from '@prisma/client'

// ── Schémas de validation ──────────────────────────────────
const PatchRoleSchema = z.object({
  role: z.enum(['DIRECTEUR', 'REGISSEUR', 'RH', 'COLLABORATEUR']),
})

type RouteParams = { params: { userId: string } }

// ── PATCH — Changer le rôle d'un membre ───────────────────
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'DIRECTEUR', write: true })
    if (error) return error

    const organizationId = session.user.organizationId!
    const { userId } = params

    // Bloquer si on essaie de changer son propre rôle
    if (session.user.id === userId) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas modifier votre propre rôle.', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const parsed = PatchRoleSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { role } = parsed.data

    // Charger le membership cible
    const membership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    })
    if (!membership) return notFound('Membre')

    // Règle #7 — Dernier Directeur : si le membre est DIRECTEUR et le seul, bloquer le downgrade
    if (membership.role === 'DIRECTEUR' && role !== 'DIRECTEUR') {
      const directeursCount = await prisma.organizationMembership.count({
        where: { organizationId, role: 'DIRECTEUR' },
      })
      if (directeursCount <= 1) {
        return conflict(
          'Impossible de modifier le rôle : ce membre est le seul Directeur de l\'organisation. Nommez d\'abord un autre Directeur.'
        )
      }
    }

    // Mettre à jour le rôle
    const updated = await prisma.organizationMembership.update({
      where: { userId_organizationId: { userId, organizationId } },
      data: { role: role as OrganizationRole },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    })

    // ActivityLog
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'MEMBER_INVITED', // MEMBER_ROLE_CHANGED si disponible
        entityType: 'OrganizationMembership',
        entityId: updated.id,
        metadata: {
          targetUserId: userId,
          previousRole: membership.role,
          newRole: role,
        },
      },
    })

    return NextResponse.json({
      id: updated.id,
      role: updated.role,
      joinedAt: updated.joinedAt,
      isInvitationPending: updated.joinedAt === null,
      user: updated.user,
    })
  } catch (err) {
    console.error('[PATCH /api/settings/organisation/membres/[userId]]', err)
    return internalError()
  }
}

// ── DELETE — Retirer un membre ─────────────────────────────
export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'DIRECTEUR', write: true })
    if (error) return error

    const organizationId = session.user.organizationId!
    const { userId } = params

    // Bloquer si on essaie de se retirer soi-même
    if (session.user.id === userId) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas vous retirer vous-même de l\'organisation.', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    // Charger le membership cible
    const membership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    })
    if (!membership) return notFound('Membre')

    // Règle #7 — Dernier Directeur
    if (membership.role === 'DIRECTEUR') {
      const directeursCount = await prisma.organizationMembership.count({
        where: { organizationId, role: 'DIRECTEUR' },
      })
      if (directeursCount <= 1) {
        return conflict(
          'Impossible de retirer ce membre : c\'est le seul Directeur de l\'organisation. Nommez d\'abord un autre Directeur.'
        )
      }
    }

    // Supprimer uniquement le membership, pas le User
    await prisma.organizationMembership.delete({
      where: { userId_organizationId: { userId, organizationId } },
    })

    // ActivityLog
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'MEMBER_INVITED', // MEMBER_REMOVED si disponible
        entityType: 'OrganizationMembership',
        entityId: membership.id,
        metadata: { targetUserId: userId, removedRole: membership.role },
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/settings/organisation/membres/[userId]]', err)
    return internalError()
  }
}
