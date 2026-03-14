// ─────────────────────────────────────────────────────────
// PATCH  /api/projets/[id]/equipes/[equipeId]/postes/[posteId]
// DELETE /api/projets/[id]/equipes/[equipeId]/postes/[posteId]
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound, conflict } from '@/lib/api-response'
import logger from '@/lib/logger'

const PatchPosteSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  requiredCount: z.number().int().min(1).max(50).optional(),
  isCritique: z.boolean().optional(),
  contractTypePreference: z.enum(['CDI', 'CDD', 'INTERMITTENT', 'INDIFFERENT']).optional(),
  defaultStartTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  defaultEndTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
})

// ── PATCH ──────────────────────────────────────────────────
export async function PATCH(req: Request, { params }: { params: { id: string; equipeId: string; posteId: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const projet = await prisma.projet.findFirst({ where: { id: params.id } })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const poste = await prisma.posteRequis.findFirst({
      where: { id: params.posteId, equipeId: params.equipeId, projetId: params.id },
    })
    if (!poste) return notFound('Poste')

    const body = await req.json()
    const parsed = PatchPosteSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const updated = await prisma.posteRequis.update({
      where: { id: params.posteId },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.requiredCount !== undefined && { requiredCount: parsed.data.requiredCount }),
        ...(parsed.data.isCritique !== undefined && { isCritique: parsed.data.isCritique }),
        ...(parsed.data.contractTypePreference !== undefined && { contractTypePreference: parsed.data.contractTypePreference }),
        ...(parsed.data.defaultStartTime !== undefined && { defaultStartTime: parsed.data.defaultStartTime }),
        ...(parsed.data.defaultEndTime !== undefined && { defaultEndTime: parsed.data.defaultEndTime }),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    void logger.error('PATCH /api/projets/[id]/equipes/[equipeId]/postes/[posteId]', err, { route: 'PATCH /api/projets/[id]/equipes/[equipeId]/postes/[posteId]' })
    return internalError()
  }
}

// ── DELETE ─────────────────────────────────────────────────
export async function DELETE(req: Request, { params }: { params: { id: string; equipeId: string; posteId: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const projet = await prisma.projet.findFirst({ where: { id: params.id } })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const poste = await prisma.posteRequis.findFirst({
      where: { id: params.posteId, equipeId: params.equipeId, projetId: params.id },
      include: {
        affectations: {
          where: {
            representation: { date: { gte: new Date() } },
            deletedAt: null,
          },
        },
      },
    })
    if (!poste) return notFound('Poste')

    // Bloquer si affectations futures
    if (poste.affectations.length > 0) {
      return conflict(
        `Impossible de supprimer ce poste : ${poste.affectations.length} affectation(s) future(s) existent.`
      )
    }

    await prisma.posteRequis.delete({ where: { id: params.posteId } })

    return NextResponse.json({ success: true })
  } catch (err) {
    void logger.error('DELETE /api/projets/[id]/equipes/[equipeId]/postes/[posteId]', err, { route: 'DELETE /api/projets/[id]/equipes/[equipeId]/postes/[posteId]' })
    return internalError()
  }
}
