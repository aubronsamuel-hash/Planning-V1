// ─────────────────────────────────────────────────────────
// PATCH /api/collaborateurs/[id]/preferences-tournee
// Modifier les préférences tournée d'un collaborateur
// doc/19-module-tournee.md §19.3 — ENTERPRISE uniquement
// Rôle minimum : RH (données sensibles — régime, allergies)
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, canVoirRH } from '@/lib/auth'
import { validationError, internalError, notFound, forbidden } from '@/lib/api-response'
import { hasFeature } from '@/lib/plans'
import logger from '@/lib/logger'

const PatchPreferencesTourneeSchema = z.object({
  preferenceChambre: z.enum(['SANS_PREFERENCE', 'INDIVIDUELLE', 'PARTAGEE_ACCEPTEE']).optional(),
  regimeAlimentaire: z.enum(['STANDARD', 'VEGETARIEN', 'VEGAN', 'SANS_PORC', 'HALAL', 'KASHER', 'AUTRE']).optional(),
  allergies: z.string().max(500).nullable().optional(),
  permisConduire: z.boolean().optional(),
  permisCategorie: z.string().max(20).nullable().optional(),
  notesTournee: z.string().max(1000).nullable().optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ write: true })
    if (error) return error

    // Seuls RH et Directeur peuvent voir/modifier les données sensibles (régime, allergies)
    if (!canVoirRH(session)) {
      return forbidden('Modification des préférences tournée réservée aux rôles RH et Directeur')
    }

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId! },
      select: { plan: true },
    })
    if (!org || !hasFeature(org.plan, 'moduleTournee')) {
      return forbidden('Le module Tournée est réservé au plan ENTERPRISE. Passez sur /settings/organisation#facturation')
    }

    // Vérifier que le collaborateur appartient à l'organisation de la session
    const collaborateur = await prisma.collaborateur.findUnique({
      where: { id: params.id },
      include: {
        user: {
          include: {
            memberships: {
              where: { organizationId: session.user.organizationId! },
              select: { id: true },
            },
          },
        },
      },
    })

    if (!collaborateur) return notFound('Collaborateur')
    if (collaborateur.user.memberships.length === 0) {
      return forbidden('Ce collaborateur n\'appartient pas à votre organisation')
    }

    const body = await req.json()
    const parsed = PatchPreferencesTourneeSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const updated = await prisma.collaborateur.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.preferenceChambre !== undefined && { preferenceChambre: parsed.data.preferenceChambre }),
        ...(parsed.data.regimeAlimentaire !== undefined && { regimeAlimentaire: parsed.data.regimeAlimentaire }),
        ...(parsed.data.allergies !== undefined && { allergies: parsed.data.allergies }),
        ...(parsed.data.permisConduire !== undefined && { permisConduire: parsed.data.permisConduire }),
        ...(parsed.data.permisCategorie !== undefined && { permisCategorie: parsed.data.permisCategorie }),
        ...(parsed.data.notesTournee !== undefined && { notesTournee: parsed.data.notesTournee }),
      },
      select: {
        id: true,
        preferenceChambre: true,
        regimeAlimentaire: true,
        allergies: true,
        permisConduire: true,
        permisCategorie: true,
        notesTournee: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    void logger.error('PATCH /api/collaborateurs/[id]/preferences-tournee', err, { route: 'PATCH /api/collaborateurs/[id]/preferences-tournee' })
    return internalError()
  }
}
