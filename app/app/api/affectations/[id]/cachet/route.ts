// ─────────────────────────────────────────────────────────
// PATCH /api/affectations/[id]/cachet
// Décision RH sur le cachet suite à une annulation
// doc/12-annulations-reports.md §12.6
// Accès : RH minimum
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'

const CachetSchema = z.object({
  decision: z.enum(['DU', 'ANNULE']),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'RH', write: true })
    if (error) return error

    const body   = await req.json()
    const parsed = CachetSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const affectation = await prisma.affectation.findFirst({
      where: { id: params.id },
      include: {
        representation: {
          include: { projet: { select: { organizationId: true } } },
        },
      },
    })

    if (!affectation) return notFound('Affectation')

    const ownershipError = verifyOwnership(
      affectation.representation.projet.organizationId,
      session.user.organizationId!
    )
    if (ownershipError) return ownershipError

    // Vérifier que l'affectation est bien annulée
    if (
      affectation.confirmationStatus !== 'ANNULEE' &&
      affectation.confirmationStatus !== 'ANNULEE_TARDIVE'
    ) {
      return NextResponse.json(
        { error: 'Seules les affectations annulées peuvent avoir une décision de cachet.' },
        { status: 400 }
      )
    }

    await prisma.affectation.update({
      where: { id: params.id },
      data:  { cachetAnnulation: parsed.data.decision },
    })

    return NextResponse.json({ success: true, cachetAnnulation: parsed.data.decision })
  } catch (err) {
    console.error('[PATCH /api/affectations/[id]/cachet]', err)
    return internalError()
  }
}
