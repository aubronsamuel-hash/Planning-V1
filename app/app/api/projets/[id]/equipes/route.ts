// ─────────────────────────────────────────────────────────
// GET  /api/projets/[id]/equipes — Liste des équipes d'un projet
// POST /api/projets/[id]/equipes — Créer une équipe
// doc/03-workflows.md §5.4 — Constituer les équipes
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import logger from '@/lib/logger'

const CreateEquipeSchema = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().max(4).optional(),   // ex: "🔧", "🏛️"
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  chefUserId: z.string().cuid().optional(), // Si fourni → EquipeMembre role=CHEF
})

// ── GET ────────────────────────────────────────────────────
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const projet = await prisma.projet.findFirst({ where: { id: params.id } })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const equipes = await prisma.equipe.findMany({
      where: { projetId: params.id },
      include: {
        membres: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        postesRequis: {
          include: {
            _count: { select: { affectations: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
    })

    return NextResponse.json(equipes)
  } catch (err) {
    void logger.error('GET /api/projets/[id]/equipes', err, { route: 'GET /api/projets/[id]/equipes' })
    return internalError()
  }
}

// ── POST ───────────────────────────────────────────────────
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const projet = await prisma.projet.findFirst({ where: { id: params.id } })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const body = await req.json()
    const parsed = CreateEquipeSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { name, icon, color, chefUserId } = parsed.data

    // Si chefUserId fourni, vérifier qu'il appartient à l'org
    if (chefUserId) {
      const membership = await prisma.organizationMembership.findUnique({
        where: { userId_organizationId: { userId: chefUserId, organizationId: projet.organizationId } },
      })
      if (!membership) return notFound('Chef de poste')
    }

    const equipe = await prisma.$transaction(async (tx) => {
      const eq = await tx.equipe.create({
        data: { name, icon, color, projetId: params.id },
      })

      // Si un chef est désigné → créer EquipeMembre avec role=CHEF
      if (chefUserId) {
        await tx.equipeMembre.create({
          data: { equipeId: eq.id, userId: chefUserId, role: 'CHEF' },
        })
      }

      return eq
    })

    return NextResponse.json(equipe, { status: 201 })
  } catch (err) {
    void logger.error('POST /api/projets/[id]/equipes', err, { route: 'POST /api/projets/[id]/equipes' })
    return internalError()
  }
}
