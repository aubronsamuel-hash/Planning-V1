// ─────────────────────────────────────────────────────────
// PATCH /api/affectations/[id]/cachet
// RH tranche la décision cachet après annulation : DU | ANNULE
// doc §12.6 — Annulations & Reports
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound, conflict, forbidden } from '@/lib/api-response'
import logger from '@/lib/logger'

const CachetSchema = z.object({
  decision: z.enum(['DU', 'ANNULE']),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'RH', write: true })
    if (error) return error

    // Vérifier le rôle RH
    const roleOrg = session.user.organizationRole
    if (roleOrg !== 'RH' && roleOrg !== 'DIRECTEUR') {
      return forbidden('Seul le RH ou le Directeur peut trancher la décision cachet.')
    }

    const affectation = await prisma.affectation.findFirst({
      where: { id: params.id },
      include: {
        representation: {
          include: {
            projet: { select: { organizationId: true } },
          },
        },
      },
    })

    if (!affectation) return notFound('Affectation')

    const ownershipError = verifyOwnership(
      affectation.representation.projet.organizationId,
      session.user.organizationId!
    )
    if (ownershipError) return ownershipError

    if (
      affectation.confirmationStatus !== 'ANNULEE' &&
      affectation.confirmationStatus !== 'ANNULEE_TARDIVE'
    ) {
      return conflict('Seules les affectations annulées peuvent avoir une décision de cachet.')
    }

    if (!affectation.cachetAnnulation) {
      return conflict('Aucune décision de cachet en attente pour cette affectation.')
    }

    const body = await req.json()
    const parsed = CachetSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const updated = await prisma.affectation.update({
      where: { id: params.id },
      data: { cachetAnnulation: parsed.data.decision },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'AFFECTATION_ANNULEE', // réutilisation du log existant
        entityType: 'Affectation',
        entityId: params.id,
        metadata: {
          action: 'CACHET_DECISION',
          decision: parsed.data.decision,
        },
      },
    })

    return NextResponse.json({
      id: updated.id,
      cachetAnnulation: updated.cachetAnnulation,
    })
  } catch (err) {
    void logger.error('PATCH /api/affectations/[id]/cachet', err, { route: 'PATCH /api/affectations/[id]/cachet' })
    return internalError()
  }
}
