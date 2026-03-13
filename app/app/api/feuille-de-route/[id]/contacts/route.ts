// ─────────────────────────────────────────────────────────
// POST /api/feuille-de-route/[id]/contacts — Ajouter un contact local
// doc/11 §11.5
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import { notifierModification } from '../route'

const CreateContactSchema = z.object({
  nom:       z.string().min(1).max(100),
  role:      z.string().min(1).max(100),
  type:      z.enum(['VENUE', 'CATERING', 'SECURITE', 'HOTEL', 'URGENCE', 'AUTRE']),
  telephone: z.string().max(30).optional(),
  email:     z.string().email().optional(),
  notes:     z.string().max(500).optional(),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const fdr = await prisma.feuilleDeRoute.findFirst({
      where: { id: params.id },
      include: {
        representation: {
          include: { projet: { select: { organizationId: true, title: true } } },
        },
      },
    })
    if (!fdr) return notFound('Feuille de route')
    if (fdr.representation.projet.organizationId !== session.user.organizationId!) {
      return NextResponse.json({ error: 'Accès refusé', code: 'FORBIDDEN' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = CreateContactSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const contact = await prisma.contactLocal.create({
      data: {
        feuilleDeRouteId: params.id,
        nom:       parsed.data.nom,
        role:      parsed.data.role,
        type:      parsed.data.type,
        telephone: parsed.data.telephone,
        email:     parsed.data.email,
        notes:     parsed.data.notes,
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

    return NextResponse.json(contact, { status: 201 })
  } catch (err) {
    console.error('[POST /api/feuille-de-route/[id]/contacts]', err)
    return internalError()
  }
}
