// ─────────────────────────────────────────────────────────
// PATCH /api/vehicule-assignments/[id] — Modifier une assignation véhicule
// doc/19-module-tournee.md §19.2 — ENTERPRISE uniquement
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound, forbidden } from '@/lib/api-response'
import { hasFeature } from '@/lib/plans'
import logger from '@/lib/logger'

const PatchVehiculeAssignmentSchema = z.object({
  departLieu: z.string().max(300).nullable().optional(),
  departTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  arriveeEstimeeTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  // Remplacement complet des passagers si fourni
  passagers: z.array(z.object({
    collaborateurId: z.string().cuid(),
    role: z.enum(['CONDUCTEUR', 'PASSAGER']),
  })).optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const assignment = await prisma.vehiculeAssignment.findUnique({
      where: { id: params.id },
      include: {
        vehicule: { select: { organizationId: true, capacitePersonnes: true } },
      },
    })
    if (!assignment) return notFound('Assignation véhicule')

    const ownershipError = verifyOwnership(assignment.vehicule.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId! },
      select: { plan: true },
    })
    if (!org || !hasFeature(org.plan, 'moduleTournee')) {
      return forbidden('Le module Tournée est réservé au plan ENTERPRISE. Passez sur /settings/organisation#facturation')
    }

    const body = await req.json()
    const parsed = PatchVehiculeAssignmentSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { passagers, ...assignmentFields } = parsed.data

    // Vérifier un seul conducteur
    if (passagers) {
      const conducteurs = passagers.filter(p => p.role === 'CONDUCTEUR')
      if (conducteurs.length > 1) {
        return NextResponse.json(
          { error: 'Un seul conducteur est autorisé par véhicule', code: 'VALIDATION_ERROR' },
          { status: 422 }
        )
      }
      if (assignment.vehicule.capacitePersonnes && passagers.length > assignment.vehicule.capacitePersonnes) {
        return NextResponse.json(
          { error: `Capacité dépassée : ${assignment.vehicule.capacitePersonnes} places maximum`, code: 'VALIDATION_ERROR' },
          { status: 422 }
        )
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.vehiculeAssignment.update({
        where: { id: params.id },
        data: {
          ...(assignmentFields.departLieu !== undefined && { departLieu: assignmentFields.departLieu }),
          ...(assignmentFields.departTime !== undefined && { departTime: assignmentFields.departTime }),
          ...(assignmentFields.arriveeEstimeeTime !== undefined && { arriveeEstimeeTime: assignmentFields.arriveeEstimeeTime }),
          ...(assignmentFields.notes !== undefined && { notes: assignmentFields.notes }),
        },
      })

      if (passagers !== undefined) {
        await tx.vehiculePassager.deleteMany({ where: { vehiculeAssignmentId: params.id } })
        if (passagers.length > 0) {
          await tx.vehiculePassager.createMany({
            data: passagers.map(p => ({
              vehiculeAssignmentId: params.id,
              collaborateurId: p.collaborateurId,
              role: p.role,
            })),
          })
        }
      }

      return tx.vehiculeAssignment.findUnique({
        where: { id: params.id },
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
    })

    return NextResponse.json(updated)
  } catch (err) {
    void logger.error('PATCH /api/vehicule-assignments/[id]', err, { route: 'PATCH /api/vehicule-assignments/[id]' })
    return internalError()
  }
}
