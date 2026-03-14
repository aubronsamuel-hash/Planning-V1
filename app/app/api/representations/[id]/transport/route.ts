// ─────────────────────────────────────────────────────────
// POST /api/representations/[id]/transport — Assigner un véhicule à une représentation
// doc/19-module-tournee.md §19.2 — ENTERPRISE uniquement
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound, forbidden, conflict } from '@/lib/api-response'
import { hasFeature } from '@/lib/plans'
import logger from '@/lib/logger'

const CreateVehiculeAssignmentSchema = z.object({
  vehiculeId: z.string().cuid(),
  departLieu: z.string().max(300).optional(),
  departTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), // "HH:MM"
  arriveeEstimeeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().max(1000).optional(),
  // Passagers (conducteur + passagers)
  passagers: z.array(z.object({
    collaborateurId: z.string().cuid(),
    role: z.enum(['CONDUCTEUR', 'PASSAGER']),
  })).optional(),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const representation = await prisma.representation.findFirst({
      where: { id: params.id },
      include: { projet: { select: { organizationId: true } } },
    })
    if (!representation) return notFound('Représentation')

    const ownershipError = verifyOwnership(representation.projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId! },
      select: { plan: true },
    })
    if (!org || !hasFeature(org.plan, 'moduleTournee')) {
      return forbidden('Le module Tournée est réservé au plan ENTERPRISE. Passez sur /settings/organisation#facturation')
    }

    const body = await req.json()
    const parsed = CreateVehiculeAssignmentSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { vehiculeId, departLieu, departTime, arriveeEstimeeTime, notes, passagers } = parsed.data

    // Vérifier que le véhicule appartient bien à l'organisation
    const vehicule = await prisma.vehicule.findUnique({ where: { id: vehiculeId } })
    if (!vehicule || vehicule.organizationId !== session.user.organizationId!) {
      return notFound('Véhicule')
    }
    if (!vehicule.actif) {
      return forbidden('Ce véhicule est archivé et ne peut plus être assigné')
    }

    // Vérifier qu'il n'y a pas déjà une assignation pour ce véhicule + représentation
    const existingAssignment = await prisma.vehiculeAssignment.findUnique({
      where: { vehiculeId_representationId: { vehiculeId, representationId: params.id } },
    })
    if (existingAssignment) {
      return conflict('Ce véhicule est déjà assigné à cette représentation')
    }

    // Vérifier un seul conducteur parmi les passagers
    if (passagers) {
      const conducteurs = passagers.filter(p => p.role === 'CONDUCTEUR')
      if (conducteurs.length > 1) {
        return NextResponse.json(
          { error: 'Un seul conducteur est autorisé par véhicule', code: 'VALIDATION_ERROR' },
          { status: 422 }
        )
      }

      // Vérifier la capacité
      if (vehicule.capacitePersonnes && passagers.length > vehicule.capacitePersonnes) {
        return NextResponse.json(
          { error: `Capacité dépassée : ${vehicule.capacitePersonnes} places maximum`, code: 'VALIDATION_ERROR' },
          { status: 422 }
        )
      }
    }

    const assignment = await prisma.vehiculeAssignment.create({
      data: {
        vehiculeId,
        representationId: params.id,
        departLieu,
        departTime,
        arriveeEstimeeTime,
        notes,
        ...(passagers && passagers.length > 0 ? {
          passagers: {
            create: passagers.map(p => ({
              collaborateurId: p.collaborateurId,
              role: p.role,
            })),
          },
        } : {}),
      },
      include: {
        vehicule: { select: { id: true, label: true, type: true, capacitePersonnes: true } },
        passagers: {
          include: {
            collaborateur: {
              include: { user: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
    })

    return NextResponse.json(assignment, { status: 201 })
  } catch (err) {
    void logger.error('POST /api/representations/[id]/transport', err, { route: 'POST /api/representations/[id]/transport' })
    return internalError()
  }
}
