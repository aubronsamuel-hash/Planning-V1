// ─────────────────────────────────────────────────────────
// PATCH  /api/chambres/[id] — Modifier une chambre (type, occupants)
// DELETE /api/chambres/[id] — Supprimer une chambre
// doc/19-module-tournee.md §19.1 — ENTERPRISE uniquement
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound, forbidden } from '@/lib/api-response'
import { hasFeature } from '@/lib/plans'

const PatchChambreSchema = z.object({
  numero: z.string().max(20).nullable().optional(),
  type: z.enum(['INDIVIDUELLE', 'DOUBLE', 'DOUBLE_USAGE_SIMPLE', 'SUITE']).optional(),
  notes: z.string().max(500).nullable().optional(),
  // Remplacement complet des occupants par nuit (upsert)
  occupants: z.array(z.object({
    collaborateurId: z.string().cuid(),
    nuitDu: z.string().datetime(),
    notes: z.string().max(200).optional().nullable(),
  })).optional(),
})

async function getChambreWithOrg(id: string) {
  return prisma.chambre.findUnique({
    where: { id },
    include: {
      hebergement: {
        include: { projet: { select: { organizationId: true } } },
      },
    },
  })
}

// ── PATCH ──────────────────────────────────────────────────
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const chambre = await getChambreWithOrg(params.id)
    if (!chambre) return notFound('Chambre')

    const ownershipError = verifyOwnership(chambre.hebergement.projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId! },
      select: { plan: true },
    })
    if (!org || !hasFeature(org.plan, 'moduleTournee')) {
      return forbidden('Le module Tournée est réservé au plan ENTERPRISE. Passez sur /settings/organisation#facturation')
    }

    const body = await req.json()
    const parsed = PatchChambreSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { occupants, ...chambreFields } = parsed.data

    const updated = await prisma.$transaction(async (tx) => {
      // Mettre à jour la chambre
      const updatedChambre = await tx.chambre.update({
        where: { id: params.id },
        data: {
          ...(chambreFields.numero !== undefined && { numero: chambreFields.numero }),
          ...(chambreFields.type !== undefined && { type: chambreFields.type }),
          ...(chambreFields.notes !== undefined && { notes: chambreFields.notes }),
        },
      })

      // Si des occupants sont fournis, on remplace entièrement (delete + recreate)
      if (occupants !== undefined) {
        await tx.chambreOccupant.deleteMany({ where: { chambreId: params.id } })
        if (occupants.length > 0) {
          await tx.chambreOccupant.createMany({
            data: occupants.map(o => ({
              chambreId: params.id,
              collaborateurId: o.collaborateurId,
              nuitDu: new Date(o.nuitDu),
              notes: o.notes ?? null,
            })),
          })
        }
      }

      return tx.chambre.findUnique({
        where: { id: params.id },
        include: {
          occupants: {
            include: {
              collaborateur: {
                include: {
                  user: { select: { id: true, firstName: true, lastName: true } },
                },
              },
            },
          },
        },
      })
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/chambres/[id]]', err)
    return internalError()
  }
}

// ── DELETE ─────────────────────────────────────────────────
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const chambre = await getChambreWithOrg(params.id)
    if (!chambre) return notFound('Chambre')

    const ownershipError = verifyOwnership(chambre.hebergement.projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId! },
      select: { plan: true },
    })
    if (!org || !hasFeature(org.plan, 'moduleTournee')) {
      return forbidden('Le module Tournée est réservé au plan ENTERPRISE. Passez sur /settings/organisation#facturation')
    }

    await prisma.chambre.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/chambres/[id]]', err)
    return internalError()
  }
}
