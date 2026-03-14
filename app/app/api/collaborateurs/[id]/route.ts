// ─────────────────────────────────────────────────────────
// GET  /api/collaborateurs/[id] — Fiche détaillée (collaborateurId)
// PATCH /api/collaborateurs/[id] — Modifier données RH
// doc/07 §7.2
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { internalError, notFound, validationError } from '@/lib/api-response'
import logger from '@/lib/logger'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const organizationId = session.user.organizationId!

    const collab = await prisma.collaborateur.findFirst({
      where: {
        id: params.id,
        // Collaborateur n'a pas organizationId — on vérifie via la membership
        user: { memberships: { some: { organizationId } } },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            phone: true,
          },
        },
        affectations: {
          where: { deletedAt: null },
          include: {
            representation: {
              include: {
                projet: { select: { id: true, title: true, colorCode: true, status: true } },
              },
            },
            posteRequis: { select: { name: true, isCritique: true } },
          },
          orderBy: [{ representation: { date: 'asc' } }],
        },
      },
    })
    if (!collab) return notFound('Collaborateur')

    // Grouper affectations par projet pour l'historique
    const parProjet = new Map<string, {
      projet: { id: string; title: string; colorCode: string; status: string }
      poste: string
      nbAffectations: number
      remuneration: number
    }>()

    for (const a of collab.affectations) {
      const projetId = a.representation.projet.id
      const existing = parProjet.get(projetId)
      if (existing) {
        existing.nbAffectations++
        existing.remuneration += a.remuneration ?? 0
      } else {
        parProjet.set(projetId, {
          projet: a.representation.projet,
          poste: a.posteRequis.name,
          nbAffectations: 1,
          remuneration: a.remuneration ?? 0,
        })
      }
    }

    const historique = Array.from(parProjet.values()).sort((a, b) =>
      a.projet.status === 'EN_COURS' ? -1 : 1
    )

    // Données RH masquées pour non-RH (seuls RH et DIRECTEUR peuvent voir N°SS, IBAN)
    const orgRole = session.user.organizationRole
    const canSeeRH = orgRole === 'RH' || orgRole === 'DIRECTEUR'

    return NextResponse.json({
      id: collab.id,
      userId: collab.userId,
      user: collab.user,
      accountStatus: collab.accountStatus,
      contractType: collab.contractType,
      specialites: collab.specialites,
      yearsExperience: collab.yearsExperience,
      availableForTour: collab.availableForTour,
      cachetHabituel: collab.cachetHabituel,
      // Données sensibles RH uniquement
      ...(canSeeRH ? {
        congesSpectaclesNumber: collab.congesSpectaclesNumber,
        socialSecurityNumber: collab.socialSecurityNumber ? '•••••••••••••••' : null,
        iban: collab.iban ? `FR76 •••• •••• ${collab.iban.slice(-4)}` : null,
      } : {}),
      historique,
    })
  } catch (err) {
    void logger.error('GET /api/collaborateurs/[id]', err, { route: 'GET /api/collaborateurs/[id]' })
    return internalError()
  }
}

const PatchCollabSchema = z.object({
  contractType:             z.enum(['CDI', 'CDD', 'INTERMITTENT']).optional(),
  cachetHabituel:           z.number().int().min(0).optional(),
  congesSpectaclesNumber:   z.string().max(20).optional(),
  socialSecurityNumber:     z.string().max(15).optional(),
  iban:                     z.string().max(34).optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'RH', write: true })
    if (error) return error

    const organizationId = session.user.organizationId!

    const collab = await prisma.collaborateur.findFirst({
      where: {
        id: params.id,
        user: { memberships: { some: { organizationId } } },
      },
    })
    if (!collab) return notFound('Collaborateur')

    const body = await req.json()
    const parsed = PatchCollabSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const updated = await prisma.collaborateur.update({
      where: { id: params.id },
      data: parsed.data,
    })

    return NextResponse.json(updated)
  } catch (err) {
    void logger.error('PATCH /api/collaborateurs/[id]', err, { route: 'PATCH /api/collaborateurs/[id]' })
    return internalError()
  }
}
