// ─────────────────────────────────────────────────────────
// POST /api/admin/organisations/[id]/reactiver — Réactiver une org suspendue
// doc/23-architecture-technique.md §23.1
// Accès : SUPER_ADMIN uniquement
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth'
import { internalError, notFound } from '@/lib/api-response'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { session, error } = await requireSuperAdmin()
    if (error) return error

    const { id } = params

    // Vérifier que l'org existe
    const org = await prisma.organization.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, name: true, suspendedAt: true },
    })
    if (!org) return notFound('Organisation')

    // Lever la suspension
    const updated = await prisma.organization.update({
      where: { id },
      data: {
        suspendedAt: null,
        suspendedReason: null,
      },
    })

    // ActivityLog
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'MEMBER_INVITED', // action la plus proche disponible — REACTIVATE idéalement
        entityType: 'Organization',
        entityId: id,
        metadata: {
          action: 'REACTIVATE',
          orgName: org.name,
        },
      },
    })

    return NextResponse.json({
      id: updated.id,
      suspendedAt: updated.suspendedAt,
      suspendedReason: updated.suspendedReason,
    })
  } catch (err) {
    console.error('[POST /api/admin/organisations/[id]/reactiver]', err)
    return internalError()
  }
}
