// ─────────────────────────────────────────────────────────
// GET /api/admin/stats — Statistiques globales (dashboard admin)
// doc/23-architecture-technique.md §23.1
// Accès : SUPER_ADMIN uniquement
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth'
import { internalError } from '@/lib/api-response'
import logger from '@/lib/logger'

// MRR mensuel par plan (en centimes)
const MRR_PAR_PLAN: Record<string, number> = {
  FREE: 0,
  PRO: 4900,
  ENTERPRISE: 14900,
}

export async function GET(_req: Request) {
  try {
    const { session, error } = await requireSuperAdmin()
    if (error) return error

    void session // auth confirmée

    const now = new Date()
    const il_y_a_30j = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalOrgs,
      orgsByPlanRaw,
      totalUsers,
      newOrgs30d,
      orgsIsReadOnly,
      orgsPaymentFailed,
    ] = await Promise.all([
      // Nombre total d'organisations actives
      prisma.organization.count({
        where: {},
      }),

      // Répartition par plan
      prisma.organization.groupBy({
        by: ['plan'],
        where: {},
        _count: { id: true },
      }),

      // Nombre total d'utilisateurs (MEMBER uniquement)
      prisma.user.count({
        where: { role: 'MEMBER' },
      }),

      // 5 dernières orgs créées
      prisma.organization.findMany({
        where: {},
        select: { id: true, name: true, plan: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),

      // Orgs en lecture seule (alerte)
      prisma.organization.count({
        where: { isReadOnly: true },
      }),

      // Orgs avec paiement échoué (alerte)
      prisma.organization.count({
        where: { paymentFailedAt: { not: null } },
      }),
    ])

    // Active users 30j — champ lastLoginAt optionnel sur User
    let activeUsers30d = 0
    try {
      activeUsers30d = await (prisma.user as any).count({
        where: {
          role: 'MEMBER',
          lastLoginAt: { gte: il_y_a_30j },
        },
      })
    } catch {
      // lastLoginAt n'existe pas dans le schéma → retourner 0
      activeUsers30d = 0
    }

    // Construire orgsByPlan : { FREE: N, PRO: N, ENTERPRISE: N }
    const orgsByPlan: Record<string, number> = { FREE: 0, PRO: 0, ENTERPRISE: 0 }
    for (const row of orgsByPlanRaw) {
      orgsByPlan[row.plan] = row._count.id
    }

    // Calculer le MRR
    const mrr =
      (orgsByPlan['FREE'] ?? 0) * MRR_PAR_PLAN['FREE'] +
      (orgsByPlan['PRO'] ?? 0) * MRR_PAR_PLAN['PRO'] +
      (orgsByPlan['ENTERPRISE'] ?? 0) * MRR_PAR_PLAN['ENTERPRISE']

    return NextResponse.json({
      totalOrgs,
      orgsByPlan,
      totalUsers,
      activeUsers30d,
      mrr,
      newOrgs30d,
      alertes: {
        orgsIsReadOnly,
        orgsPaymentFailed,
      },
    })
  } catch (err) {
    void logger.error('GET /api/admin/stats', err, { route: 'GET /api/admin/stats' })
    return internalError()
  }
}
