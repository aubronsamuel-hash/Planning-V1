// ─────────────────────────────────────────────────────────
// POST /api/affectations — Créer une affectation
// doc/03-workflows.md §5.5 · doc/06 Règles #2, #3, #14, #19, #20, #22
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import { detectConflict } from '@/lib/conflicts'
import { eventBus } from '@/lib/event-bus'
import logger from '@/lib/logger'

const CreateAffectationSchema = z.object({
  collaborateurId: z.string().cuid(),
  representationId: z.string().cuid(),
  posteRequisId: z.string().cuid(),
  contractTypeUsed: z.enum(['CDI', 'CDD', 'INTERMITTENT']),
  // Horaires — pré-remplis depuis PosteRequis.default* si non fournis (Règle #19)
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  remuneration: z.number().int().min(0).optional(),       // en centimes
  heuresContrat: z.number().int().min(0).optional(),       // pour CDI null, intermittents/CDD optionnel
  notes: z.string().max(500).optional(),
})

export async function POST(req: Request) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'COLLABORATEUR', write: true })
    if (error) return error

    const body = await req.json()
    const parsed = CreateAffectationSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { collaborateurId, representationId, posteRequisId, contractTypeUsed } = parsed.data
    const organizationId = session.user.organizationId!

    // 1. Récupérer la représentation + son projet pour vérifier l'ownership
    const representation = await prisma.representation.findFirst({
      where: { id: representationId },
      include: { projet: { select: { id: true, organizationId: true } } },
    })
    if (!representation) return notFound('Représentation')

    const ownershipError = verifyOwnership(representation.projet.organizationId, organizationId)
    if (ownershipError) return ownershipError

    // 2. Vérifier que le poste requis appartient au projet
    const posteRequis = await prisma.posteRequis.findFirst({
      where: { id: posteRequisId, projetId: representation.projet.id },
    })
    if (!posteRequis) return notFound('Poste requis')

    // 3. Vérifier que le collaborateur existe et appartient à l'org
    const collaborateur = await prisma.collaborateur.findUnique({
      where: { id: collaborateurId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    })
    if (!collaborateur) return notFound('Collaborateur')

    const membership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: collaborateur.userId, organizationId } },
    })
    if (!membership) return notFound('Collaborateur')

    // 4. Déterminer les horaires (Règle #19 : héritage depuis PosteRequis)
    const startTime = parsed.data.startTime ?? posteRequis.defaultStartTime ?? '09:00'
    const endTime   = parsed.data.endTime   ?? posteRequis.defaultEndTime   ?? '18:00'

    // 5. Détection de conflit horaire (Règle #2, #20, #22) — non bloquant
    const { hasConflict } = await detectConflict(
      collaborateurId,
      representation.date,
      startTime,
      endTime
    )

    // 6. Déterminer les statuts selon le type de contrat (doc §5.5 + Décision session 9)
    let confirmationStatus: 'EN_ATTENTE' | 'NON_REQUISE'
    let dpaeStatus: 'A_FAIRE' | 'NON_REQUISE'

    if (contractTypeUsed === 'CDI') {
      confirmationStatus = 'NON_REQUISE'
      dpaeStatus = 'NON_REQUISE'
    } else if (contractTypeUsed === 'CDD') {
      confirmationStatus = 'NON_REQUISE'
      dpaeStatus = 'A_FAIRE'    // Règle #3 : DPAE requise pour chaque engagement CDD
    } else {
      // INTERMITTENT
      confirmationStatus = 'EN_ATTENTE'
      dpaeStatus = 'A_FAIRE'    // Règle #3 : DPAE requise pour chaque engagement INTERMITTENT
    }

    // 7. Créer l'affectation
    const affectation = await prisma.affectation.create({
      data: {
        collaborateurId,
        representationId,
        posteRequisId,
        contractTypeUsed,
        startTime,
        endTime,
        remuneration: parsed.data.remuneration,
        heuresContrat: contractTypeUsed === 'CDI' ? null : parsed.data.heuresContrat,
        confirmationStatus,
        dpaeStatus,
        hasConflict,
        notes: parsed.data.notes,
      },
      include: {
        collaborateur: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
        representation: {
          include: { projet: { select: { id: true, title: true } } },
        },
        posteRequis: { select: { name: true, isCritique: true } },
      },
    })

    // 8. Tracer l'activité
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'AFFECTATION_CREATED',
        entityType: 'Affectation',
        entityId: affectation.id,
        metadata: {
          collaborateurId,
          projetId: representation.projet.id,
          representationId,
          contractTypeUsed,
          hasConflict,
        },
      },
    })

    // 9. Notification in-app au collaborateur (si compte ACTIVE)
    if (collaborateur.accountStatus === 'ACTIVE') {
      const projetTitle = affectation.representation.projet.title
      const dateStr = representation.date.toLocaleDateString('fr-FR')
      await prisma.notification.create({
        data: {
          userId: collaborateur.userId,
          organizationId,
          type: 'AFFECTATION_CREEE',
          title: `Nouvelle affectation — ${projetTitle}`,
          body: `Vous êtes planifié(e) le ${dateStr} en tant que ${affectation.posteRequis.name}.`,
          link: `/mon-planning`,
          priority: 'INFO',
        },
      })
    }

    // 10. Si INTERMITTENT : générer MagicLinkToken de confirmation (7 jours)
    let confirmationToken: string | null = null
    if (contractTypeUsed === 'INTERMITTENT') {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const token = await prisma.magicLinkToken.create({
        data: {
          userId: collaborateur.userId,
          purpose: 'CONFIRMATION',
          expiresAt,
          metadata: { affectationId: affectation.id },
        },
      })
      confirmationToken = token.token

      // TODO: envoyer l'email de confirmation via lib/email.ts
      // await sendEmail({ to: collaborateur.user.email, ... })
    }

    // 11. Émettre l'événement SSE pour mise à jour temps réel de la grille
    eventBus.emit(`planning:${representation.projet.id}`, {
      type: 'affectation_created',
      payload: {
        affectationId: affectation.id,
        representationId,
        posteRequisId,
        confirmationStatus,
        hasConflict,
      },
    })

    void logger.info('Affectation créée', {
      route: 'POST /api/affectations',
      userId: session.user.id,
      organizationId,
      affectationId: affectation.id,
      collaborateurId,
      representationId,
      contractTypeUsed,
      hasConflict,
      confirmationStatus,
    })

    return NextResponse.json({ ...affectation, confirmationToken }, { status: 201 })
  } catch (err) {
    void logger.error('POST /api/affectations', err, { route: 'POST /api/affectations' })
    return internalError()
  }
}
