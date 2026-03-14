// ─────────────────────────────────────────────────────────
// PATCH /api/projets/[id]/annuler
// Annule un projet et toutes ses représentations futures
// doc/12-annulations-reports.md §12.3
// Accès : DIRECTEUR uniquement (Règle doc §12.3)
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import { eventBus } from '@/lib/event-bus'

const AnnulerProjetSchema = z.object({
  raison: z.string().optional(),
})

const SEUIL_TARDIVE_MS = 48 * 60 * 60 * 1000
const now = () => new Date()

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'DIRECTEUR', write: true })
    if (error) return error

    const projet = await prisma.projet.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        representations: {
          where: {
            deletedAt: null,
            date:      { gt: now() }, // uniquement les dates futures — Règle #24
            status:    { not: 'ANNULEE' },
          },
          include: {
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
        },
      },
    })

    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    if (projet.status === 'ANNULE') {
      return NextResponse.json({ error: 'Ce projet est déjà annulé.' }, { status: 409 })
    }

    const body   = await req.json()
    const parsed = AnnulerProjetSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const raison = parsed.data.raison ?? null

    // Calcul des chiffres pour la réponse
    let nbRepresentations = 0
    let nbAffectations    = 0
    let nbDpaeSoumises    = 0

    // Collecter les userId uniques à notifier
    const userIds = new Set<string>()

    await prisma.$transaction(async (tx) => {
      // Annuler le projet
      await tx.projet.update({
        where: { id: params.id },
        data:  { status: 'ANNULE' },
      })

      for (const rep of projet.representations) {
        nbRepresentations++

        // Calcul tardivité pour cette représentation
        const repDate = new Date(rep.date)
        if (rep.showStartTime) {
          const [h, m] = rep.showStartTime.toString().split(':').map(Number)
          if (!isNaN(h) && !isNaN(m)) repDate.setHours(h, m, 0, 0)
        }
        const estTardive = (repDate.getTime() - Date.now()) <= SEUIL_TARDIVE_MS

        await tx.representation.update({
          where: { id: rep.id },
          data: {
            status:           'ANNULEE',
            annulationReason: raison,
            annulationAt:     now(),
          },
        })

        for (const aff of rep.affectations) {
          nbAffectations++
          if (aff.dpaeStatus === 'ENVOYEE' || aff.dpaeStatus === 'CONFIRMEE') nbDpaeSoumises++

          const statut = estTardive ? 'ANNULEE_TARDIVE' : 'ANNULEE'
          const cachet =
            (aff.confirmationStatus === 'CONFIRMEE' || aff.confirmationStatus === 'NON_REQUISE')
              ? 'A_DECIDER'
              : null

          await tx.affectation.update({
            where: { id: aff.id },
            data: {
              confirmationStatus: statut,
              annulationRaison:   raison,
              annulationDate:     now(),
              cachetAnnulation:   cachet,
            },
          })

          userIds.add(aff.collaborateur.user.id)
        }
      }

      // Notifier les régisseurs
      const equipeOrg = await tx.organizationMembership.findMany({
        where: {
          organizationId: session.user.organizationId!,
          role: { in: ['REGISSEUR', 'DIRECTEUR'] },
        },
        select: { userId: true },
      })
      for (const m of equipeOrg) userIds.add(m.userId)

      // Envoyer la notification à tous les concernés (sauf l'auteur)
      for (const uid of Array.from(userIds)) {
        if (uid === session.user.id) continue
        await tx.notification.create({
          data: {
            userId:         uid,
            organizationId: session.user.organizationId!,
            type:           'PROJET_ANNULE',
            priority:       'URGENT',
            title:          'Projet annulé',
            body:           `Le projet ${projet.title} a été annulé.${raison ? ` Raison : ${raison}` : ''}`,
            link:           `/projets/${params.id}`,
          },
        })
      }

      await tx.activityLog.create({
        data: {
          userId:     session.user.id,
          action:     'PROJET_ANNULE',
          entityType:     'Projet',
          entityId:       params.id,
          metadata: {
            raison,
            nbRepresentations,
            nbAffectations,
            nbDpaeSoumises,
            titre:          projet.title,
          },
        },
      })
    })

    eventBus.emit(`planning:${params.id}`, {
      type:    'projet_annule',
      payload: { projetId: params.id },
    })

    return NextResponse.json({
      success:          true,
      nbRepresentations,
      nbAffectations,
      nbDpaeSoumises,
    })
  } catch (err) {
    console.error('[PATCH /api/projets/[id]/annuler]', err)
    return internalError()
  }
}
