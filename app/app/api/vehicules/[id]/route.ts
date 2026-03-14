// ─────────────────────────────────────────────────────────
// PATCH /api/vehicules/[id] — Modifier un véhicule (DIRECTEUR)
//   Archiver : passer actif: false (pas de DELETE réel)
// doc/19-module-tournee.md §19.2
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError, notFound, validationError } from '@/lib/api-response'

const PatchVehiculeSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  type: z.enum(['CAMION', 'VAN', 'VOITURE', 'AUTRE']).optional(),
  immatriculation: z.string().max(20).nullable().optional(),
  capacitePersonnes: z.number().int().min(1).nullable().optional(),
  capaciteChargement: z.string().max(20).nullable().optional(),
  conducteurHabituelId: z.string().nullable().optional(),
  actif: z.boolean().optional(), // false = archiver le véhicule
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'DIRECTEUR', write: true })
    if (error) return error

    const vehicule = await prisma.vehicule.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId! },
    })
    if (!vehicule) return notFound('Véhicule')

    const body = await req.json()
    const parsed = PatchVehiculeSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const updated = await prisma.vehicule.update({
      where: { id: params.id },
      data: parsed.data,
      include: {
        conducteurHabituel: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/vehicules/[id]]', err)
    return internalError()
  }
}
