// ─────────────────────────────────────────────────────────
// PATCH  /api/feuille-de-route/[id]/contacts/[contactId]
// DELETE /api/feuille-de-route/[id]/contacts/[contactId]
// doc/11 §11.5
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import { notifierModification } from '../../route'

const PatchContactSchema = z.object({
  nom:       z.string().min(1).max(100).optional(),
  role:      z.string().min(1).max(100).optional(),
  type:      z.enum(['VENUE', 'CATERING', 'SECURITE', 'HOTEL', 'URGENCE', 'AUTRE']).optional(),
  telephone: z.string().max(30).nullable().optional(),
  email:     z.string().email().nullable().optional(),
  notes:     z.string().max(500).nullable().optional(),
})

async function resolveContact(contactId: string, fdrId: string, orgId: string) {
  const contact = await prisma.contactLocal.findFirst({
    where: { id: contactId, feuilleDeRouteId: fdrId },
  })
  if (!contact) return { contact: null, fdr: null, ownerError: null }

  const fdr = await prisma.feuilleDeRoute.findFirst({
    where: { id: fdrId },
    include: {
      representation: {
        include: { projet: { select: { organizationId: true, title: true } } },
      },
    },
  })
  if (!fdr) return { contact: null, fdr: null, ownerError: null }

  if (fdr.representation.projet.organizationId !== orgId) {
    return {
      contact: null,
      fdr: null,
      ownerError: NextResponse.json({ error: 'Accès refusé', code: 'FORBIDDEN' }, { status: 403 }),
    }
  }

  return { contact, fdr, ownerError: null }
}

// ── PATCH ──────────────────────────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; contactId: string } }
) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const { contact, fdr, ownerError } = await resolveContact(
      params.contactId,
      params.id,
      session.user.organizationId!
    )
    if (ownerError) return ownerError
    if (!contact || !fdr) return notFound('Contact')

    const body = await req.json()
    const parsed = PatchContactSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const updated = await prisma.contactLocal.update({
      where: { id: params.contactId },
      data: {
        ...(parsed.data.nom       !== undefined && { nom:       parsed.data.nom       }),
        ...(parsed.data.role      !== undefined && { role:      parsed.data.role      }),
        ...(parsed.data.type      !== undefined && { type:      parsed.data.type      }),
        ...(parsed.data.telephone !== undefined && { telephone: parsed.data.telephone }),
        ...(parsed.data.email     !== undefined && { email:     parsed.data.email     }),
        ...(parsed.data.notes     !== undefined && { notes:     parsed.data.notes     }),
      },
    })

    if (fdr.statut === 'PUBLIEE') {
      await notifierModification(params.id, fdr.representation, session.user.organizationId!)
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'FEUILLE_DE_ROUTE_MODIFIEE',
          entityType: 'FeuilleDeRoute',
          entityId: params.id,
        },
      })
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/feuille-de-route/[id]/contacts/[contactId]]', err)
    return internalError()
  }
}

// ── DELETE ─────────────────────────────────────────────────
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; contactId: string } }
) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const { contact, fdr, ownerError } = await resolveContact(
      params.contactId,
      params.id,
      session.user.organizationId!
    )
    if (ownerError) return ownerError
    if (!contact || !fdr) return notFound('Contact')

    await prisma.contactLocal.delete({ where: { id: params.contactId } })

    if (fdr.statut === 'PUBLIEE') {
      await notifierModification(params.id, fdr.representation, session.user.organizationId!)
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'FEUILLE_DE_ROUTE_MODIFIEE',
          entityType: 'FeuilleDeRoute',
          entityId: params.id,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/feuille-de-route/[id]/contacts/[contactId]]', err)
    return internalError()
  }
}
