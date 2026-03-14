// ─────────────────────────────────────────────────────────
// PATCH  /api/hebergements/[id] — Modifier un hébergement
// DELETE /api/hebergements/[id] — Supprimer un hébergement
// doc/19-module-tournee.md §19.1 — ENTERPRISE uniquement
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound, forbidden } from '@/lib/api-response'
import { hasFeature } from '@/lib/plans'
import logger from '@/lib/logger'

const PatchHebergementSchema = z.object({
  nom: z.string().min(1).max(200).optional(),
  adresse: z.string().max(500).nullable().optional(),
  ville: z.string().max(100).nullable().optional(),
  telephone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(),
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

async function getHebergementWithOrg(id: string) {
  const hebergement = await prisma.hebergement.findUnique({
    where: { id },
    include: {
      projet: { select: { organizationId: true } },
    },
  })
  return hebergement
}

// ── PATCH ──────────────────────────────────────────────────
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const hebergement = await getHebergementWithOrg(params.id)
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
    const parsed = PatchHebergementSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const updated = await prisma.hebergement.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.nom !== undefined && { nom: parsed.data.nom }),
        ...(parsed.data.adresse !== undefined && { adresse: parsed.data.adresse }),
        ...(parsed.data.ville !== undefined && { ville: parsed.data.ville }),
        ...(parsed.data.telephone !== undefined && { telephone: parsed.data.telephone }),
        ...(parsed.data.email !== undefined && { email: parsed.data.email }),
        ...(parsed.data.checkIn !== undefined && { checkIn: new Date(parsed.data.checkIn) }),
        ...(parsed.data.checkOut !== undefined && { checkOut: new Date(parsed.data.checkOut) }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    void logger.error('PATCH /api/hebergements/[id]', err, { route: 'PATCH /api/hebergements/[id]' })
    return internalError()
  }
}

// ── DELETE ─────────────────────────────────────────────────
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const hebergement = await getHebergementWithOrg(params.id)
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

    // Suppression réelle (Hebergement n'a pas de soft delete — données purement logistiques)
    await prisma.hebergement.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    void logger.error('DELETE /api/hebergements/[id]', err, { route: 'DELETE /api/hebergements/[id]' })
    return internalError()
  }
}
