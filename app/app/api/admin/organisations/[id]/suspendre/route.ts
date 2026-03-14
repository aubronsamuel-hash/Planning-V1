// ─────────────────────────────────────────────────────────
// POST /api/admin/organisations/[id]/suspendre — Suspendre une org
// doc/23-architecture-technique.md §23.1
// Accès : SUPER_ADMIN uniquement
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth'
import { internalError, validationError, notFound } from '@/lib/api-response'
import logger from '@/lib/logger'

const SuspendreSchema = z.object({
  raison: z.string().min(1, 'La raison est obligatoire').max(500),
})

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { session, error } = await requireSuperAdmin()
    if (error) return error

    const { id } = params

    const body = await req.json()
    const parsed = SuspendreSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { raison } = parsed.data

    // Vérifier que l'org existe
    const org = await prisma.organization.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, name: true, suspendedAt: true },
    })
    if (!org) return notFound('Organisation')

    // Appliquer la suspension
    const updated = await prisma.organization.update({
      where: { id },
      data: {
        suspendedAt: new Date(),
        suspendedReason: raison,
      },
    })

    // ActivityLog
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'MEMBER_INVITED', // action la plus proche disponible — SUSPEND idéalement
        entityType: 'Organization',
        entityId: id,
        metadata: {
          action: 'SUSPEND',
          raison,
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
    void logger.error('POST /api/admin/organisations/[id]/suspendre', err, { route: 'POST /api/admin/organisations/[id]/suspendre' })
    return internalError()
  }
}
