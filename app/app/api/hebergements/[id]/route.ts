// ─────────────────────────────────────────────────────────
// PATCH  /api/hebergements/[id] — Modifier un hébergement
// DELETE /api/hebergements/[id] — Supprimer (cascade chambres/occupants)
// doc/19-module-tournee.md §19.1
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { internalError, notFound, validationError } from '@/lib/api-response'

const PatchHebergementSchema = z.object({
  nom: z.string().min(1).max(200).optional(),
  adresse: z.string().max(300).optional(),
  ville: z.string().max(100).optional(),
  telephone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(1000).nullable().optional(),
})

async function loadHebergement(id: string, organizationId: string) {
  return prisma.hebergement.findFirst({
    where: { id },
    include: { projet: { select: { organizationId: true } } },
  }).then((h) => {
    if (!h) return null
    if (h.projet.organizationId !== organizationId) return null
    return h
  })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const hebergement = await loadHebergement(params.id, session.user.organizationId!)
    if (!hebergement) return notFound('Hébergement')

    const body = await req.json()
    const parsed = PatchHebergementSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const data = parsed.data
    const updated = await prisma.hebergement.update({
      where: { id: params.id },
      data: {
        ...(data.nom !== undefined && { nom: data.nom }),
        ...(data.adresse !== undefined && { adresse: data.adresse }),
        ...(data.ville !== undefined && { ville: data.ville }),
        ...(data.telephone !== undefined && { telephone: data.telephone }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.checkIn !== undefined && { checkIn: new Date(data.checkIn) }),
        ...(data.checkOut !== undefined && { checkOut: new Date(data.checkOut) }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/hebergements/[id]]', err)
    return internalError()
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const hebergement = await loadHebergement(params.id, session.user.organizationId!)
    if (!hebergement) return notFound('Hébergement')

    // Cascade via Prisma onDelete: Cascade sur Chambre et ChambreOccupant
    await prisma.hebergement.delete({ where: { id: params.id } })

    return new Response(null, { status: 204 })
  } catch (err) {
    console.error('[DELETE /api/hebergements/[id]]', err)
    return internalError()
  }
}
