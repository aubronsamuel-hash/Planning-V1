// ─────────────────────────────────────────────────────────
// PATCH  /api/feuille-de-route/[id]/phases/[phaseId]
// DELETE /api/feuille-de-route/[id]/phases/[phaseId]
// doc/11 §11.3
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import { notifierModification } from '../../route'

const PatchPhaseSchema = z.object({
  type: z.enum([
    'DECHARGEMENT', 'MONTAGE', 'BALANCES', 'CATERING', 'ECHAUFFEMENT',
    'REPRESENTATION', 'ENTRACTE', 'DEMONTAGE', 'PAUSE', 'AUTRE',
  ]).optional(),
  labelCustom: z.string().max(100).nullable().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  lieu: z.string().max(200).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  ordre: z.number().int().min(1).optional(),
})

// ── Résoudre la phase + vérifier ownership ─────────────────
async function resolvePhase(phaseId: string, fdrId: string, orgId: string) {
  const phase = await prisma.phaseJournee.findFirst({
    where: { id: phaseId, feuilleDeRouteId: fdrId },
  })
  if (!phase) return { phase: null, fdr: null, ownerError: null }

  const fdr = await prisma.feuilleDeRoute.findFirst({
    where: { id: fdrId },
    include: {
      representation: {
        include: { projet: { select: { organizationId: true, title: true } } },
      },
    },
  })
  if (!fdr) return { phase: null, fdr: null, ownerError: null }

  if (fdr.representation.projet.organizationId !== orgId) {
    return {
      phase: null,
      fdr: null,
      ownerError: NextResponse.json({ error: 'Accès refusé', code: 'FORBIDDEN' }, { status: 403 }),
    }
  }

  return { phase, fdr, ownerError: null }
}

// ── PATCH ──────────────────────────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; phaseId: string } }
) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const { phase, fdr, ownerError } = await resolvePhase(
      params.phaseId,
      params.id,
      session.user.organizationId!
    )
    if (ownerError) return ownerError
    if (!phase || !fdr) return notFound('Phase')

    const body = await req.json()
    const parsed = PatchPhaseSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const updated = await prisma.phaseJournee.update({
      where: { id: params.phaseId },
      data: {
        ...(parsed.data.type        !== undefined && { type:        parsed.data.type        }),
        ...(parsed.data.labelCustom !== undefined && { labelCustom: parsed.data.labelCustom }),
        ...(parsed.data.startTime   !== undefined && { startTime:   parsed.data.startTime   }),
        ...(parsed.data.endTime     !== undefined && { endTime:     parsed.data.endTime     }),
        ...(parsed.data.lieu        !== undefined && { lieu:        parsed.data.lieu        }),
        ...(parsed.data.notes       !== undefined && { notes:       parsed.data.notes       }),
        ...(parsed.data.ordre       !== undefined && { ordre:       parsed.data.ordre       }),
      },
    })

    if (fdr.statut === 'PUBLIEE') {
      await notifierModification(params.id, fdr.representation, session.user.organizationId!)
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'FEUILLE_DE_ROUTE_MODIFIEE',
          entityType: 'FeuilleDeRoute',
          entityId: params.id,
        },
      })
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/feuille-de-route/[id]/phases/[phaseId]]', err)
    return internalError()
  }
}

// ── DELETE ─────────────────────────────────────────────────
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; phaseId: string } }
) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const { phase, fdr, ownerError } = await resolvePhase(
      params.phaseId,
      params.id,
      session.user.organizationId!
    )
    if (ownerError) return ownerError
    if (!phase || !fdr) return notFound('Phase')

    await prisma.phaseJournee.delete({ where: { id: params.phaseId } })

    if (fdr.statut === 'PUBLIEE') {
      await notifierModification(params.id, fdr.representation, session.user.organizationId!)
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'FEUILLE_DE_ROUTE_MODIFIEE',
          entityType: 'FeuilleDeRoute',
          entityId: params.id,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/feuille-de-route/[id]/phases/[phaseId]]', err)
    return internalError()
  }
}
