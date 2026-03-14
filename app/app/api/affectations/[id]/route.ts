// ─────────────────────────────────────────────────────────
// GET    /api/affectations/[id]
// PATCH  /api/affectations/[id] — Modifier horaires, rémunération, notes
// DELETE /api/affectations/[id] — Soft delete (annulation)
// doc/06 Règle #5 (soft delete)
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import { detectConflict } from '@/lib/conflicts'
import { eventBus } from '@/lib/event-bus'
import logger from '@/lib/logger'

const PatchAffectationSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  remuneration: z.number().int().min(0).nullable().optional(),
  heuresContrat: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

// ── GET ────────────────────────────────────────────────────
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const affectation = await prisma.affectation.findFirst({
      where: { id: params.id },
      include: {
        collaborateur: {
          include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } } },
        },
        representation: {
          include: { projet: { select: { id: true, organizationId: true, title: true } } },
        },
        posteRequis: true,
      },
    })

    if (!affectation) return notFound('Affectation')

    const ownershipError = verifyOwnership(affectation.representation.projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    return NextResponse.json(affectation)
  } catch (err) {
    void logger.error('GET /api/affectations/[id]', err, { route: 'GET /api/affectations/[id]' })
    return internalError()
  }
}

// ── PATCH ──────────────────────────────────────────────────
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'COLLABORATEUR', write: true })
    if (error) return error

    const affectation = await prisma.affectation.findFirst({
      where: { id: params.id },
      include: {
        representation: {
          include: { projet: { select: { id: true, organizationId: true } } },
        },
      },
    })
    if (!affectation) return notFound('Affectation')

    const ownershipError = verifyOwnership(affectation.representation.projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const body = await req.json()
    const parsed = PatchAffectationSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const newStartTime = parsed.data.startTime ?? affectation.startTime
    const newEndTime   = parsed.data.endTime   ?? affectation.endTime

    // Re-vérifier les conflits si les horaires changent
    let hasConflict = affectation.hasConflict
    if (parsed.data.startTime || parsed.data.endTime) {
      const { hasConflict: newConflict } = await detectConflict(
        affectation.collaborateurId,
        affectation.representation.date,
        newStartTime,
        newEndTime,
        affectation.id
      )
      hasConflict = newConflict
    }

    const updated = await prisma.affectation.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.startTime !== undefined && { startTime: parsed.data.startTime }),
        ...(parsed.data.endTime !== undefined && { endTime: parsed.data.endTime }),
        ...(parsed.data.remuneration !== undefined && { remuneration: parsed.data.remuneration }),
        ...(parsed.data.heuresContrat !== undefined && { heuresContrat: parsed.data.heuresContrat }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
        hasConflict,
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    void logger.error('PATCH /api/affectations/[id]', err, { route: 'PATCH /api/affectations/[id]' })
    return internalError()
  }
}

// ── DELETE — soft delete (annulation) ─────────────────────
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'COLLABORATEUR', write: true })
    if (error) return error

    const affectation = await prisma.affectation.findFirst({
      where: { id: params.id },
      include: {
        representation: {
          include: { projet: { select: { id: true, organizationId: true } } },
        },
        collaborateur: {
          include: { user: { select: { id: true } } },
        },
      },
    })
    if (!affectation) return notFound('Affectation')

    const ownershipError = verifyOwnership(affectation.representation.projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    // Déterminer si annulation tardive (Règle #23 : ≤ 48h avant showStartTime)
    const now = new Date()
    const repDate = new Date(affectation.representation.date)
    if (affectation.representation.showStartTime) {
      const [h, m] = affectation.representation.showStartTime.split(':').map(Number)
      repDate.setHours(h, m, 0, 0)
    }
    const diffHours = (repDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    const isTardive = diffHours <= 48

    const newStatus = isTardive ? 'ANNULEE_TARDIVE' : 'ANNULEE'

    await prisma.$transaction(async (tx) => {
      // Soft delete + mise à jour du statut de confirmation
      await tx.affectation.update({
        where: { id: params.id },
        data: {
          deletedAt: new Date(),
          confirmationStatus: newStatus,
          annulationDate: new Date(),
        },
      })

      // Tracer
      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          action: isTardive ? 'AFFECTATION_ANNULEE_TARDIVE' : 'AFFECTATION_ANNULEE',
          entityType: 'Affectation',
          entityId: params.id,
          metadata: { isTardive, diffHours: Math.round(diffHours) },
        },
      })
    })

    // Émettre SSE
    eventBus.emit(`planning:${affectation.representation.projet.id}`, {
      type: 'affectation_updated',
      payload: {
        affectationId: params.id,
        confirmationStatus: newStatus,
        representationId: affectation.representationId,
        posteRequisId: affectation.posteRequisId,
      },
    })

    return NextResponse.json({ success: true, isTardive })
  } catch (err) {
    void logger.error('DELETE /api/affectations/[id]', err, { route: 'DELETE /api/affectations/[id]' })
    return internalError()
  }
}
