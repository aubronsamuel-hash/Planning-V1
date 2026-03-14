// ─────────────────────────────────────────────────────────
// POST /api/feuille-de-route/[id]/phases — Ajouter une phase
// doc/11 §11.3
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import { notifierModification } from '../route'
import logger from '@/lib/logger'

const CreatePhaseSchema = z.object({
  type: z.enum([
    'DECHARGEMENT', 'MONTAGE', 'BALANCES', 'CATERING', 'ECHAUFFEMENT',
    'REPRESENTATION', 'ENTRACTE', 'DEMONTAGE', 'PAUSE', 'AUTRE',
  ]),
  labelCustom: z.string().max(100).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  lieu: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
  ordre: z.number().int().min(1).optional(), // si absent → placé en dernier
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const fdr = await prisma.feuilleDeRoute.findFirst({
      where: { id: params.id },
      include: {
        representation: {
          include: { projet: { select: { organizationId: true, title: true } } },
        },
        _count: { select: { phases: true } },
      },
    })
    if (!fdr) return notFound('Feuille de route')
    if (fdr.representation.projet.organizationId !== session.user.organizationId!) {
      return NextResponse.json({ error: 'Accès refusé', code: 'FORBIDDEN' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = CreatePhaseSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const ordre = parsed.data.ordre ?? fdr._count.phases + 1

    const phase = await prisma.phaseJournee.create({
      data: {
        feuilleDeRouteId: params.id,
        type: parsed.data.type,
        labelCustom: parsed.data.labelCustom,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        lieu: parsed.data.lieu,
        notes: parsed.data.notes,
        ordre,
      },
    })

    // Si FDR déjà publiée → signaler la modification (§11.6)
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

    return NextResponse.json(phase, { status: 201 })
  } catch (err) {
    void logger.error('POST /api/feuille-de-route/[id]/phases', err, { route: 'POST /api/feuille-de-route/[id]/phases' })
    return internalError()
  }
}
