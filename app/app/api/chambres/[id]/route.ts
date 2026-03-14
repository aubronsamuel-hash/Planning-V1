// ─────────────────────────────────────────────────────────
// PATCH  /api/chambres/[id] — Modifier chambre + occupants par nuit
// DELETE /api/chambres/[id] — Supprimer une chambre
// doc/19-module-tournee.md §19.1
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError, notFound, validationError } from '@/lib/api-response'

const OccupantSchema = z.object({
  collaborateurId: z.string(),
  nuitDu: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(200).optional(),
})

const PatchChambreSchema = z.object({
  numero: z.string().max(20).nullable().optional(),
  type: z.enum(['INDIVIDUELLE', 'DOUBLE', 'DOUBLE_USAGE_SIMPLE', 'SUITE']).optional(),
  notes: z.string().max(500).nullable().optional(),
  // occupants: remplace TOUS les occupants existants (deleteMany + createMany transactionnel)
  occupants: z.array(OccupantSchema).optional(),
})

async function loadChambre(id: string, organizationId: string) {
  return prisma.chambre.findFirst({
    where: { id },
    include: { hebergement: { include: { projet: { select: { organizationId: true } } } } },
  }).then((c) => {
    if (!c) return null
    if (c.hebergement.projet.organizationId !== organizationId) return null
    return c
  })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const chambre = await loadChambre(params.id, session.user.organizationId!)
    if (!chambre) return notFound('Chambre')

    const body = await req.json()
    const parsed = PatchChambreSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { numero, type, notes, occupants } = parsed.data

    await prisma.$transaction(async (tx) => {
      // Mettre à jour la chambre si des champs changent
      if (numero !== undefined || type !== undefined || notes !== undefined) {
        await tx.chambre.update({
          where: { id: params.id },
          data: {
            ...(numero !== undefined && { numero }),
            ...(type !== undefined && { type }),
            ...(notes !== undefined && { notes }),
          },
        })
      }

      // Remplacer tous les occupants atomiquement
      if (occupants !== undefined) {
        await tx.chambreOccupant.deleteMany({ where: { chambreId: params.id } })
        if (occupants.length > 0) {
          await tx.chambreOccupant.createMany({
            data: occupants.map((o) => ({
              chambreId: params.id,
              collaborateurId: o.collaborateurId,
              nuitDu: new Date(o.nuitDu),
              notes: o.notes,
            })),
          })
        }
      }
    })

    const updated = await prisma.chambre.findUnique({
      where: { id: params.id },
      include: {
        occupants: {
          include: {
            collaborateur: {
              include: { user: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
          orderBy: { nuitDu: 'asc' },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/chambres/[id]]', err)
    return internalError()
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const chambre = await loadChambre(params.id, session.user.organizationId!)
    if (!chambre) return notFound('Chambre')

    await prisma.chambre.delete({ where: { id: params.id } })

    return new Response(null, { status: 204 })
  } catch (err) {
    console.error('[DELETE /api/chambres/[id]]', err)
    return internalError()
  }
}
