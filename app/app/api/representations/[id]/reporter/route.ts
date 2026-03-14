// ─────────────────────────────────────────────────────────
// PATCH /api/representations/[id]/reporter
// Reporte une représentation à une nouvelle date
// doc/12-annulations-reports.md §12.4
// Accès : REGISSEUR minimum
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import { eventBus } from '@/lib/event-bus'

const ReporterSchema = z.object({
  nouvelleDate:    z.string().min(1), // ISO date string
  maintienAffectations: z.boolean(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const representation = await prisma.representation.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        projet: { select: { id: true, organizationId: true, title: true } },
        affectations: {
          where: { deletedAt: null },
          include: {
            collaborateur: {
              include: { user: { select: { id: true, firstName: true, lastName: true } } },
            },
            posteRequis: { select: { name: true } },
          },
        },
      },
    })

    if (!representation) return notFound('Représentation')

    const ownershipError = verifyOwnership(
      representation.projet.organizationId,
      session.user.organizationId!
    )
    if (ownershipError) return ownershipError

    if (representation.status === 'ANNULEE') {
      return NextResponse.json({ error: 'Une représentation annulée ne peut pas être reportée.' }, { status: 400 })
    }

    const body   = await req.json()
    const parsed = ReporterSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { nouvelleDate, maintienAffectations } = parsed.data

    let nouvelleRepId = ''

    await prisma.$transaction(async (tx) => {
      // Créer la nouvelle représentation
      const nouvelleRep = await tx.representation.create({
        data: {
          projetId:       representation.projetId,
          date:           new Date(nouvelleDate),
          showStartTime:  representation.showStartTime,
          showEndTime:    representation.showEndTime,
          getInTime:      representation.getInTime,
          getOutTime:     representation.getOutTime,
          type:           representation.type,
          status:         'PLANIFIEE',
        },
      })
      nouvelleRepId = nouvelleRep.id

      // Marquer l'ancienne comme REPORTEE
      await tx.representation.update({
        where: { id: params.id },
        data: {
          status:           'REPORTEE',
          reporteeVersId:   nouvelleRep.id,
          annulationAt:     new Date(),
        },
      })

      if (maintienAffectations) {
        // Maintenir les affectations : recréer sur la nouvelle date, reset confirmation pour intermittents
        for (const aff of representation.affectations) {
          const nouvelleConfirmation =
            aff.confirmationStatus === 'NON_REQUISE' ? 'NON_REQUISE' : 'EN_ATTENTE'

          await tx.affectation.create({
            data: {
              representationId:   nouvelleRep.id,
              collaborateurId:    aff.collaborateurId,
              posteRequisId:      aff.posteRequisId,
              confirmationStatus: nouvelleConfirmation,
              contractTypeUsed:   aff.contractTypeUsed,
              remuneration:       aff.remuneration,
              startTime:          aff.startTime,
              endTime:            aff.endTime,
              dpaeStatus:         'A_FAIRE',
            },
          })

          // Notifier le collaborateur
          const msgBase = `${representation.projet.title} est reportée au ${new Date(nouvelleDate).toLocaleDateString('fr-FR')}.`
          const msg = nouvelleConfirmation === 'NON_REQUISE'
            ? `${msgBase} Votre présence est maintenue.`
            : `${msgBase} Merci de reconfirmer votre présence.`

          await tx.notification.create({
            data: {
              userId:         aff.collaborateur.user.id,
              organizationId: session.user.organizationId!,
              type:           'REPRESENTATION_REPORTEE',
              priority:       'URGENT',
              title:          'Représentation reportée',
              body:           msg,
              link:           '/mon-planning',
              actionLabel:    nouvelleConfirmation === 'EN_ATTENTE' ? 'Reconfirmer' : null,
            },
          })
        }
      } else {
        // Repartir de zéro : annuler toutes les affectations de l'ancienne date
        for (const aff of representation.affectations) {
          await tx.affectation.update({
            where: { id: aff.id },
            data: {
              confirmationStatus: 'ANNULEE',
              annulationDate:     new Date(),
              annulationRaison:   'Représentation reportée',
            },
          })

          await tx.notification.create({
            data: {
              userId:         aff.collaborateur.user.id,
              organizationId: session.user.organizationId!,
              type:           'REPRESENTATION_REPORTEE',
              priority:       'URGENT',
              title:          'Représentation reportée',
              body:           `${representation.projet.title} a été reportée. Votre affectation ne sera pas maintenue sur la nouvelle date.`,
              link:           '/mon-planning',
            },
          })
        }
      }

      await tx.activityLog.create({
        data: {
          userId:     session.user.id,
          action:     'REPRESENTATION_REPORTEE',
          entityType:     'Representation',
          entityId:       params.id,
          metadata: {
            ancienneDate:         representation.date,
            nouvelleDate:         new Date(nouvelleDate),
            nouvelleRepresentationId: nouvelleRep.id,
            maintienAffectations,
            nbAffectations:       representation.affectations.length,
            projetTitre:          representation.projet.title,
          },
        },
      })
    })

    eventBus.emit(`planning:${representation.projet.id}`, {
      type:    'representation_reportee',
      payload: { ancienneRepId: params.id, nouvelleRepId },
    })

    return NextResponse.json({ success: true, nouvelleRepresentationId: nouvelleRepId! })
  } catch (err) {
    console.error('[PATCH /api/representations/[id]/reporter]', err)
    return internalError()
  }
}
