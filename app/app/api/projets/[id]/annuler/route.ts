// ─────────────────────────────────────────────────────────
// PATCH /api/projets/[id]/annuler
// Annule un projet — DIRECTEUR uniquement (Règle #24)
// Seules les représentations futures sont annulées
// doc §12.3 — Annulations & Reports
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound, conflict, forbidden } from '@/lib/api-response'
import { eventBus } from '@/lib/event-bus'
import logger from '@/lib/logger'

const AnnulerProjetSchema = z.object({
  raison: z.string().max(500).optional(),
})

const SEUIL_TARDIVE_MS = 48 * 60 * 60 * 1000

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'DIRECTEUR', write: true })
    if (error) return error

    // Seul le DIRECTEUR peut annuler un projet
    if (session.user.organizationRole !== 'DIRECTEUR') {
      return forbidden('Seul le Directeur peut annuler un projet.')
    }

    const projet = await prisma.projet.findFirst({
      where: { id: params.id, deletedAt: null },
    })

    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    if (projet.status === 'ANNULE') {
      return conflict('Ce projet est déjà annulé.')
    }

    const body = await req.json()
    const parsed = AnnulerProjetSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const maintenant = new Date()

    // Récupérer les représentations futures uniquement (Règle #24)
    const representationsFutures = await prisma.representation.findMany({
      where: {
        projetId: params.id,
        deletedAt: null,
        date: { gt: maintenant },
        status: { notIn: ['ANNULEE', 'REPORTEE'] },
      },
      include: {
        affectations: {
          where: {
            deletedAt: null,
            confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE'] },
          },
          include: {
            collaborateur: {
              include: {
                user: { select: { id: true } },
              },
            },
          },
        },
        feuilleDeRoute: { select: { id: true, statut: true } },
      },
    })

    // Compter les DPAE soumises sur ces représentations futures
    const dpaesSoumises = await prisma.dPAE.count({
      where: {
        affectation: {
          representationId: { in: representationsFutures.map((r) => r.id) },
        },
        status: { in: ['ENVOYEE', 'CONFIRMEE'] },
      },
    })

    // Collecter tous les user IDs uniques à notifier
    const userIdsANotifier = Array.from(
      new Set(
        representationsFutures.flatMap((r) =>
          r.affectations.map((a) => a.collaborateur.user.id)
        )
      )
    )

    // Récupérer les régisseurs de l'org pour les notifier
    const regisseurs = await prisma.user.findMany({
      where: {
        memberships: {
          some: {
            organizationId: session.user.organizationId!,
            role: { in: ['REGISSEUR', 'DIRECTEUR'] },
          },
        },
        id: { not: session.user.id }, // pas le décideur lui-même
      },
      select: { id: true },
    })

    let nbAffectationsImpactees = 0

    await prisma.$transaction(async (tx) => {
      // Annuler le projet
      await tx.projet.update({
        where: { id: params.id },
        data: { status: 'ANNULE' },
      })

      // Annuler les représentations futures
      for (const rep of representationsFutures) {
        const dateRep = new Date(rep.date)
        if (rep.showStartTime) {
          const [h, m] = rep.showStartTime.split(':').map(Number)
          dateRep.setHours(h, m, 0, 0)
        }
        const estTardive = dateRep.getTime() - maintenant.getTime() <= SEUIL_TARDIVE_MS
        const nouveauStatut = estTardive ? 'ANNULEE_TARDIVE' : 'ANNULEE'

        await tx.representation.update({
          where: { id: rep.id },
          data: {
            status: 'ANNULEE',
            annulationReason: parsed.data.raison ?? null,
            annulationAt: maintenant,
          },
        })

        // Cascade affectations
        if (rep.affectations.length > 0) {
          nbAffectationsImpactees += rep.affectations.length

          await tx.affectation.updateMany({
            where: {
              representationId: rep.id,
              deletedAt: null,
              confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE'] },
            },
            data: {
              confirmationStatus: nouveauStatut,
              annulationDate: maintenant,
              // Les affectations confirmées ont un cachet à décider
              cachetAnnulation: 'A_DECIDER',
            },
          })
        }

        // Archiver la feuille de route si publiée
        if (rep.feuilleDeRoute?.statut === 'PUBLIEE') {
          await tx.feuilleDeRoute.update({
            where: { id: rep.feuilleDeRoute.id },
            data: { statut: 'ARCHIVEE' },
          })
        }
      }

      // Notifier les collaborateurs
      if (userIdsANotifier.length > 0) {
        await tx.notification.createMany({
          data: userIdsANotifier.map((userId) => ({
            userId,
            organizationId: session.user.organizationId!,
            type: 'AFFECTATION_ANNULEE' as const,
            priority: 'URGENT' as const,
            title: `❌ Le projet ${projet.title} a été annulé`,
            body: `${projet.title} est annulé${parsed.data.raison ? ` : ${parsed.data.raison}` : ''}. Contactez votre régisseur.`,
            link: '/mon-planning',
            relatedId: params.id,
            relatedType: 'projet',
          })),
        })
      }

      // Notifier les régisseurs et chefs de poste
      if (regisseurs.length > 0) {
        await tx.notification.createMany({
          data: regisseurs.map((r) => ({
            userId: r.id,
            organizationId: session.user.organizationId!,
            type: 'AFFECTATION_ANNULEE' as const,
            priority: 'URGENT' as const,
            title: `❌ Projet ${projet.title} annulé`,
            body: `${representationsFutures.length} représentation(s) future(s) annulée(s), ${nbAffectationsImpactees} affectation(s) impactée(s).`,
            link: `/projets/${params.id}/annulations`,
            relatedId: params.id,
            relatedType: 'projet',
          })),
        })
      }

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'PROJET_ANNULE',
          entityType: 'Projet',
          entityId: params.id,
          metadata: {
            raison: parsed.data.raison ?? null,
            nbRepresentationsFutures: representationsFutures.length,
            nbAffectationsImpactees,
            nbDpaesSoumises: dpaesSoumises,
          },
        },
      })
    })

    eventBus.emit(`planning:${params.id}`, {
      type: 'projet_annule',
      payload: { projetId: params.id },
    })

    return NextResponse.json({
      success: true,
      nbRepresentationsAnnulees: representationsFutures.length,
      nbAffectationsImpactees,
      nbDpaesSoumises: dpaesSoumises,
    })
  } catch (err) {
    void logger.error('PATCH /api/projets/[id]/annuler', err, { route: 'PATCH /api/projets/[id]/annuler' })
    return internalError()
  }
}
