// ─────────────────────────────────────────────────────────
// GET /api/remplacements/[affectationId]/candidats
// Moteur de suggestion de remplaçants — score de pertinence
// doc/10-remplacements-urgents.md §10.2
//
// Algorithme :
//   +4 pts  A déjà travaillé sur CE projet
//   +3 pts  A travaillé sur un projet du même type
//   +2 pts  A déjà tenu CE poste (même nom)
//   +1 pt   Type de contrat compatible (INTERMITTENT préféré)
//   -10 pts Conflit horaire sur cette date (éliminatoire)
//   -5 pts  N'a jamais répondu à des demandes (peu fiable)
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { internalError, notFound } from '@/lib/api-response'
import logger from '@/lib/logger'

export async function GET(
  req: Request,
  { params }: { params: { affectationId: string } }
) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    // Charger l'affectation annulée pour avoir le contexte
    const affectation = await prisma.affectation.findFirst({
      where: { id: params.affectationId },
      include: {
        representation: {
          include: {
            projet: {
              select: {
                id: true,
                organizationId: true,
                type: true,
                title: true,
              },
            },
          },
        },
        posteRequis: { select: { name: true, contractTypePreference: true } },
        collaborateur: {
          select: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    })

    if (!affectation) return notFound('Affectation')

    const ownershipError = verifyOwnership(
      affectation.representation.projet.organizationId,
      session.user.organizationId!
    )
    if (ownershipError) return ownershipError

    const orgId = session.user.organizationId!
    const repDate = affectation.representation.date
    const projetId = affectation.representation.projet.id
    const projetType = affectation.representation.projet.type
    const posteNom = affectation.posteRequis.name
    const startTime = affectation.startTime
    const endTime = affectation.endTime

    // Charger tous les collaborateurs actifs de l'org (sauf celui qui annule)
    const collaborateurs = await prisma.collaborateur.findMany({
      where: {
        id: { not: affectation.collaborateurId },
        accountStatus: { not: 'INACTIF' },
        user: {
          memberships: {
            some: { organizationId: orgId },
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        affectations: {
          where: { deletedAt: null },
          include: {
            representation: {
              include: {
                projet: { select: { id: true, type: true } },
              },
            },
            posteRequis: { select: { name: true } },
          },
        },
      },
    })

    // Calculer le score pour chaque candidat
    const candidats = collaborateurs.map((collab) => {
      let score = 0
      const raisons: string[] = []

      // ── Analyse de l'historique des affectations ─────────
      const affectationsActives = collab.affectations.filter(
        (a) => a.confirmationStatus !== 'ANNULEE' && a.confirmationStatus !== 'ANNULEE_TARDIVE'
      )

      // +4 pts — A déjà travaillé sur CE projet
      const surCeProjet = affectationsActives.some(
        (a) => a.representation.projet.id === projetId
      )
      if (surCeProjet) {
        score += 4
        raisons.push(`A déjà travaillé sur ${affectation.representation.projet.title}`)
      }

      // +3 pts — A travaillé sur un projet du même type
      if (!surCeProjet) {
        const memeType = affectationsActives.some(
          (a) => a.representation.projet.type === projetType
        )
        if (memeType) {
          score += 3
          raisons.push(`Expérience en ${projetType.toLowerCase()}`)
        }
      }

      // +2 pts — A déjà tenu CE poste (même nom)
      const memePoste = affectationsActives.some(
        (a) => a.posteRequis.name.toLowerCase() === posteNom.toLowerCase()
      )
      if (memePoste) {
        score += 2
        raisons.push(`Poste ${posteNom} déjà tenu`)
      }

      // +1 pt — Type de contrat compatible (INTERMITTENT préféré)
      if (
        collab.contractType === 'INTERMITTENT' ||
        affectation.posteRequis.contractTypePreference === 'INDIFFERENT'
      ) {
        score += 1
      }

      // -10 pts — Conflit horaire sur cette date (éliminatoire)
      const conflit = affectationsActives.some((a) => {
        const sameDay =
          new Date(a.representation.date).toDateString() ===
          new Date(repDate).toDateString()
        if (!sameDay) return false
        // Chevauchement simpliste HH:MM
        return a.startTime < endTime && a.endTime > startTime
      })
      if (conflit) {
        score -= 10
        raisons.push('Conflit horaire sur cette date')
      }

      // -5 pts — N'a jamais répondu (aucune affectation confirmée ou refusée)
      const aRepondu = affectationsActives.some(
        (a) =>
          a.confirmationStatus === 'CONFIRMEE' || a.confirmationStatus === 'REFUSEE'
      )
      if (!aRepondu && affectationsActives.length > 0) {
        score -= 5
        raisons.push('Peu fiable (jamais répondu)')
      }

      // Calcul du temps de réponse habituel (indicatif)
      const reponses = collab.affectations.filter(
        (a) => a.confirmedAt && a.createdAt
      )
      let tempsReponse: string | null = null
      if (reponses.length > 0) {
        const moyMs =
          reponses.reduce((acc, a) => {
            return acc + (a.confirmedAt!.getTime() - a.createdAt.getTime())
          }, 0) / reponses.length
        const moyH = Math.round(moyMs / (1000 * 60 * 60))
        tempsReponse = moyH < 2 ? '< 2h' : moyH < 24 ? `~${moyH}h` : '> 24h'
      }

      return {
        id: collab.id,
        userId: collab.user.id,
        prenom: collab.user.firstName,
        nom: collab.user.lastName,
        avatarUrl: collab.user.avatarUrl,
        contractType: collab.contractType,
        score,
        raisons,
        tempsReponse,
        aConflit: conflit,
        disponible: !conflit,
      }
    })

    // Trier par score desc, filtrer les -10 (conflits) en dernier
    const sorted = candidats
      .sort((a, b) => b.score - a.score)
      .slice(0, 5) // top 5

    return NextResponse.json({
      affectationId: params.affectationId,
      poste: posteNom,
      representation: {
        date: repDate,
        projet: affectation.representation.projet.title,
        startTime,
        endTime,
      },
      candidats: sorted,
    })
  } catch (err) {
    void logger.error('GET /api/remplacements/[affectationId]/candidats', err, { route: 'GET /api/remplacements/[affectationId]/candidats' })
    return internalError()
  }
}
