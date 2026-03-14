// ─────────────────────────────────────────────────────────
// PATCH /api/affectations/[id]/annuler
// Annule une affectation — simple (> 48h) ou tardive (≤ 48h)
// doc §12.1 — Annulations & Reports
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound, conflict } from '@/lib/api-response'
import { broadcastNotification } from '@/lib/notifications.server'
import { eventBus } from '@/lib/event-bus'

const AnnulerSchema = z.object({
  raison: z.string().max(500).optional(),
})

// Seuil annulation tardive : 48h (Règle #23)
const SEUIL_TARDIVE_MS = 48 * 60 * 60 * 1000

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const affectation = await prisma.affectation.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        collaborateur: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        representation: {
          include: {
            projet: { select: { id: true, organizationId: true, title: true } },
          },
        },
        posteRequis: { select: { name: true } },
      },
    })

    if (!affectation) return notFound('Affectation')

    const ownershipError = verifyOwnership(
      affectation.representation.projet.organizationId,
      session.user.organizationId!
    )
    if (ownershipError) return ownershipError

    if (
      affectation.confirmationStatus === 'ANNULEE' ||
      affectation.confirmationStatus === 'ANNULEE_TARDIVE'
    ) {
      return conflict('Cette affectation est déjà annulée.')
    }

    const body = await req.json()
    const parsed = AnnulerSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    // Déterminer si l'annulation est tardive
    const rep = affectation.representation
    const dateRepresentation = new Date(rep.date)
    if (rep.showStartTime) {
      const [h, m] = rep.showStartTime.split(':').map(Number)
      dateRepresentation.setHours(h, m, 0, 0)
    }
    const maintenant = new Date()
    const delaiMs = dateRepresentation.getTime() - maintenant.getTime()
    const estTardive = delaiMs <= SEUIL_TARDIVE_MS

    const nouveauStatut = estTardive ? 'ANNULEE_TARDIVE' : 'ANNULEE'
    const actionLog = estTardive ? 'AFFECTATION_ANNULEE_TARDIVE' : 'AFFECTATION_ANNULEE'

    const collaborateurUserId = affectation.collaborateur.user.id
    const collaborateurNom = `${affectation.collaborateur.user.firstName} ${affectation.collaborateur.user.lastName}`
    const projetId = affectation.representation.projet.id

    await prisma.$transaction(async (tx) => {
      await tx.affectation.update({
        where: { id: params.id },
        data: {
          confirmationStatus: nouveauStatut,
          annulationRaison: parsed.data.raison ?? null,
          annulationDate: maintenant,
          // Annulation tardive : cachet à décider par le RH
          ...(estTardive ? { cachetAnnulation: 'A_DECIDER' } : {}),
        },
      })

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          action: actionLog,
          entityType: 'Affectation',
          entityId: params.id,
          metadata: {
            raison: parsed.data.raison ?? null,
            estTardive,
            collaborateurNom,
            poste: affectation.posteRequis.name,
            projetTitre: affectation.representation.projet.title,
          },
        },
      })

      // Notifier le collaborateur
      await tx.notification.create({
        data: {
          userId: collaborateurUserId,
          organizationId: session.user.organizationId!,
          type: 'AFFECTATION_ANNULEE',
          priority: 'URGENT',
          title: estTardive ? '⚠️ Affectation annulée (tardive)' : '❌ Affectation annulée',
          body: `Votre affectation sur ${affectation.representation.projet.title} (${affectation.posteRequis.name}) a été annulée.`,
          link: `/mon-planning`,
          relatedId: params.id,
          relatedType: 'affectation',
        },
      })

      // Annulation tardive : déclencher workflow remplacement urgent
      if (estTardive) {
        // Notifier le régisseur
        const regisseurs = await tx.user.findMany({
          where: {
            memberships: {
              some: {
                organizationId: session.user.organizationId!,
                role: 'REGISSEUR',
              },
            },
          },
          select: { id: true },
        })

        for (const reg of regisseurs) {
          await tx.notification.create({
            data: {
              userId: reg.id,
              organizationId: session.user.organizationId!,
              type: 'REMPLACEMENT_URGENT',
              priority: 'CRITIQUE',
              title: '⚡ Remplacement urgent requis',
              body: `${collaborateurNom} annule (< 48h) pour ${affectation.posteRequis.name} — ${affectation.representation.projet.title}.`,
              link: `/projets/${projetId}/remplacements`,
              actionLabel: 'Voir les candidats',
              relatedId: params.id,
              relatedType: 'affectation',
            },
          })
        }
      }
    })

    eventBus.emit(`planning:${projetId}`, {
      type: 'affectation_updated',
      payload: {
        affectationId: params.id,
        confirmationStatus: nouveauStatut,
        representationId: affectation.representationId,
        posteRequisId: affectation.posteRequisId,
      },
    })

    return NextResponse.json({ success: true, statut: nouveauStatut, estTardive })
  } catch (err) {
    console.error('[PATCH /api/affectations/[id]/annuler]', err)
    return internalError()
  }
}
