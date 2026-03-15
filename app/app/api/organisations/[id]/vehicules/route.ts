// ─────────────────────────────────────────────────────────
// GET  /api/organisations/[id]/vehicules — Liste de la flotte
// POST /api/organisations/[id]/vehicules — Créer un véhicule (DIRECTEUR)
// doc/19-module-tournee.md §19.2 — plan ENTERPRISE requis
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { forbidden, internalError, validationError } from '@/lib/api-response'
import { hasFeature } from '@/lib/plans'

const CreateVehiculeSchema = z.object({
  label: z.string().min(1).max(100),
  type: z.enum(['CAMION', 'VAN', 'VOITURE', 'AUTRE']),
  immatriculation: z.string().max(20).optional(),
  capacitePersonnes: z.number().int().min(1).optional(),
  capaciteChargement: z.string().max(20).optional(),
  conducteurHabituelId: z.string().optional(), // collaborateurId
})

// ── GET ────────────────────────────────────────────────────
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    // Anti-IDOR : l'org demandée doit être l'org active de l'utilisateur
    if (params.id !== session.user.organizationId) {
      return forbidden('Accès refusé')
    }

    const org = await prisma.organization.findUnique({
      where: { id: params.id },
      select: { plan: true },
    })
    if (!org || !hasFeature(org.plan, 'moduleTournee')) {
      return forbidden('Module Tournée disponible sur le plan ENTERPRISE uniquement — /settings/organisation#facturation')
    }

    const vehicules = await prisma.vehicule.findMany({
      where: { organizationId: params.id, actif: true },
      include: {
        conducteurHabituel: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { label: 'asc' },
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

    if (params.id !== session.user.organizationId) {
      return forbidden('Accès refusé')
    }

    const org = await prisma.organization.findUnique({
      where: { id: params.id },
      select: { plan: true },
    })
    if (!org || !hasFeature(org.plan, 'moduleTournee')) {
      return forbidden('Module Tournée disponible sur le plan ENTERPRISE uniquement — /settings/organisation#facturation')
    }

    const body = await req.json()
    const parsed = CreateVehiculeSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const vehicule = await prisma.vehicule.create({
      data: {
        organizationId: params.id,
        label: parsed.data.label,
        type: parsed.data.type,
        immatriculation: parsed.data.immatriculation,
        capacitePersonnes: parsed.data.capacitePersonnes,
        capaciteChargement: parsed.data.capaciteChargement,
        conducteurHabituelId: parsed.data.conducteurHabituelId ?? null,
      },
      include: {
        conducteurHabituel: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    })

    return NextResponse.json(vehicule, { status: 201 })
  } catch (err) {
    console.error('[POST /api/organisations/[id]/vehicules]', err)
    return internalError()
  }
}
