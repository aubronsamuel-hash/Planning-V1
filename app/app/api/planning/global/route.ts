// ─────────────────────────────────────────────────────────
// GET /api/planning/global — Planning global de l'organisation
// doc/04 §6.4 · doc/06 Règle #33 (statut visuel 🟢🟡🔴)
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError } from '@/lib/api-response'
import logger from '@/lib/logger'

export async function GET(req: Request) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'RH' })
    if (error) return error

    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') // "2026-03" — défaut : mois courant
    const projetId = searchParams.get('projetId') // filtre optionnel

    // Calculer le mois par défaut
    const now = new Date()
    const targetMonth = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const [y, m] = targetMonth.split('-').map(Number)
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0)

    const organizationId = session.user.organizationId!

    // Récupérer les projets actifs de l'org
    const projetsWhere = {
      organizationId,
      status: { in: ['EN_PREPARATION', 'EN_COURS'] as ('EN_PREPARATION' | 'EN_COURS')[] },
      ...(projetId ? { id: projetId } : {}),
    }

    const projets = await prisma.projet.findMany({
      where: projetsWhere,
      select: { id: true, title: true, colorCode: true, type: true },
    })

    const projetIds = projets.map(p => p.id)

    // Récupérer les représentations du mois pour ces projets
    const representations = await prisma.representation.findMany({
      where: {
        projetId: { in: projetIds },
        date: { gte: start, lte: end },
        status: { notIn: ['ANNULEE', 'REPORTEE'] },
      },
      include: {
        affectations: {
          where: {
            confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE', 'REFUSEE'] },
          },
          include: {
            posteRequis: { select: { isCritique: true, requiredCount: true } },
          },
        },
        projet: { select: { id: true, title: true, colorCode: true } },
        _count: { select: { affectations: true } },
      },
      orderBy: { date: 'asc' },
    })

    // Calculer le statut visuel pour chaque représentation (Règle #33)
    const reprsEnrichies = representations.map((rep) => {
      // Agréger les affectations par poste
      const postesMap = new Map<string, { isCritique: boolean; requiredCount: number; count: number }>()

      for (const aff of rep.affectations) {
        const key = aff.posteRequisId
        const existing = postesMap.get(key)
        if (existing) {
          existing.count++
        } else {
          postesMap.set(key, {
            isCritique: aff.posteRequis.isCritique,
            requiredCount: aff.posteRequis.requiredCount,
            count: 1,
          })
        }
      }

      // Récupérer tous les postes requis du projet pour cette équipe
      let hasPosteCritiqueManquant = false
      let hasPosteManquant = false
      let totalRequis = 0
      let totalPourvus = 0

      for (const [, poste] of postesMap) {
        totalRequis += poste.requiredCount
        totalPourvus += Math.min(poste.count, poste.requiredCount)

        if (poste.count < poste.requiredCount) {
          hasPosteManquant = true
          if (poste.isCritique) hasPosteCritiqueManquant = true
        }
      }

      const statutVisuel: 'VERT' | 'JAUNE' | 'ROUGE' = hasPosteCritiqueManquant
        ? 'ROUGE'
        : hasPosteManquant
          ? 'JAUNE'
          : 'VERT'

      return {
        id: rep.id,
        projetId: rep.projetId,
        projetTitle: rep.projet.title,
        projetColorCode: rep.projet.colorCode,
        date: rep.date,
        type: rep.type,
        status: rep.status,
        showStartTime: rep.showStartTime,
        showEndTime: rep.showEndTime,
        venueName: rep.venueName,
        venueCity: rep.venueCity,
        statutVisuel,
        hasPosteCritiqueManquant,
        totalRequis,
        totalPourvus,
      }
    })

    // Grouper par date pour la vue calendrier
    const parDate = new Map<string, typeof reprsEnrichies>()
    for (const rep of reprsEnrichies) {
      const dateKey = rep.date.toISOString().split('T')[0]
      if (!parDate.has(dateKey)) parDate.set(dateKey, [])
      parDate.get(dateKey)!.push(rep)
    }

    return NextResponse.json({
      month: targetMonth,
      projets,
      representations: reprsEnrichies,
      parDate: Object.fromEntries(parDate),
    })
  } catch (err) {
    void logger.error('GET /api/planning/global', err, { route: 'GET /api/planning/global' })
    return internalError()
  }
}
