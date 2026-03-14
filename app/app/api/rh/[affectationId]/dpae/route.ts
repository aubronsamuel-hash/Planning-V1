// ─────────────────────────────────────────────────────────
// PATCH /api/rh/[affectationId]/dpae — Mettre à jour le statut DPAE
// doc/06 Règle #3 — DPAE obligatoire CDD/INTERMITTENT
// Auth : minRole RH, write: true
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import { createInAppNotification } from '@/lib/notifications.server'
import logger from '@/lib/logger'

const PatchDpaeSchema = z.object({
  dpaeStatus: z.enum(['ENVOYEE', 'CONFIRMEE']),
})

export async function PATCH(
  req: Request,
  { params }: { params: { affectationId: string } }
) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'RH', write: true })
    if (error) return error

    const organizationId = session.user.organizationId!

    // Valider le body
    const body = await req.json()
    const parsed = PatchDpaeSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { dpaeStatus } = parsed.data

    // Récupérer l'affectation avec le projet pour vérifier l'ownership
    const affectation = await prisma.affectation.findFirst({
      where: { id: params.affectationId },
      include: {
        representation: {
          include: {
            projet: {
              select: { id: true, organizationId: true, title: true },
            },
          },
        },
        collaborateur: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        posteRequis: { select: { name: true } },
      },
    })

    if (!affectation) return notFound('Affectation')

    // Guard anti-IDOR — vérifier que l'affectation appartient à l'org de la session
    const ownershipError = verifyOwnership(
      affectation.representation.projet.organizationId,
      organizationId
    )
    if (ownershipError) return ownershipError

    // Vérifier que la DPAE est bien requise (contractType éligible)
    if (!['CDD', 'INTERMITTENT'].includes(affectation.contractTypeUsed)) {
      return validationError({
        dpaeStatus: 'La DPAE n\'est pas requise pour ce type de contrat (CDI)',
      })
    }

    // Vérifier que la transition est valide (A_FAIRE → ENVOYEE → CONFIRMEE)
    const currentStatus = affectation.dpaeStatus
    if (currentStatus === 'NON_REQUISE') {
      return validationError({ dpaeStatus: 'Cette affectation n\'a pas de DPAE à gérer' })
    }
    if (currentStatus === 'CONFIRMEE') {
      return validationError({ dpaeStatus: 'La DPAE est déjà confirmée' })
    }
    if (dpaeStatus === 'CONFIRMEE' && currentStatus === 'A_FAIRE') {
      return validationError({ dpaeStatus: 'La DPAE doit d\'abord être marquée ENVOYEE avant d\'être confirmée' })
    }

    // Mettre à jour le statut DPAE
    const updated = await prisma.affectation.update({
      where: { id: params.affectationId },
      data: {
        dpaeStatus,
        // Enregistrer la date d'envoi si passage à ENVOYEE
        ...(dpaeStatus === 'ENVOYEE' ? { dpaeDate: new Date() } : {}),
      },
    })

    // Notification in-app si CONFIRMEE — notifier le RH qui a effectué l'action
    // et les directeurs de l'organisation
    if (dpaeStatus === 'CONFIRMEE') {
      const collaborateurNom = `${affectation.collaborateur.user.firstName} ${affectation.collaborateur.user.lastName}`
      const projetTitre = affectation.representation.projet.title
      const dateRep = affectation.representation.date.toLocaleDateString('fr-FR')

      await createInAppNotification({
        userId: session.user.id,
        organizationId,
        type: 'DPAE_A_FAIRE',
        body: `DPAE confirmée — ${collaborateurNom} · ${affectation.posteRequis.name} · ${projetTitre} le ${dateRep}`,
        link: '/rh',
      })
    }

    // ─── ActivityLog ──────────────────────────────────────────
    // ⚠️ DPAE_STATUS_UPDATED n'existe pas dans l'enum ActivityLogAction (schema v1.0)
    // TODO: ajouter DPAE_STATUS_UPDATED à l'enum ActivityLogAction lors de la prochaine migration
    // await prisma.activityLog.create({ data: { action: 'DPAE_STATUS_UPDATED', ... } })

    return NextResponse.json(updated)
  } catch (err) {
    void logger.error('PATCH /api/rh/[affectationId]/dpae', err, { route: 'PATCH /api/rh/[affectationId]/dpae' })
    return internalError()
  }
}
