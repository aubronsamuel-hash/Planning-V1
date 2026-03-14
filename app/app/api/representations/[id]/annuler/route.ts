// ─────────────────────────────────────────────────────────
// PATCH /api/representations/[id]/annuler
// Annule une représentation entière + cascade affectations
// doc §12.2 — Annulations & Reports
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound, conflict } from '@/lib/api-response'
import { eventBus } from '@/lib/event-bus'

const AnnulerRepSchema = z.object({
  raison: z.string().max(500).optional(),
})

const SEUIL_TARDIVE_MS = 48 * 60 * 60 * 1000

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const rep = await prisma.representation.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        projet: { select: { id: true, organizationId: true, title: true } },
        affectations: {
          where: { deletedAt: null },
          include: {
            collaborateur: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true } },
              },
            },
            posteRequis: { select: { name: true } },
          },
        },
        feuilleDeRoute: { select: { id: true, statut: true } },
      },
    })

    if (!rep) return notFound('Représentation')

    const ownershipError = verifyOwnership(rep.projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    if (rep.status === 'ANNULEE') {
      return conflict('Cette représentation est déjà annulée.')
    }

    const body = await req.json()
    const parsed = AnnulerRepSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const maintenant = new Date()
    const dateRep = new Date(rep.date)
    if (rep.showStartTime) {
      const [h, m] = rep.showStartTime.split(':').map(Number)
      dateRep.setHours(h, m, 0, 0)
    }
    const estTardive = dateRep.getTime() - maintenant.getTime() <= SEUIL_TARDIVE_MS

    // IDs des utilisateurs à notifier (TOUS les collaborateurs affectés, y compris EN_ATTENTE et REFUSEE — Règle #26)
    const userIdsANotifier = rep.affectations
      .map((a) => a.collaborateur.user.id)
      .filter((id, i, arr) => arr.indexOf(id) === i)

    const affectationsConfirmees = rep.affectations.filter(
      (a) =>
        a.confirmationStatus === 'CONFIRMEE' || a.confirmationStatus === 'NON_REQUISE'
    )

    await prisma.$transaction(async (tx) => {
      // Annuler la représentation
      await tx.representation.update({
        where: { id: params.id },
        data: {
          status: 'ANNULEE',
          annulationReason: parsed.data.raison ?? null,
          annulationAt: maintenant,
        },
      })

      // Cascade affectations → ANNULEE ou ANNULEE_TARDIVE
      if (rep.affectations.length > 0) {
        const nouveauStatut = estTardive ? 'ANNULEE_TARDIVE' : 'ANNULEE'

        await tx.affectation.updateMany({
          where: {
            representationId: params.id,
            deletedAt: null,
            confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE'] },
          },
          data: {
            confirmationStatus: nouveauStatut,
            annulationDate: maintenant,
          },
        })

        // Affectations confirmées → cachetAnnulation = A_DECIDER
        if (affectationsConfirmees.length > 0) {
          await tx.affectation.updateMany({
            where: {
              id: { in: affectationsConfirmees.map((a) => a.id) },
            },
            data: { cachetAnnulation: 'A_DECIDER' },
          })
        }
      }

      // Archiver la feuille de route si publiée
      if (rep.feuilleDeRoute && rep.feuilleDeRoute.statut === 'PUBLIEE') {
        await tx.feuilleDeRoute.update({
          where: { id: rep.feuilleDeRoute.id },
          data: { statut: 'ARCHIVEE' },
        })
      }

      // Notifier tous les collaborateurs affectés
      if (userIdsANotifier.length > 0) {
        await tx.notification.createMany({
          data: userIdsANotifier.map((userId) => ({
            userId,
            organizationId: session.user.organizationId!,
            type: 'AFFECTATION_ANNULEE' as const,
            priority: 'URGENT' as const,
            title: `❌ ${rep.projet.title} — ${new Date(rep.date).toLocaleDateString('fr-FR')} annulée`,
            body: 'Cette représentation a été annulée. Contactez votre régisseur pour plus d\'informations.',
            link: '/mon-planning',
            relatedId: params.id,
            relatedType: 'representation',
          })),
        })
      }

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'REPRESENTATION_ANNULEE',
          entityType: 'Representation',
          entityId: params.id,
          metadata: {
            raison: parsed.data.raison ?? null,
            nbAffectationsImpactees: rep.affectations.length,
            projetTitre: rep.projet.title,
          },
        },
      })
    })

    eventBus.emit(`planning:${rep.projet.id}`, {
      type: 'representation_annulee',
      payload: { representationId: params.id },
    })

    return NextResponse.json({
      success: true,
      nbAffectationsImpactees: rep.affectations.length,
      nbCachetsADecider: affectationsConfirmees.length,
    })
  } catch (err) {
    console.error('[PATCH /api/representations/[id]/annuler]', err)
    return internalError()
  }
}
