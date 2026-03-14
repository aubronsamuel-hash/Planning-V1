// ─────────────────────────────────────────────────────────
// PATCH /api/representations/[id]/reporter
// Reporte une représentation vers une nouvelle date
// Options :
//   - maintenir: true  → affectations conservées, reconfirmation pour les intermittents
//   - maintenir: false → affectations annulées, repartir de zéro
// doc §12.4 — Annulations & Reports (Règle #25)
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound, conflict } from '@/lib/api-response'
import { detectConflict } from '@/lib/conflicts'
import { eventBus } from '@/lib/event-bus'

const ReporterSchema = z.object({
  nouvelleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD requis'),
  maintenir: z.boolean(), // true = maintenir les affectations, false = repartir de zéro
  // Si conflits détectés et maintenir=true, on peut forcer le maintien malgré conflits
  forcerMaintienEnConflits: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const rep = await prisma.representation.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        projet: { select: { id: true, organizationId: true, title: true } },
        affectations: {
          where: {
            deletedAt: null,
            confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE'] },
          },
          include: {
            collaborateur: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
              },
            },
            posteRequis: { select: { name: true } },
          },
        },
      },
    })

    if (!rep) return notFound('Représentation')

    const ownershipError = verifyOwnership(rep.projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    if (rep.status === 'ANNULEE' || rep.status === 'REPORTEE') {
      return conflict(`Cette représentation est déjà ${rep.status === 'REPORTEE' ? 'reportée' : 'annulée'}.`)
    }

    const body = await req.json()
    const parsed = ReporterSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { nouvelleDate, maintenir, forcerMaintienEnConflits } = parsed.data
    const maintenant = new Date()

    // Détecter les conflits si on maintient les affectations
    type ConflitCollab = { affectationId: string; collaborateurNom: string; conflitAvec: string }
    let conflitsDetectes: ConflitCollab[] = []

    if (maintenir && rep.affectations.length > 0) {
      const nouvelleDateObj = new Date(nouvelleDate)

      for (const aff of rep.affectations) {
        const startTime = rep.showStartTime ?? '00:00'
        const endTime = rep.showEndTime ?? '23:59'

        const result = await detectConflict(
          aff.collaborateurId,
          nouvelleDateObj,
          startTime,
          endTime,
          aff.id // exclure l'affectation courante
        )

        if (result.hasConflict) {
          conflitsDetectes.push({
            affectationId: aff.id,
            collaborateurNom: `${aff.collaborateur.user.firstName} ${aff.collaborateur.user.lastName}`,
            conflitAvec: result.conflictingRepresentation ?? 'autre représentation',
          })
        }
      }

      // Si conflits et pas de forçage → retourner les conflits pour que le front affiche la boite de dialogue
      if (conflitsDetectes.length > 0 && !forcerMaintienEnConflits) {
        return NextResponse.json(
          {
            code: 'CONFLITS_DETECTES',
            conflits: conflitsDetectes,
            message: `${conflitsDetectes.length} collaborateur(s) ont un conflit sur la nouvelle date.`,
          },
          { status: 409 }
        )
      }
    }

    // IDs des affectations en conflit à exclure si forcerMaintienEnConflits = false
    // (dans ce chemin on a forcerMaintienEnConflits = true donc on maintient tout)
    const affectationsIdsEnConflits = new Set(conflitsDetectes.map((c) => c.affectationId))

    let nouvelleRepId: string | undefined

    await prisma.$transaction(async (tx) => {
      // Créer la nouvelle représentation
      const nouvelleRep = await tx.representation.create({
        data: {
          projetId: rep.projetId,
          date: new Date(nouvelleDate),
          type: rep.type,
          status: 'PLANIFIEE',
          getInTime: rep.getInTime,
          warmupTime: rep.warmupTime,
          showStartTime: rep.showStartTime,
          showEndTime: rep.showEndTime,
          getOutTime: rep.getOutTime,
          venueName: rep.venueName,
          venueCity: rep.venueCity,
          venueAddress: rep.venueAddress,
          notes: rep.notes,
        },
      })
      nouvelleRepId = nouvelleRep.id

      // Marquer l'ancienne représentation comme reportée
      await tx.representation.update({
        where: { id: params.id },
        data: {
          status: 'REPORTEE',
          annulationAt: maintenant,
          reporteeVersId: nouvelleRep.id,
        },
      })

      if (!maintenir) {
        // Option B : annuler toutes les affectations
        await tx.affectation.updateMany({
          where: {
            representationId: params.id,
            deletedAt: null,
            confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE'] },
          },
          data: {
            confirmationStatus: 'ANNULEE',
            annulationDate: maintenant,
          },
        })

        // Notifier les collaborateurs
        for (const aff of rep.affectations) {
          await tx.notification.create({
            data: {
              userId: aff.collaborateur.user.id,
              organizationId: session.user.organizationId!,
              type: 'AFFECTATION_ANNULEE',
              priority: 'URGENT',
              title: `🔄 ${rep.projet.title} reportée — affectation annulée`,
              body: `${rep.projet.title} a été reportée au ${new Date(nouvelleDate).toLocaleDateString('fr-FR')}. Votre affectation n'a pas été maintenue.`,
              link: '/mon-planning',
              relatedId: params.id,
              relatedType: 'representation',
            },
          })
        }
      } else {
        // Option A : maintenir les affectations sur la nouvelle date
        for (const aff of rep.affectations) {
          const estEnConflitNonForce = affectationsIdsEnConflits.has(aff.id) && !forcerMaintienEnConflits

          if (estEnConflitNonForce) continue // exclure si conflit non résolu (ne devrait pas arriver ici)

          const estIntermittent = aff.confirmationStatus !== 'NON_REQUISE'
          const nouvelleAff = await tx.affectation.create({
            data: {
              representationId: nouvelleRep.id,
              collaborateurId: aff.collaborateurId,
              posteRequisId: aff.posteRequisId,
              startTime: aff.startTime,
              endTime: aff.endTime,
              cachet: aff.cachet,
              // Intermittents → EN_ATTENTE, CDI/CDD → NON_REQUISE
              confirmationStatus: estIntermittent ? 'EN_ATTENTE' : 'NON_REQUISE',
              // Marquer le conflit si présent (non bloquant — Règle #22)
              hasConflict: affectationsIdsEnConflits.has(aff.id),
            },
          })

          // Annuler l'ancienne affectation
          await tx.affectation.update({
            where: { id: aff.id },
            data: {
              confirmationStatus: 'ANNULEE',
              annulationDate: maintenant,
            },
          })

          // Notification selon type de contrat
          if (estIntermittent) {
            await tx.notification.create({
              data: {
                userId: aff.collaborateur.user.id,
                organizationId: session.user.organizationId!,
                type: 'CONFIRMATION_REQUISE',
                priority: 'URGENT',
                title: `🔄 ${rep.projet.title} reportée au ${new Date(nouvelleDate).toLocaleDateString('fr-FR')}`,
                body: 'Merci de reconfirmer votre présence pour la nouvelle date.',
                link: `/mon-planning`,
                relatedId: nouvelleAff.id,
                relatedType: 'affectation',
              },
            })
          } else {
            // CDI/CDD : notification informative
            await tx.notification.create({
              data: {
                userId: aff.collaborateur.user.id,
                organizationId: session.user.organizationId!,
                type: 'AFFECTATION_CREEE',
                priority: 'INFO',
                title: `🔄 ${rep.projet.title} reportée au ${new Date(nouvelleDate).toLocaleDateString('fr-FR')}`,
                body: 'Votre présence est maintenue sur la nouvelle date.',
                link: '/mon-planning',
                relatedId: nouvelleAff.id,
                relatedType: 'affectation',
              },
            })
          }
        }
      }

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'REPRESENTATION_REPORTEE',
          entityType: 'Representation',
          entityId: params.id,
          metadata: {
            ancienneDate: rep.date,
            nouvelleDate,
            nouvelleRepresentationId: nouvelleRep.id,
            maintenir,
            nbAffectations: rep.affectations.length,
            nbConflits: conflitsDetectes.length,
          },
        },
      })
    })

    eventBus.emit(`planning:${rep.projet.id}`, {
      type: 'representation_reportee',
      payload: { ancienneRepId: params.id, nouvelleRepId },
    })

    return NextResponse.json({
      success: true,
      nouvelleRepresentationId: nouvelleRepId,
      nbAffectationsMaintenues: maintenir ? rep.affectations.length - (forcerMaintienEnConflits ? 0 : affectationsIdsEnConflits.size) : 0,
      nbConflits: conflitsDetectes.length,
    })
  } catch (err) {
    console.error('[PATCH /api/representations/[id]/reporter]', err)
    return internalError()
  }
}
