// ─────────────────────────────────────────────────────────
// GET    /api/projets/[id] — Détail d'un projet
// PATCH  /api/projets/[id] — Modifier un projet
// DELETE /api/projets/[id] — Supprimer (soft delete)
// doc/03 §5.2 · doc/06 Règle #5 (soft delete)
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import logger from '@/lib/logger'

const PALETTE_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316', '#EAB308',
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6', '#64748B', '#A16207',
]

const PatchProjetSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  subtitle: z.string().max(100).nullable().optional(),
  type: z.enum(['THEATRE', 'COMEDIE_MUSICALE', 'CONCERT', 'OPERA', 'DANSE', 'CIRQUE', 'MAINTENANCE', 'EVENEMENT', 'AUTRE']).optional(),
  colorCode: z.string().regex(/^#[0-9A-Fa-f]{6}$/).refine(
    (c) => PALETTE_COLORS.includes(c), { message: 'Couleur non autorisée' }
  ).optional(),
  status: z.enum(['EN_PREPARATION', 'EN_COURS', 'TERMINE', 'ARCHIVE', 'ANNULE']).optional(),
  regisseurId: z.string().cuid().optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  posterUrl: z.string().url().nullable().optional(),
})

// ── GET ────────────────────────────────────────────────────
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const projet = await prisma.projet.findFirst({
      where: { id: params.id },
      include: {
        equipes: {
          include: {
            membres: {
              include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
            },
            postesRequis: true,
          },
        },
        representations: {
          orderBy: { date: 'asc' },
          include: {
            _count: { select: { affectations: true } },
          },
        },
        _count: { select: { representations: true } },
      },
    })

    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    return NextResponse.json(projet)
  } catch (err) {
    void logger.error('GET /api/projets/[id]', err, { route: 'GET /api/projets/[id]' })
    return internalError()
  }
}

// ── PATCH ──────────────────────────────────────────────────
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const body = await req.json()
    const parsed = PatchProjetSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const projet = await prisma.projet.findFirst({ where: { id: params.id } })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const updated = await prisma.projet.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.subtitle !== undefined && { subtitle: parsed.data.subtitle }),
        ...(parsed.data.type !== undefined && { type: parsed.data.type }),
        ...(parsed.data.colorCode !== undefined && { colorCode: parsed.data.colorCode }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.regisseurId !== undefined && { regisseurId: parsed.data.regisseurId }),
        ...(parsed.data.startDate !== undefined && { startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null }),
        ...(parsed.data.endDate !== undefined && { endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null }),
        ...(parsed.data.posterUrl !== undefined && { posterUrl: parsed.data.posterUrl }),
      },
    })

    // Tracer l'annulation si applicable
    if (parsed.data.status === 'ANNULE') {
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'PROJET_ANNULE',
          entityType: 'Projet',
          entityId: projet.id,
          metadata: { title: projet.title },
        },
      })
    } else if (parsed.data.status === 'ARCHIVE') {
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'PROJET_ARCHIVE',
          entityType: 'Projet',
          entityId: projet.id,
          metadata: { title: projet.title },
        },
      })
    }

    return NextResponse.json(updated)
  } catch (err) {
    void logger.error('PATCH /api/projets/[id]', err, { route: 'PATCH /api/projets/[id]' })
    return internalError()
  }
}

// ── DELETE — soft delete ───────────────────────────────────
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'DIRECTEUR', write: true })
    if (error) return error

    const projet = await prisma.projet.findFirst({ where: { id: params.id } })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    // Soft delete uniquement — jamais de DELETE réel (Règle #5)
    await prisma.projet.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    void logger.error('DELETE /api/projets/[id]', err, { route: 'DELETE /api/projets/[id]' })
    return internalError()
  }
}
