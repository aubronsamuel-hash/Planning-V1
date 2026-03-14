// ─────────────────────────────────────────────────────────
// POST /api/affectations/[id]/annuler-tardive
// Signale une annulation tardive (≤ 48h) → déclenche le workflow Remplacement Urgent
// doc/10-remplacements-urgents.md §10.1
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import { eventBus } from '@/lib/event-bus'
import logger from '@/lib/logger'

const AnnulerTardiveSchema = z.object({
  raison: z.enum(['MALADIE', 'INDISPONIBILITE', 'AUTRE']).optional(),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'COLLABORATEUR', write: true })
    if (error) return error

    const affectation = await prisma.affectation.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        collaborateur: {
          include: {
            user: { select: { firstName: true, lastName: true } },
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

    // Vérifier que l'affectation est dans un état annulable
    if (
      affectation.confirmationStatus === 'ANNULEE' ||
      affectation.confirmationStatus === 'ANNULEE_TARDIVE'
    ) {
      return NextResponse.json(
        { error: 'Cette affectation est déjà annulée.' },
        { status: 409 }
      )
    }

    const body = await req.json()
    const parsed = AnnulerTardiveSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const raisonLabel =
      parsed.data.raison === 'MALADIE'
        ? 'Maladie / force majeure'
        : parsed.data.raison === 'INDISPONIBILITE'
        ? 'Indisponibilité de dernière minute'
        : parsed.data.raison === 'AUTRE'
        ? 'Autre'
        : undefined

    await prisma.$transaction(async (tx) => {
      // Marquer l'affectation ANNULEE_TARDIVE (soft delete)
      await tx.affectation.update({
        where: { id: params.id },
        data: {
          confirmationStatus: 'ANNULEE_TARDIVE',
          annulationRaison: raisonLabel ?? null,
          annulationDate: new Date(),
          deletedAt: new Date(),
        },
      })

      // Tracer
      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'AFFECTATION_ANNULEE_TARDIVE',
          entityType: 'Affectation',
          entityId: params.id,
          metadata: {
            raison: raisonLabel ?? null,
            collaborateurNom: `${affectation.collaborateur.user.firstName} ${affectation.collaborateur.user.lastName}`,
            poste: affectation.posteRequis.name,
            projetTitre: affectation.representation.projet.title,
          },
        },
      })

      // Notification CRITIQUE au régisseur et chefs de poste
      const regisseur = await tx.user.findFirst({
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

      if (regisseur) {
        await tx.notification.create({
          data: {
            userId: regisseur.id,
            organizationId: session.user.organizationId!,
            type: 'REMPLACEMENT_URGENT',
            priority: 'CRITIQUE',
            title: 'Annulation tardive — Remplacement urgent',
            body: `${affectation.collaborateur.user.firstName} ${affectation.collaborateur.user.lastName} s'est désisté(e) pour le poste ${affectation.posteRequis.name} — ${affectation.representation.projet.title}.`,
            link: `/projets/${affectation.representation.projet.id}/remplacements`,
            actionLabel: 'Voir les candidats',
          },
        })
      }
    })

    // Émettre SSE pour mettre à jour la grille planning en temps réel
    eventBus.emit(`planning:${affectation.representation.projet.id}`, {
      type: 'affectation_updated',
      payload: {
        affectationId: params.id,
        confirmationStatus: 'ANNULEE_TARDIVE',
        representationId: affectation.representationId,
        posteRequisId: affectation.posteRequisId,
      },
    })

    return NextResponse.json({
      success: true,
      affectationId: params.id,
      projetId: affectation.representation.projet.id,
    })
  } catch (err) {
    void logger.error('POST /api/affectations/[id]/annuler-tardive', err, { route: 'POST /api/affectations/[id]/annuler-tardive' })
    return internalError()
  }
}
