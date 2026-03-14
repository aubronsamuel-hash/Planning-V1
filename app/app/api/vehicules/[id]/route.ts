// ─────────────────────────────────────────────────────────
// PATCH /api/vehicules/[id] — Modifier un véhicule (DIRECTEUR)
// doc/19-module-tournee.md §19.2 — ENTERPRISE uniquement
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound, forbidden } from '@/lib/api-response'
import { hasFeature } from '@/lib/plans'
import logger from '@/lib/logger'

const PatchVehiculeSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  type: z.enum(['CAMION', 'VAN', 'VOITURE', 'AUTRE']).optional(),
  immatriculation: z.string().max(20).nullable().optional(),
  capacitePersonnes: z.number().int().positive().nullable().optional(),
  capaciteChargement: z.string().max(50).nullable().optional(),
  conducteurHabituelId: z.string().cuid().nullable().optional(),
  actif: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'DIRECTEUR', write: true })
    if (error) return error

    const vehicule = await prisma.vehicule.findUnique({ where: { id: params.id } })
    if (!vehicule) return notFound('Véhicule')

    const ownershipError = verifyOwnership(vehicule.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId! },
      select: { plan: true },
    })
    if (!org || !hasFeature(org.plan, 'moduleTournee')) {
      return forbidden('Le module Tournée est réservé au plan ENTERPRISE. Passez sur /settings/organisation#facturation')
    }

    const body = await req.json()
    const parsed = PatchVehiculeSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    // Vérifier le conducteur si fourni
    if (parsed.data.conducteurHabituelId) {
      const membership = await prisma.organizationMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: parsed.data.conducteurHabituelId,
            organizationId: vehicule.organizationId,
          },
        },
      })
      if (!membership) {
        return NextResponse.json(
          { error: 'Le conducteur habituel n\'est pas membre de cette organisation', code: 'VALIDATION_ERROR' },
          { status: 422 }
        )
      }
    }

    const updated = await prisma.vehicule.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.label !== undefined && { label: parsed.data.label }),
        ...(parsed.data.type !== undefined && { type: parsed.data.type }),
        ...(parsed.data.immatriculation !== undefined && { immatriculation: parsed.data.immatriculation }),
        ...(parsed.data.capacitePersonnes !== undefined && { capacitePersonnes: parsed.data.capacitePersonnes }),
        ...(parsed.data.capaciteChargement !== undefined && { capaciteChargement: parsed.data.capaciteChargement }),
        ...(parsed.data.conducteurHabituelId !== undefined && { conducteurHabituelId: parsed.data.conducteurHabituelId }),
        ...(parsed.data.actif !== undefined && { actif: parsed.data.actif }),
      },
      include: {
        conducteurHabituel: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    void logger.error('PATCH /api/vehicules/[id]', err, { route: 'PATCH /api/vehicules/[id]' })
    return internalError()
  }
}
