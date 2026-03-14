// ─────────────────────────────────────────────────────────
// GET  /api/projets/[id]/hebergements — Lister les hébergements d'un projet
// POST /api/projets/[id]/hebergements — Créer un hébergement
// doc/19-module-tournee.md §19.1 — ENTERPRISE uniquement
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound, forbidden } from '@/lib/api-response'
import { hasFeature } from '@/lib/plans'

const CreateHebergementSchema = z.object({
  nom: z.string().min(1).max(200),
  adresse: z.string().max(500).optional(),
  ville: z.string().max(100).optional(),
  telephone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  notes: z.string().max(2000).optional(),
})

// ── GET ────────────────────────────────────────────────────
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR' })
    if (error) return error

    const projet = await prisma.projet.findFirst({ where: { id: params.id } })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    // Vérifier plan ENTERPRISE
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId! },
      select: { plan: true },
    })
    if (!org || !hasFeature(org.plan, 'moduleTournee')) {
      return forbidden('Le module Tournée est réservé au plan ENTERPRISE. Passez sur /settings/organisation#facturation')
    }

    const hebergements = await prisma.hebergement.findMany({
      where: { projetId: params.id },
      include: {
        chambres: {
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
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { checkIn: 'asc' },
    })

    return NextResponse.json(hebergements)
  } catch (err) {
    console.error('[GET /api/projets/[id]/hebergements]', err)
    return internalError()
  }
}

// ── POST ───────────────────────────────────────────────────
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const projet = await prisma.projet.findFirst({ where: { id: params.id } })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    // Vérifier plan ENTERPRISE
    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId! },
      select: { plan: true },
    })
    if (!org || !hasFeature(org.plan, 'moduleTournee')) {
      return forbidden('Le module Tournée est réservé au plan ENTERPRISE. Passez sur /settings/organisation#facturation')
    }

    const body = await req.json()
    const parsed = CreateHebergementSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { nom, adresse, ville, telephone, email, checkIn, checkOut, notes } = parsed.data

    const hebergement = await prisma.hebergement.create({
      data: {
        projetId: params.id,
        nom,
        adresse,
        ville,
        telephone,
        email,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        notes,
        createdById: session.user.id,
      },
    })

    return NextResponse.json(hebergement, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projets/[id]/hebergements]', err)
    return internalError()
  }
}
