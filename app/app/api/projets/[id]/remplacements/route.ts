// ─────────────────────────────────────────────────────────
// GET /api/projets/[id]/remplacements
// Liste tous les remplacements actifs (et récents) d'un projet
// doc/10-remplacements-urgents.md §10.4
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { internalError, notFound } from '@/lib/api-response'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const projet = await prisma.projet.findFirst({
      where: { id: params.id, deletedAt: null },
      select: { id: true, organizationId: true, title: true },
    })

    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    // Charger toutes les affectations ANNULEE_TARDIVE du projet
    const affectationsAnnulees = await prisma.affectation.findMany({
      where: {
        representationId: {
          in: await prisma.representation
            .findMany({ where: { projetId: params.id }, select: { id: true } })
            .then((reps) => reps.map((r) => r.id)),
        },
        confirmationStatus: 'ANNULEE_TARDIVE',
      },
      include: {
        collaborateur: {
          include: {
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        representation: {
          select: {
            date: true,
            showStartTime: true,
            venueName: true,
            venueCity: true,
          },
        },
        posteRequis: { select: { name: true } },
        propositions: {
          orderBy: { proposedAt: 'desc' },
          include: {
            candidat: {
              include: {
                user: { select: { firstName: true, lastName: true, avatarUrl: true } },
              },
            },
          },
        },
        remplacements: {
          where: { deletedAt: null },
          include: {
            collaborateur: {
              include: {
                user: { select: { firstName: true, lastName: true, avatarUrl: true } },
              },
            },
          },
        },
      },
      orderBy: { annulationDate: 'desc' },
    })

    // Enrichir avec le statut du remplacement
    const remplacements = affectationsAnnulees.map((aff) => {
      const propositionActive = aff.propositions.find((p) => p.status === 'EN_ATTENTE')
      const remplacant = aff.remplacements[0] ?? null

      let statut: 'REMPLACE' | 'EN_ATTENTE_REPONSE' | 'NON_POURVU'
      if (remplacant) {
        statut = 'REMPLACE'
      } else if (propositionActive) {
        statut = 'EN_ATTENTE_REPONSE'
      } else {
        statut = 'NON_POURVU'
      }

      return {
        affectationId: aff.id,
        collaborateurAnnule: {
          prenom: aff.collaborateur.user.firstName,
          nom: aff.collaborateur.user.lastName,
          avatarUrl: aff.collaborateur.user.avatarUrl,
        },
        poste: aff.posteRequis.name,
        annulationDate: aff.annulationDate,
        annulationRaison: aff.annulationRaison,
        representation: {
          date: aff.representation.date,
          showStartTime: aff.representation.showStartTime,
          lieu: [aff.representation.venueName, aff.representation.venueCity]
            .filter(Boolean)
            .join(' · '),
        },
        statut,
        propositionActive: propositionActive
          ? {
              id: propositionActive.id,
              candidat: {
                id: propositionActive.candidat.id,
                prenom: propositionActive.candidat.user.firstName,
                nom: propositionActive.candidat.user.lastName,
                avatarUrl: propositionActive.candidat.user.avatarUrl,
              },
              expiresAt: propositionActive.expiresAt,
              proposedAt: propositionActive.proposedAt,
            }
          : null,
        remplacant: remplacant
          ? {
              prenom: remplacant.collaborateur.user.firstName,
              nom: remplacant.collaborateur.user.lastName,
              avatarUrl: remplacant.collaborateur.user.avatarUrl,
            }
          : null,
        propositionsRefusees: aff.propositions.filter(
          (p) => p.status === 'REFUSEE' || p.status === 'EXPIREE'
        ).length,
      }
    })

    return NextResponse.json({
      projetId: params.id,
      projetTitre: projet.title,
      remplacements,
      stats: {
        total: remplacements.length,
        nonPourvus: remplacements.filter((r) => r.statut === 'NON_POURVU').length,
        enAttente: remplacements.filter((r) => r.statut === 'EN_ATTENTE_REPONSE').length,
        resolus: remplacements.filter((r) => r.statut === 'REMPLACE').length,
      },
    })
  } catch (err) {
    console.error('[GET /api/projets/[id]/remplacements]', err)
    return internalError()
  }
}
