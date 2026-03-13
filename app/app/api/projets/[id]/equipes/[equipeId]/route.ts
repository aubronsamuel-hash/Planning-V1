// ─────────────────────────────────────────────────────────
// PATCH  /api/projets/[id]/equipes/[equipeId] — Modifier une équipe
// DELETE /api/projets/[id]/equipes/[equipeId] — Supprimer une équipe
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound, conflict } from '@/lib/api-response'

const PatchEquipeSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  icon: z.string().max(4).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  chefUserId: z.string().cuid().nullable().optional(),
})

// ── PATCH ──────────────────────────────────────────────────
export async function PATCH(req: Request, { params }: { params: { id: string; equipeId: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const projet = await prisma.projet.findFirst({ where: { id: params.id } })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const equipe = await prisma.equipe.findFirst({ where: { id: params.equipeId, projetId: params.id } })
    if (!equipe) return notFound('Équipe')

    const body = await req.json()
    const parsed = PatchEquipeSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    await prisma.$transaction(async (tx) => {
      // Mettre à jour les champs de l'équipe
      if (parsed.data.name !== undefined || parsed.data.icon !== undefined || parsed.data.color !== undefined) {
        await tx.equipe.update({
          where: { id: params.equipeId },
          data: {
            ...(parsed.data.name !== undefined && { name: parsed.data.name }),
            ...(parsed.data.icon !== undefined && { icon: parsed.data.icon }),
            ...(parsed.data.color !== undefined && { color: parsed.data.color }),
          },
        })
      }

      // Changer le chef de poste
      if (parsed.data.chefUserId !== undefined) {
        if (parsed.data.chefUserId === null) {
          // Retirer le chef actuel (passer CHEF → MEMBRE)
          await tx.equipeMembre.updateMany({
            where: { equipeId: params.equipeId, role: 'CHEF' },
            data: { role: 'MEMBRE' },
          })
        } else {
          // Vérifier que l'user appartient à l'org
          const membership = await tx.organizationMembership.findUnique({
            where: { userId_organizationId: { userId: parsed.data.chefUserId, organizationId: projet.organizationId } },
          })
          if (!membership) throw new Error('CHEF_NOT_FOUND')

          // Retirer l'ancien chef
          await tx.equipeMembre.updateMany({
            where: { equipeId: params.equipeId, role: 'CHEF' },
            data: { role: 'MEMBRE' },
          })

          // Upsert le nouveau chef
          await tx.equipeMembre.upsert({
            where: { equipeId_userId: { equipeId: params.equipeId, userId: parsed.data.chefUserId } },
            create: { equipeId: params.equipeId, userId: parsed.data.chefUserId, role: 'CHEF' },
            update: { role: 'CHEF' },
          })
        }
      }
    })

    const updated = await prisma.equipe.findFirst({
      where: { id: params.equipeId },
      include: {
        membres: {
          include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
        },
        postesRequis: true,
      },
    })

    return NextResponse.json(updated)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'CHEF_NOT_FOUND') return notFound('Chef de poste')
    console.error('[PATCH /api/projets/[id]/equipes/[equipeId]]', err)
    return internalError()
  }
}

// ── DELETE ─────────────────────────────────────────────────
export async function DELETE(req: Request, { params }: { params: { id: string; equipeId: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const projet = await prisma.projet.findFirst({ where: { id: params.id } })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const equipe = await prisma.equipe.findFirst({
      where: { id: params.equipeId, projetId: params.id },
      include: {
        postesRequis: {
          include: {
            affectations: {
              where: {
                representation: { date: { gte: new Date() } },
                deletedAt: null,
              },
            },
          },
        },
      },
    })
    if (!equipe) return notFound('Équipe')

    // Bloquer si des affectations futures existent
    const affectationsFutures = equipe.postesRequis.flatMap(p => p.affectations)
    if (affectationsFutures.length > 0) {
      return conflict(
        `Impossible de supprimer l'équipe : ${affectationsFutures.length} affectation(s) future(s) existent. Annulez-les d'abord.`
      )
    }

    await prisma.equipe.delete({ where: { id: params.equipeId } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/projets/[id]/equipes/[equipeId]]', err)
    return internalError()
  }
}
