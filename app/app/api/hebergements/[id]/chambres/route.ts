// ─────────────────────────────────────────────────────────
// POST /api/hebergements/[id]/chambres — Ajouter une chambre
// doc/19-module-tournee.md §19.1 — ENTERPRISE uniquement
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound, forbidden } from '@/lib/api-response'
import { hasFeature } from '@/lib/plans'

const CreateChambreSchema = z.object({
  numero: z.string().max(20).optional(),
  type: z.enum(['INDIVIDUELLE', 'DOUBLE', 'DOUBLE_USAGE_SIMPLE', 'SUITE']),
  notes: z.string().max(500).optional(),
  // occupants par nuit (optionnel à la création)
  occupants: z.array(z.object({
    collaborateurId: z.string().cuid(),
    nuitDu: z.string().datetime(),
    notes: z.string().max(200).optional(),
  })).optional(),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const hebergement = await prisma.hebergement.findUnique({
      where: { id: params.id },
      include: { projet: { select: { organizationId: true } } },
    })
    if (!hebergement) return notFound('Hébergement')

    const ownershipError = verifyOwnership(hebergement.projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId! },
      select: { plan: true },
    })
    if (!org || !hasFeature(org.plan, 'moduleTournee')) {
      return forbidden('Le module Tournée est réservé au plan ENTERPRISE. Passez sur /settings/organisation#facturation')
    }

    const body = await req.json()
    const parsed = CreateChambreSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { numero, type, notes, occupants } = parsed.data

    const chambre = await prisma.chambre.create({
      data: {
        hebergementId: params.id,
        numero,
        type,
        notes,
        ...(occupants && occupants.length > 0 ? {
          occupants: {
            create: occupants.map(o => ({
              collaborateurId: o.collaborateurId,
              nuitDu: new Date(o.nuitDu),
              notes: o.notes,
            })),
          },
        } : {}),
      },
      include: {
        occupants: {
          include: {
            collaborateur: {
              include: { user: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
    })

    return NextResponse.json(chambre, { status: 201 })
  } catch (err) {
    console.error('[POST /api/hebergements/[id]/chambres]', err)
    return internalError()
  }
}
