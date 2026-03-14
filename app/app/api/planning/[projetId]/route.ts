// ─────────────────────────────────────────────────────────
// GET /api/planning/[projetId] — Grille d'affectation d'un projet
// Retourne les données pour la vue régisseur (grille colonnes=reprs, lignes=postes)
// doc/04 §6.3 · doc/06 Règle #33 (statut visuel)
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { internalError, notFound } from '@/lib/api-response'
import logger from '@/lib/logger'

export async function GET(req: Request, { params }: { params: { projetId: string } }) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const projet = await prisma.projet.findFirst({
      where: { id: params.projetId },
    })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') // "2026-03"
    const equipeId = searchParams.get('equipeId') // filtre par équipe

    let dateFilter = {}
    if (month) {
      const [y, m] = month.split('-').map(Number)
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m, 0)
      dateFilter = { date: { gte: start, lte: end } }
    }

    // Récupérer les représentations du projet
    const representations = await prisma.representation.findMany({
      where: { projetId: params.projetId, status: { notIn: ['ANNULEE', 'REPORTEE'] }, ...dateFilter },
      orderBy: { date: 'asc' },
    })

    // Récupérer les équipes et leurs postes
    const equipes = await prisma.equipe.findMany({
      where: {
        projetId: params.projetId,
        ...(equipeId ? { id: equipeId } : {}),
      },
      include: {
        membres: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        postesRequis: true,
      },
      orderBy: { id: 'asc' },
    })

    // Récupérer toutes les affectations pour ces représentations
    const representationIds = representations.map(r => r.id)
    const affectations = await prisma.affectation.findMany({
      where: {
        representationId: { in: representationIds },
        confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE'] },
      },
      include: {
        collaborateur: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        posteRequis: { select: { id: true, isCritique: true, requiredCount: true } },
      },
    })

    // Construire l'index des affectations par [representationId][posteRequisId]
    type AffectationData = {
      id: string
      collaborateurId: string
      confirmationStatus: string
      contractTypeUsed: string
      startTime: string
      endTime: string
      hasConflict: boolean
      dpaeStatus: string
      collaborateur: {
        user: { id: string; firstName: string; lastName: string; avatarUrl: string | null }
      }
    }
    const affectationsIndex = new Map<string, AffectationData[]>()

    for (const aff of affectations) {
      const key = `${aff.representationId}:${aff.posteRequisId}`
      if (!affectationsIndex.has(key)) affectationsIndex.set(key, [])
      affectationsIndex.get(key)!.push({
        id: aff.id,
        collaborateurId: aff.collaborateurId,
        confirmationStatus: aff.confirmationStatus,
        contractTypeUsed: aff.contractTypeUsed,
        startTime: aff.startTime,
        endTime: aff.endTime,
        hasConflict: aff.hasConflict,
        dpaeStatus: aff.dpaeStatus,
        collaborateur: {
          user: aff.collaborateur.user,
        },
      })
    }

    // Construire la réponse grille
    const grilleEquipes = equipes.map(equipe => ({
      id: equipe.id,
      name: equipe.name,
      icon: equipe.icon,
      color: equipe.color,
      chef: equipe.membres.find(m => m.role === 'CHEF')?.user ?? null,
      postes: equipe.postesRequis.map(poste => ({
        id: poste.id,
        name: poste.name,
        requiredCount: poste.requiredCount,
        isCritique: poste.isCritique,
        contractTypePreference: poste.contractTypePreference,
        defaultStartTime: poste.defaultStartTime,
        defaultEndTime: poste.defaultEndTime,
        // Cellules par représentation
        cellules: representations.map(rep => {
          const key = `${rep.id}:${poste.id}`
          const affs = affectationsIndex.get(key) ?? []
          const manquants = Math.max(0, poste.requiredCount - affs.length)

          return {
            representationId: rep.id,
            affectations: affs,
            manquants,
            statut: affs.length >= poste.requiredCount
              ? 'COMPLET'
              : poste.isCritique
                ? 'CRITIQUE'
                : 'INCOMPLET',
          }
        }),
      })),
    }))

    return NextResponse.json({
      projetId: params.projetId,
      representations: representations.map(r => ({
        id: r.id,
        date: r.date,
        type: r.type,
        status: r.status,
        showStartTime: r.showStartTime,
        venueName: r.venueName,
        venueCity: r.venueCity,
      })),
      equipes: grilleEquipes,
    })
  } catch (err) {
    void logger.error('GET /api/planning/[projetId]', err, { route: 'GET /api/planning/[projetId]' })
    return internalError()
  }
}
