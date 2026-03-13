// ─────────────────────────────────────────────────────────
// GET  /api/projets/[id]/equipes/[equipeId]/postes — Liste des postes
// POST /api/projets/[id]/equipes/[equipeId]/postes — Créer un poste
// doc/03 §5.4 · doc/06 Règle #19 (héritage horaires) · Règle #33 (isCritique)
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'

const CreatePosteSchema = z.object({
  name: z.string().min(1).max(80),
  requiredCount: z.number().int().min(1).max(50).default(1),
  isCritique: z.boolean().default(false),
  contractTypePreference: z.enum(['CDI', 'CDD', 'INTERMITTENT', 'INDIFFERENT']).default('INDIFFERENT'),
  defaultStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  defaultEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
})

// ── GET ────────────────────────────────────────────────────
export async function GET(req: Request, { params }: { params: { id: string; equipeId: string } }) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const projet = await prisma.projet.findFirst({ where: { id: params.id } })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const postes = await prisma.posteRequis.findMany({
      where: { equipeId: params.equipeId, projetId: params.id },
      include: {
        _count: { select: { affectations: true } },
      },
    })

    return NextResponse.json(postes)
  } catch (err) {
    console.error('[GET /api/projets/[id]/equipes/[equipeId]/postes]', err)
    return internalError()
  }
}

// ── POST ───────────────────────────────────────────────────
export async function POST(req: Request, { params }: { params: { id: string; equipeId: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const projet = await prisma.projet.findFirst({ where: { id: params.id } })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    // Vérifier que l'équipe appartient bien au projet
    const equipe = await prisma.equipe.findFirst({
      where: { id: params.equipeId, projetId: params.id },
    })
    if (!equipe) return notFound('Équipe')

    const body = await req.json()
    const parsed = CreatePosteSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const poste = await prisma.posteRequis.create({
      data: {
        name: parsed.data.name,
        requiredCount: parsed.data.requiredCount,
        isCritique: parsed.data.isCritique,
        contractTypePreference: parsed.data.contractTypePreference,
        defaultStartTime: parsed.data.defaultStartTime,
        defaultEndTime: parsed.data.defaultEndTime,
        equipeId: params.equipeId,
        projetId: params.id,
      },
    })

    return NextResponse.json(poste, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projets/[id]/equipes/[equipeId]/postes]', err)
    return internalError()
  }
}
