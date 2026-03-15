// ─────────────────────────────────────────────────────────
// PATCH /api/representations/[id]/annuler
// Annule une représentation entière + toutes ses affectations
// doc/12-annulations-reports.md §12.2
// Accès : REGISSEUR minimum
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import { eventBus } from '@/lib/event-bus'

const AnnulerRepSchema = z.object({
  raison: z.string().optional(),
})

const SEUIL_TARDIVE_MS = 48 * 60 * 60 * 1000

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
      return NextResponse.json({ error: 'Cette représentation est déjà annulée.' }, { status: 409 })
    }

    const body   = await req.json()
    const parsed = AnnulerRepSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const raison = parsed.data.raison ?? null

    // Calcul tardivité
    const repDate = new Date(representation.date)
    if (representation.showStartTime) {
      const [h, m] = representation.showStartTime.toString().split(':').map(Number)
      if (!isNaN(h) && !isNaN(m)) repDate.setHours(h, m, 0, 0)
    }
    const estTardive = (repDate.getTime() - Date.now()) <= SEUIL_TARDIVE_MS

    // Vérifier les DPAE soumises
    const dpaesSoumises = representation.affectations.filter(
      (a) => a.dpaeStatus === 'ENVOYEE' || a.dpaeStatus === 'CONFIRMEE'
    )

    await prisma.$transaction(async (tx) => {
      // Mettre à jour la représentation
      await tx.representation.update({
        where: { id: params.id },
        data: {
          status:           'ANNULEE',
          annulationReason: raison,
          annulationAt:     new Date(),
        },
      })

      // Annuler toutes les affectations actives
      for (const aff of representation.affectations) {
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
            annulationDate:     new Date(),
            cachetAnnulation:   cachet,
          },
        })

        // Notifier chaque collaborateur affecté (y compris EN_ATTENTE / REFUSEE — Règle #26)
        await tx.notification.create({
          data: {
            userId:         aff.collaborateur.user.id,
            organizationId: session.user.organizationId!,
            type:           'REPRESENTATION_ANNULEE',
            priority:       'URGENT',
            title:          'Représentation annulée',
            body:           `${representation.projet.title} · ${new Date(representation.date).toLocaleDateString('fr-FR')} est annulée.${raison ? ` ${raison}` : ''}`,
            link:           '/mon-planning',
          },
        })
      }

      await tx.activityLog.create({
        data: {
          userId:     session.user.id,
          action:     'REPRESENTATION_ANNULEE',
          entityType:     'Representation',
          entityId:       params.id,
          metadata: {
            raison,
            nbAffectationsImpactees: representation.affectations.length,
            nbDpaeSoumises:          dpaesSoumises.length,
            projetTitre:             representation.projet.title,
          },
        },
      })
    })

    eventBus.emit(`planning:${representation.projet.id}`, {
      type:    'representation_annulee',
      payload: { representationId: params.id },
    })

    return NextResponse.json({
      success:             true,
      nbAffectationsImpactees: representation.affectations.length,
      nbDpaeSoumises:      dpaesSoumises.length,
    })
  } catch (err) {
    console.error('[PATCH /api/representations/[id]/annuler]', err)
    return internalError()
  }
}
