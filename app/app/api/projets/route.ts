// ─────────────────────────────────────────────────────────
// GET  /api/projets — Liste des projets de l'org active
// POST /api/projets — Créer un nouveau projet
// doc/03-workflows.md §5.2 · doc/06 Règle #34 · doc/20 plans
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, quotaExceeded, notFound } from '@/lib/api-response'
import { canAddProjet, PLAN_LIMITS } from '@/lib/plans'

// Palette fixe 12 couleurs — Règle #34
const PALETTE_COLORS = [
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#64748B', // Slate
  '#A16207', // Amber dark
]

const CreateProjetSchema = z.object({
  title: z.string().min(1).max(100),
  subtitle: z.string().max(100).optional(),
  type: z.enum(['THEATRE', 'COMEDIE_MUSICALE', 'CONCERT', 'OPERA', 'DANSE', 'CIRQUE', 'MAINTENANCE', 'EVENEMENT', 'AUTRE']),
  colorCode: z.string().regex(/^#[0-9A-Fa-f]{6}$/).refine(
    (c) => PALETTE_COLORS.includes(c),
    { message: 'Couleur non autorisée — utiliser la palette prédéfinie' }
  ),
  regisseurId: z.string().cuid(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  posterUrl: z.string().url().optional(),
})

// ── GET — Liste des projets ────────────────────────────────
export async function GET(req: Request) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const year = searchParams.get('year')
    const search = searchParams.get('q')

    const whereClause: Record<string, unknown> = {
      organizationId: session.user.organizationId!,
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { subtitle: { contains: search, mode: 'insensitive' } },
        ]
      } : {}),
      ...(year ? {
        OR: [
          { startDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } },
          { endDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } },
        ]
      } : {}),
    }

    const projets = await prisma.projet.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            representations: true,
            equipes: true,
          }
        },
        equipes: {
          include: {
            membres: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Enrichir avec le count de collaborateurs distincts
    const projetsEnrichis = projets.map((p) => {
      const collaborateursIds = new Set(
        p.equipes.flatMap(e => e.membres.map(m => m.userId))
      )
      return {
        id: p.id,
        title: p.title,
        subtitle: p.subtitle,
        posterUrl: p.posterUrl,
        type: p.type,
        status: p.status,
        colorCode: p.colorCode,
        startDate: p.startDate,
        endDate: p.endDate,
        organizationId: p.organizationId,
        regisseurId: p.regisseurId,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        representationsCount: p._count.representations,
        collaborateursCount: collaborateursIds.size,
      }
    })

    return NextResponse.json(projetsEnrichis)
  } catch (err) {
    console.error('[GET /api/projets]', err)
    return internalError()
  }
}

// ── POST — Créer un projet ─────────────────────────────────
export async function POST(req: Request) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const body = await req.json()
    const parsed = CreateProjetSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { title, subtitle, type, colorCode, regisseurId, startDate, endDate, posterUrl } = parsed.data
    const organizationId = session.user.organizationId!

    // Vérifier quota plan (projets actifs = EN_PREPARATION | EN_COURS)
    const org = await prisma.organization.findFirst({
      where: { id: organizationId },
      select: { plan: true },
    })
    if (!org) return notFound('Organisation')

    const activeCount = await prisma.projet.count({
      where: {
        organizationId,
        status: { in: ['EN_PREPARATION', 'EN_COURS'] },
      },
    })

    if (!canAddProjet(org.plan, activeCount)) {
      return quotaExceeded(
        `Limite de ${PLAN_LIMITS[org.plan].maxProjetsActifs} projet(s) actif(s) atteinte pour le plan ${org.plan}. Passez sur /settings/organisation#facturation pour augmenter votre quota.`
      )
    }

    // Vérifier que le régisseur appartient à l'organisation
    const regisseurMembership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: regisseurId, organizationId } },
    })
    if (!regisseurMembership) return notFound('Régisseur')

    const projet = await prisma.projet.create({
      data: {
        title,
        subtitle,
        type,
        colorCode,
        regisseurId,
        organizationId,
        status: 'EN_PREPARATION',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        posterUrl,
      },
    })

    // Tracer l'action
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'PROJET_CREATED',
        entityType: 'Projet',
        entityId: projet.id,
        metadata: { title },
      },
    })

    return NextResponse.json(projet, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projets]', err)
    return internalError()
  }
}
