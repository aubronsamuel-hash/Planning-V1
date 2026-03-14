// ─────────────────────────────────────────────────────────
// PATCH /api/collaborateurs/[id]/preferences-tournee
// Modifier les préférences tournée d'un collaborateur (RH uniquement)
// doc/19-module-tournee.md §19.3 — données sensibles
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError, notFound, validationError } from '@/lib/api-response'

const PatchPreferencesSchema = z.object({
  preferenceChambre: z.enum(['SANS_PREFERENCE', 'INDIVIDUELLE', 'PARTAGEE_ACCEPTEE']).optional(),
  regimeAlimentaire: z.enum(['STANDARD', 'VEGETARIEN', 'VEGAN', 'SANS_PORC', 'HALAL', 'KASHER', 'AUTRE']).optional(),
  allergies: z.string().max(500).nullable().optional(),
  permisConduire: z.boolean().optional(),
  permisCategorie: z.string().max(10).nullable().optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    // Données sensibles — RH minimum requis
    const { session, error } = await requireOrgSession({ minRole: 'RH', write: true })
    if (error) return error

    const organizationId = session.user.organizationId!

    // Anti-IDOR : vérifier que le collaborateur appartient à l'org
    const collab = await prisma.collaborateur.findFirst({
      where: {
        id: params.id,
        user: { memberships: { some: { organizationId } } },
      },
    })
    if (!collab) return notFound('Collaborateur')

    const body = await req.json()
    const parsed = PatchPreferencesSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const updated = await prisma.collaborateur.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.preferenceChambre !== undefined && { preferenceChambre: parsed.data.preferenceChambre }),
        ...(parsed.data.regimeAlimentaire !== undefined && { regimeAlimentaire: parsed.data.regimeAlimentaire }),
        ...(parsed.data.allergies !== undefined && { allergies: parsed.data.allergies }),
        ...(parsed.data.permisConduire !== undefined && { permisConduire: parsed.data.permisConduire }),
        ...(parsed.data.permisCategorie !== undefined && { permisCategorie: parsed.data.permisCategorie }),
      },
      select: {
        id: true,
        preferenceChambre: true,
        regimeAlimentaire: true,
        allergies: true,
        permisConduire: true,
        permisCategorie: true,
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/collaborateurs/[id]/preferences-tournee]', err)
    return internalError()
  }
}
