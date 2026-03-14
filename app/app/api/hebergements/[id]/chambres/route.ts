// ─────────────────────────────────────────────────────────
// POST /api/hebergements/[id]/chambres — Ajouter une chambre
// doc/19-module-tournee.md §19.1
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError, notFound, validationError } from '@/lib/api-response'

const CreateChambreSchema = z.object({
  numero: z.string().max(20).optional(),
  type: z.enum(['INDIVIDUELLE', 'DOUBLE', 'DOUBLE_USAGE_SIMPLE', 'SUITE']),
  notes: z.string().max(500).optional(),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const hebergement = await prisma.hebergement.findFirst({
      where: { id: params.id },
      include: { projet: { select: { organizationId: true } } },
    })
    if (!hebergement) return notFound('Hébergement')
    if (hebergement.projet.organizationId !== session.user.organizationId!) return notFound('Hébergement')

    const body = await req.json()
    const parsed = CreateChambreSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const chambre = await prisma.chambre.create({
      data: {
        hebergementId: params.id,
        numero: parsed.data.numero,
        type: parsed.data.type,
        notes: parsed.data.notes,
      },
    })

    return NextResponse.json(chambre, { status: 201 })
  } catch (err) {
    console.error('[POST /api/hebergements/[id]/chambres]', err)
    return internalError()
  }
}
