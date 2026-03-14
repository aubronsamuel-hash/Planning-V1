// ─────────────────────────────────────────────────────────
// POST /api/remplacements/[affectationId]/proposer
// Envoie une proposition de remplacement urgent à un candidat
// doc/10-remplacements-urgents.md §10.3
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import logger from '@/lib/logger'

const ProposerSchema = z.object({
  candidatId: z.string().min(1),
  notes: z.string().max(500).optional(),
})

export async function POST(
  req: Request,
  { params }: { params: { affectationId: string } }
) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'COLLABORATEUR', write: true })
    if (error) return error

    // Charger l'affectation annulée
    const affectation = await prisma.affectation.findFirst({
      where: { id: params.affectationId },
      include: {
        collaborateur: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        representation: {
          include: {
            projet: {
              select: {
                id: true,
                organizationId: true,
                title: true,
              },
            },
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

    // Vérifier que l'affectation est bien ANNULEE_TARDIVE
    if (affectation.confirmationStatus !== 'ANNULEE_TARDIVE') {
      return NextResponse.json(
        { error: 'Cette affectation n\'est pas en statut d\'annulation tardive.' },
        { status: 409 }
      )
    }

    const body = await req.json()
    const parsed = ProposerSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    // Vérifier que le candidat existe et appartient à l'org
    const candidat = await prisma.collaborateur.findFirst({
      where: {
        id: parsed.data.candidatId,
        user: {
          memberships: {
            some: { organizationId: session.user.organizationId! },
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!candidat) return notFound('Candidat')

    // Vérifier qu'une proposition EN_ATTENTE n'existe pas déjà pour ce candidat
    const existante = await prisma.propositionRemplacement.findFirst({
      where: {
        affectationAnnuleeId: params.affectationId,
        candidatId: parsed.data.candidatId,
        status: 'EN_ATTENTE',
      },
    })
    if (existante) {
      return NextResponse.json(
        { error: 'Une proposition est déjà en attente pour ce candidat.' },
        { status: 409 }
      )
    }

    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000) // +4h

    const proposition = await prisma.$transaction(async (tx) => {
      const prop = await tx.propositionRemplacement.create({
        data: {
          affectationAnnuleeId: params.affectationId,
          candidatId: parsed.data.candidatId,
          expiresAt,
          notes: parsed.data.notes ?? null,
        },
      })

      // Tracer
      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'REMPLACEMENT_PROPOSE',
          entityType: 'PropositionRemplacement',
          entityId: prop.id,
          metadata: {
            affectationAnnuleeId: params.affectationId,
            candidatId: parsed.data.candidatId,
            candidatNom: `${candidat.user.firstName} ${candidat.user.lastName}`,
            expiresAt: expiresAt.toISOString(),
          },
        },
      })

      // Notification in-app au candidat
      await tx.notification.create({
        data: {
          userId: candidat.user.id,
          organizationId: session.user.organizationId!,
          type: 'REMPLACEMENT_URGENT',
          priority: 'CRITIQUE',
          title: 'Remplacement urgent',
          body: `Vous êtes sollicité(e) en urgence pour le poste ${affectation.posteRequis.name} — ${affectation.representation.projet.title}.`,
          link: `/remplacement/${prop.propositionToken}/repondre`,
          actionLabel: 'Répondre',
        },
      })

      return prop
    })

    // TODO: envoyer l'email de remplacement urgent via lib/email.ts
    // sendReplacementUrgentEmail({ candidat, affectation, proposition, expiresAt })

    return NextResponse.json({
      success: true,
      propositionId: proposition.id,
      propositionToken: proposition.propositionToken,
      expiresAt: proposition.expiresAt,
      candidat: {
        id: candidat.id,
        prenom: candidat.user.firstName,
        nom: candidat.user.lastName,
        email: candidat.user.email,
      },
    })
  } catch (err) {
    void logger.error('POST /api/remplacements/[affectationId]/proposer', err, { route: 'POST /api/remplacements/[affectationId]/proposer' })
    return internalError()
  }
}
