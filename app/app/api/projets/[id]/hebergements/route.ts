// ─────────────────────────────────────────────────────────
// GET  /api/projets/[id]/hebergements — Liste des hébergements
// POST /api/projets/[id]/hebergements — Créer un hébergement
// doc/19-module-tournee.md §19.1 — plan ENTERPRISE requis
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { forbidden, internalError, notFound, validationError } from '@/lib/api-response'
import { hasFeature } from '@/lib/plans'

const CreateHebergementSchema = z.object({
  nom: z.string().min(1).max(200),
  adresse: z.string().max(300).optional(),
  ville: z.string().max(100).optional(),
  telephone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  notes: z.string().max(1000).optional(),
})

// ── GET ────────────────────────────────────────────────────
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const projet = await prisma.projet.findFirst({
      where: { id: params.id },
      include: { organization: { select: { plan: true } } },
    })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    if (!hasFeature(projet.organization.plan, 'moduleTournee')) {
      return forbidden('Module Tournée disponible sur le plan ENTERPRISE uniquement — /settings/organisation#facturation')
    }

    const hebergements = await prisma.hebergement.findMany({
      where: { projetId: params.id },
      include: {
        chambres: {
          include: {
            occupants: {
              include: {
                collaborateur: {
                  include: { user: { select: { id: true, firstName: true, lastName: true } } },
                },
              },
              orderBy: { nuitDu: 'asc' },
            },
          },
          orderBy: { numero: 'asc' },
        },
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

    const projet = await prisma.projet.findFirst({
      where: { id: params.id },
      include: { organization: { select: { plan: true } } },
    })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    if (!hasFeature(projet.organization.plan, 'moduleTournee')) {
      return forbidden('Module Tournée disponible sur le plan ENTERPRISE uniquement — /settings/organisation#facturation')
    }

    const body = await req.json()
    const parsed = CreateHebergementSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { nom, adresse, ville, telephone, email, checkIn, checkOut, notes } = parsed.data

    if (new Date(checkOut) <= new Date(checkIn)) {
      return validationError({ checkOut: ['La date de départ doit être après la date d\'arrivée'] })
    }

    const hebergement = await prisma.hebergement.create({
      data: {
        projetId: params.id,
        nom,
        adresse,
        ville,
        telephone,
        email: email || undefined,
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
