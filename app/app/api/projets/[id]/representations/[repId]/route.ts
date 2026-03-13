// ─────────────────────────────────────────────────────────
// GET    /api/projets/[id]/representations/[repId]
// PATCH  /api/projets/[id]/representations/[repId]
// DELETE /api/projets/[id]/representations/[repId] — soft delete
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'

const PatchRepresentationSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.enum(['REPRESENTATION', 'REPETITION', 'FILAGE', 'GENERALE', 'AVANT_PREMIERE', 'INTERVENTION', 'EVENEMENT']).optional(),
  status: z.enum(['PLANIFIEE', 'CONFIRMEE', 'ANNULEE', 'REPORTEE']).optional(),
  getInTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  warmupTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  showStartTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  showEndTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  getOutTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  venueName: z.string().max(100).nullable().optional(),
  venueCity: z.string().max(100).nullable().optional(),
  venueAddress: z.string().max(200).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  annulationReason: z.string().max(500).optional(),
})

// ── GET ────────────────────────────────────────────────────
export async function GET(req: Request, { params }: { params: { id: string; repId: string } }) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const projet = await prisma.projet.findFirst({ where: { id: params.id } })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const rep = await prisma.representation.findFirst({
      where: { id: params.repId, projetId: params.id },
      include: {
        affectations: {
          include: {
            collaborateur: {
              include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
            },
            posteRequis: true,
          },
        },
      },
    })

    if (!rep) return notFound('Représentation')

    return NextResponse.json(rep)
  } catch (err) {
    console.error('[GET /api/projets/[id]/representations/[repId]]', err)
    return internalError()
  }
}

// ── PATCH ──────────────────────────────────────────────────
export async function PATCH(req: Request, { params }: { params: { id: string; repId: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const projet = await prisma.projet.findFirst({ where: { id: params.id } })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const rep = await prisma.representation.findFirst({
      where: { id: params.repId, projetId: params.id },
    })
    if (!rep) return notFound('Représentation')

    const body = await req.json()
    const parsed = PatchRepresentationSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const updateData: Record<string, unknown> = {}

    if (parsed.data.date !== undefined) updateData.date = new Date(parsed.data.date)
    if (parsed.data.type !== undefined) updateData.type = parsed.data.type
    if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status
      if (parsed.data.status === 'ANNULEE') {
        updateData.annulationAt = new Date()
        updateData.annulationReason = parsed.data.annulationReason ?? null
      }
    }
    if (parsed.data.getInTime !== undefined) updateData.getInTime = parsed.data.getInTime
    if (parsed.data.warmupTime !== undefined) updateData.warmupTime = parsed.data.warmupTime
    if (parsed.data.showStartTime !== undefined) updateData.showStartTime = parsed.data.showStartTime
    if (parsed.data.showEndTime !== undefined) updateData.showEndTime = parsed.data.showEndTime
    if (parsed.data.getOutTime !== undefined) updateData.getOutTime = parsed.data.getOutTime
    if (parsed.data.venueName !== undefined) updateData.venueName = parsed.data.venueName
    if (parsed.data.venueCity !== undefined) updateData.venueCity = parsed.data.venueCity
    if (parsed.data.venueAddress !== undefined) updateData.venueAddress = parsed.data.venueAddress
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes

    const updated = await prisma.representation.update({
      where: { id: params.repId },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/projets/[id]/representations/[repId]]', err)
    return internalError()
  }
}

// ── DELETE — soft delete ───────────────────────────────────
export async function DELETE(req: Request, { params }: { params: { id: string; repId: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const projet = await prisma.projet.findFirst({ where: { id: params.id } })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const rep = await prisma.representation.findFirst({
      where: { id: params.repId, projetId: params.id },
    })
    if (!rep) return notFound('Représentation')

    await prisma.representation.update({
      where: { id: params.repId },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/projets/[id]/representations/[repId]]', err)
    return internalError()
  }
}
