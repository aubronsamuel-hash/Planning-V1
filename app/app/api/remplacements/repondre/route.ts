// ─────────────────────────────────────────────────────────
// GET  /api/remplacements/repondre?token=xxx — Lecture de la proposition
// POST /api/remplacements/repondre?token=xxx — Accepter ou Refuser
// Route publique (sans auth session) — magic token 4h
// doc/10-remplacements-urgents.md §10.3
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { validationError, internalError } from '@/lib/api-response'
import { eventBus } from '@/lib/event-bus'

function getToken(req: Request): string | null {
  const { searchParams } = new URL(req.url)
  return searchParams.get('token')
}

async function resolveProposition(token: string) {
  const proposition = await prisma.propositionRemplacement.findUnique({
    where: { propositionToken: token },
    include: {
      candidat: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      affectationAnnulee: {
        include: {
          representation: {
            include: {
              projet: {
                select: {
                  id: true,
                  organizationId: true,
                  title: true,
                  colorCode: true,
                },
              },
            },
          },
          posteRequis: { select: { name: true } },
        },
      },
    },
  })

  if (!proposition) return { error: 'Lien invalide.', status: 404 }
  if (proposition.expiresAt < new Date() && proposition.status === 'EN_ATTENTE') {
    return { error: 'Ce lien a expiré (4 heures). Contactez le régisseur.', status: 410 }
  }

  return { proposition }
}

// ── GET — Lire la proposition ─────────────────────────────
export async function GET(req: Request) {
  try {
    const token = getToken(req)
    if (!token) return NextResponse.json({ error: 'Token manquant.' }, { status: 400 })

    const result = await resolveProposition(token)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    const { proposition } = result
    const aff = proposition.affectationAnnulee
    const rep = aff.representation

    return NextResponse.json({
      prenom: proposition.candidat.user.firstName,
      projetTitre: rep.projet.title,
      projetColorCode: rep.projet.colorCode,
      representationDate: rep.date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      representationLieu: [rep.venueName, rep.venueCity].filter(Boolean).join(' · '),
      poste: aff.posteRequis.name,
      heureDebut: aff.startTime,
      heureFin: aff.endTime,
      cachet: aff.remuneration,
      expiresAt: proposition.expiresAt,
      status: proposition.status,
    })
  } catch (err) {
    console.error('[GET /api/remplacements/repondre]', err)
    return internalError()
  }
}

// ── POST — Accepter ou Refuser ────────────────────────────
const RepondreSchema = z.object({
  action: z.enum(['ACCEPTEE', 'REFUSEE']),
})

export async function POST(req: Request) {
  try {
    const token = getToken(req)
    if (!token) return NextResponse.json({ error: 'Token manquant.' }, { status: 400 })

    const body = await req.json()
    const parsed = RepondreSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const result = await resolveProposition(token)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

    const { proposition } = result

    if (proposition.status !== 'EN_ATTENTE') {
      return NextResponse.json(
        { error: 'Cette proposition a déjà reçu une réponse.' },
        { status: 409 }
      )
    }

    const aff = proposition.affectationAnnulee

    await prisma.$transaction(async (tx) => {
      // Mettre à jour le statut de la proposition
      await tx.propositionRemplacement.update({
        where: { id: proposition.id },
        data: {
          status: parsed.data.action,
          respondedAt: new Date(),
        },
      })

      if (parsed.data.action === 'ACCEPTEE') {
        // Créer la nouvelle affectation de remplacement
        const nouvelleAffectation = await tx.affectation.create({
          data: {
            collaborateurId: proposition.candidatId,
            representationId: aff.representationId,
            posteRequisId: aff.posteRequisId,
            contractTypeUsed: proposition.candidat.contractType,
            startTime: aff.startTime,
            endTime: aff.endTime,
            remuneration: aff.remuneration,
            confirmationStatus: 'CONFIRMEE', // acceptation explicite via lien
            confirmedAt: new Date(),
            remplaceDe: aff.id, // traçabilité
            dpaeStatus:
              proposition.candidat.contractType === 'CDI' ? 'NON_REQUISE' : 'A_FAIRE',
          },
        })

        // Tracer
        await tx.activityLog.create({
          data: {
            userId: null, // action via lien public — pas d'utilisateur connecté
            action: 'REMPLACEMENT_ACCEPTE',
            entityType: 'PropositionRemplacement',
            entityId: proposition.id,
            metadata: {
              nouvelleAffectationId: nouvelleAffectation.id,
              candidatId: proposition.candidatId,
              affectationAnnuleeId: aff.id,
            },
          },
        })

        // Notifier le régisseur
        const regisseur = await tx.user.findFirst({
          where: {
            memberships: {
              some: {
                organizationId: aff.representation.projet.organizationId,
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
              organizationId: aff.representation.projet.organizationId,
              type: 'REMPLACEMENT_URGENT',
              priority: 'URGENT',
              title: 'Remplacement accepté',
              body: `${proposition.candidat.user.firstName} ${proposition.candidat.user.lastName} a accepté le poste ${aff.posteRequis.name}.`,
              link: `/projets/${aff.representation.projet.id}/remplacements`,
            },
          })
        }

        // SSE pour mettre à jour la grille
        eventBus.emit(`planning:${aff.representation.projet.id}`, {
          type: 'affectation_created',
          payload: {
            affectationId: nouvelleAffectation.id,
            representationId: aff.representationId,
            posteRequisId: aff.posteRequisId,
            confirmationStatus: 'CONFIRMEE',
          },
        })
      } else {
        // Refus — tracer
        await tx.activityLog.create({
          data: {
            userId: null,
            action: 'REMPLACEMENT_REFUSE',
            entityType: 'PropositionRemplacement',
            entityId: proposition.id,
            metadata: {
              candidatId: proposition.candidatId,
              affectationAnnuleeId: aff.id,
            },
          },
        })

        // Notifier le régisseur du refus
        const regisseur = await tx.user.findFirst({
          where: {
            memberships: {
              some: {
                organizationId: aff.representation.projet.organizationId,
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
              organizationId: aff.representation.projet.organizationId,
              type: 'REMPLACEMENT_URGENT',
              priority: 'CRITIQUE',
              title: 'Remplacement refusé',
              body: `${proposition.candidat.user.firstName} ${proposition.candidat.user.lastName} n'est pas disponible pour ${aff.posteRequis.name}.`,
              link: `/projets/${aff.representation.projet.id}/remplacements`,
              actionLabel: 'Contacter le suivant',
            },
          })
        }
      }
    })

    return NextResponse.json({ success: true, status: parsed.data.action })
  } catch (err) {
    console.error('[POST /api/remplacements/repondre]', err)
    return internalError()
  }
}
