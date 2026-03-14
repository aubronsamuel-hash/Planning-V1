// ─────────────────────────────────────────────────────────
// GET  /api/organisations/[id]/vehicules — Lister la flotte
// POST /api/organisations/[id]/vehicules — Créer un véhicule
// doc/19-module-tournee.md §19.2 — ENTERPRISE uniquement
// Rôle minimum : GET = REGISSEUR, POST = DIRECTEUR
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, forbidden } from '@/lib/api-response'
import { hasFeature } from '@/lib/plans'

const CreateVehiculeSchema = z.object({
  label: z.string().min(1).max(100),
  type: z.enum(['CAMION', 'VAN', 'VOITURE', 'AUTRE']),
  immatriculation: z.string().max(20).optional(),
  capacitePersonnes: z.number().int().positive().optional(),
  capaciteChargement: z.string().max(50).optional(),
  conducteurHabituelId: z.string().cuid().optional(),
})

// ── GET ────────────────────────────────────────────────────
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR' })
    if (error) return error

    const ownershipError = verifyOwnership(params.id, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const org = await prisma.organization.findUnique({
      where: { id: params.id },
      select: { plan: true },
    })
    if (!org || !hasFeature(org.plan, 'moduleTournee')) {
      return forbidden('Le module Tournée est réservé au plan ENTERPRISE. Passez sur /settings/organisation#facturation')
    }

    const { searchParams } = new URL(req.url)
    const actifOnly = searchParams.get('actif') !== 'false' // par défaut true

    const vehicules = await prisma.vehicule.findMany({
      where: {
        organizationId: params.id,
        ...(actifOnly ? { actif: true } : {}),
      },
      include: {
        conducteurHabituel: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
      orderBy: [{ type: 'asc' }, { label: 'asc' }],
    })

    return NextResponse.json(vehicules)
  } catch (err) {
    console.error('[GET /api/organisations/[id]/vehicules]', err)
    return internalError()
  }
}

// ── POST ───────────────────────────────────────────────────
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'DIRECTEUR', write: true })
    if (error) return error

    const ownershipError = verifyOwnership(params.id, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const org = await prisma.organization.findUnique({
      where: { id: params.id },
      select: { plan: true },
    })
    if (!org || !hasFeature(org.plan, 'moduleTournee')) {
      return forbidden('Le module Tournée est réservé au plan ENTERPRISE. Passez sur /settings/organisation#facturation')
    }

    const body = await req.json()
    const parsed = CreateVehiculeSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    // Vérifier que le conducteur habituel appartient bien à l'org
    if (parsed.data.conducteurHabituelId) {
      const membership = await prisma.organizationMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: parsed.data.conducteurHabituelId,
            organizationId: params.id,
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

    const vehicule = await prisma.vehicule.create({
      data: {
        organizationId: params.id,
        label: parsed.data.label,
        type: parsed.data.type,
        immatriculation: parsed.data.immatriculation,
        capacitePersonnes: parsed.data.capacitePersonnes,
        capaciteChargement: parsed.data.capaciteChargement,
        conducteurHabituelId: parsed.data.conducteurHabituelId,
      },
      include: {
        conducteurHabituel: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    })

    return NextResponse.json(vehicule, { status: 201 })
  } catch (err) {
    console.error('[POST /api/organisations/[id]/vehicules]', err)
    return internalError()
  }
}
