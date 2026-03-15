// ─────────────────────────────────────────────────────────
// PATCH /api/affectations/[id]/annuler
// Annule une affectation : simple (> 48h) ou tardive (≤ 48h)
// doc/12-annulations-reports.md §12.1
// Accès : REGISSEUR minimum
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import { eventBus } from '@/lib/event-bus'

const AnnulerSchema = z.object({
  raison: z.string().optional(),
})

const SEUIL_TARDIVE_MS = 48 * 60 * 60 * 1000 // 48h en ms

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const affectation = await prisma.affectation.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        collaborateur: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
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
      return NextResponse.json({ error: 'Cette affectation est déjà annulée.' }, { status: 409 })
    }

    const body   = await req.json()
    const parsed = AnnulerSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const raison = parsed.data.raison ?? null

    // Calcul : tardive si ≤ 48h avant le début du spectacle
    const repDate      = new Date(affectation.representation.date)
    const showStart    = affectation.representation.showStartTime
    // Si showStartTime est un string "HH:mm", on l'applique à la date
    if (showStart) {
      const [h, m] = showStart.toString().split(':').map(Number)
      if (!isNaN(h) && !isNaN(m)) {
        repDate.setHours(h, m, 0, 0)
      }
    }
    const msAvant      = repDate.getTime() - Date.now()
    const estTardive   = msAvant <= SEUIL_TARDIVE_MS
    const nouveauStatut = estTardive ? 'ANNULEE_TARDIVE' : 'ANNULEE'

    await prisma.$transaction(async (tx) => {
      await tx.affectation.update({
        where: { id: params.id },
        data: {
          confirmationStatus: nouveauStatut,
          annulationRaison:   raison,
          annulationDate:     new Date(),
          cachetAnnulation:   estTardive ? 'A_DECIDER' : null,
        },
      })

      // Notification au collaborateur
      await tx.notification.create({
        data: {
          userId:         affectation.collaborateur.user.id,
          organizationId: session.user.organizationId!,
          type:           'AFFECTATION_ANNULEE',
          priority:       estTardive ? 'URGENT' : 'INFO',
          title:          'Affectation annulée',
          body:           `Votre affectation ${affectation.posteRequis.name} — ${affectation.representation.projet.title} a été annulée.${raison ? ` Raison : ${raison}` : ''}`,
          link:           '/mon-planning',
        },
      })

      await tx.activityLog.create({
        data: {
          userId:     session.user.id,
          action:     estTardive ? 'AFFECTATION_ANNULEE_TARDIVE' : 'AFFECTATION_ANNULEE',
          entityType: 'Affectation',
          entityId:   params.id,
          metadata: {
            raison,
            estTardive,
            collaborateurNom: `${affectation.collaborateur.user.firstName} ${affectation.collaborateur.user.lastName}`,
            poste:            affectation.posteRequis.name,
            projetTitre:      affectation.representation.projet.title,
          },
        },
      })

      // Si tardive → déclencher remplacement urgent (notif régisseur)
      if (estTardive) {
        const regisseurs = await tx.organizationMembership.findMany({
          where: {
            organizationId: session.user.organizationId!,
            role: { in: ['REGISSEUR', 'DIRECTEUR'] },
          },
          select: { userId: true },
        })
        for (const r of regisseurs) {
          if (r.userId === session.user.id) continue
          await tx.notification.create({
            data: {
              userId:         r.userId,
              organizationId: session.user.organizationId!,
              type:           'REMPLACEMENT_URGENT',
              priority:       'CRITIQUE',
              title:          'Remplacement urgent',
              body:           `${affectation.collaborateur.user.firstName} ${affectation.collaborateur.user.lastName} — ${affectation.posteRequis.name} sur ${affectation.representation.projet.title}.`,
              link:           `/projets/${affectation.representation.projet.id}/remplacements`,
              actionLabel:    'Voir les candidats',
            },
          })
        }
      }
    })

    eventBus.emit(`planning:${affectation.representation.projet.id}`, {
      type:    'affectation_updated',
      payload: {
        affectationId:    params.id,
        confirmationStatus: nouveauStatut,
        representationId: affectation.representationId,
        posteRequisId:    affectation.posteRequisId,
      },
    })

    return NextResponse.json({ success: true, confirmationStatus: nouveauStatut, estTardive })
  } catch (err) {
    console.error('[PATCH /api/affectations/[id]/annuler]', err)
    return internalError()
  }
}
