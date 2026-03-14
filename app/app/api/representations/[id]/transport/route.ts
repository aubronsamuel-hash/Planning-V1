// ─────────────────────────────────────────────────────────
// GET  /api/representations/[id]/transport — Assignations transport
// POST /api/representations/[id]/transport — Assigner un véhicule
// doc/19-module-tournee.md §19.2
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { conflict, forbidden, internalError, notFound, validationError } from '@/lib/api-response'
import { hasFeature } from '@/lib/plans'

const PassagerSchema = z.object({
  collaborateurId: z.string(),
  role: z.enum(['CONDUCTEUR', 'PASSAGER']),
})

const CreateTransportSchema = z.object({
  vehiculeId: z.string(),
  departLieu: z.string().max(200).optional(),
  departTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  arriveeEstimeeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().max(500).optional(),
  passagers: z.array(PassagerSchema),
})

// ── GET ────────────────────────────────────────────────────
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const representation = await prisma.representation.findFirst({
      where: { id: params.id },
      include: { projet: { include: { organization: { select: { plan: true } } } } },
    })
    if (!representation) return notFound('Représentation')

    const ownershipError = verifyOwnership(representation.projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    if (!hasFeature(representation.projet.organization.plan, 'moduleTournee')) {
      return forbidden('Module Tournée disponible sur le plan ENTERPRISE uniquement')
    }

    const assignments = await prisma.vehiculeAssignment.findMany({
      where: { representationId: params.id },
      include: {
        vehicule: { select: { id: true, label: true, type: true, capacitePersonnes: true } },
        passagers: {
          include: {
            collaborateur: {
              include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } },
            },
          },
        },
      },
      orderBy: { departTime: 'asc' },
    })

    return NextResponse.json(assignments)
  } catch (err) {
    console.error('[GET /api/representations/[id]/transport]', err)
    return internalError()
  }
}

// ── POST ───────────────────────────────────────────────────
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const representation = await prisma.representation.findFirst({
      where: { id: params.id },
      include: { projet: { include: { organization: { select: { plan: true } } } } },
    })
    if (!representation) return notFound('Représentation')

    const ownershipError = verifyOwnership(representation.projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    if (!hasFeature(representation.projet.organization.plan, 'moduleTournee')) {
      return forbidden('Module Tournée disponible sur le plan ENTERPRISE uniquement — /settings/organisation#facturation')
    }

    const body = await req.json()
    const parsed = CreateTransportSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { vehiculeId, departLieu, departTime, arriveeEstimeeTime, notes, passagers } = parsed.data

    // Vérifier que le véhicule appartient à la même organisation
    const vehicule = await prisma.vehicule.findFirst({
      where: { id: vehiculeId, organizationId: session.user.organizationId!, actif: true },
    })
    if (!vehicule) return notFound('Véhicule')

    // Contrainte : un seul CONDUCTEUR par VehiculeAssignment
    const conducteurs = passagers.filter((p) => p.role === 'CONDUCTEUR')
    if (conducteurs.length > 1) {
      return conflict('Un seul conducteur autorisé par véhicule et représentation')
    }

    const assignment = await prisma.vehiculeAssignment.create({
      data: {
        vehiculeId,
        representationId: params.id,
        departLieu,
        departTime,
        arriveeEstimeeTime,
        notes,
        passagers: {
          create: passagers.map((p) => ({
            collaborateurId: p.collaborateurId,
            role: p.role,
          })),
        },
      },
      include: {
        vehicule: { select: { id: true, label: true, type: true, capacitePersonnes: true } },
        passagers: {
          include: {
            collaborateur: {
              include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } },
            },
          },
        },
      },
    })

    return NextResponse.json(assignment, { status: 201 })
  } catch (err) {
    console.error('[POST /api/representations/[id]/transport]', err)
    return internalError()
  }
}
