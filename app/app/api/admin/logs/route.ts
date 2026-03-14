// ─────────────────────────────────────────────────────────
// GET /api/admin/logs — Logs d'activité filtrés (back-office)
// doc/23-architecture-technique.md §23.1
// Accès : SUPER_ADMIN uniquement
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth'
import { internalError } from '@/lib/api-response'
import logger from '@/lib/logger'

function getDateFrom(period: string | null): Date | null {
  const now = new Date()
  switch (period) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    default:
      // 'custom' ou null → pas de filtre par date
      return null
  }
}

export async function GET(req: Request) {
  try {
    const { session, error } = await requireSuperAdmin()
    if (error) return error

    void session // auth confirmée

    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const organizationId = searchParams.get('organizationId')
    const userId = searchParams.get('userId')
    const period = searchParams.get('period') ?? '7d'
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
    const skip = (page - 1) * limit

    const dateFrom = getDateFrom(period)

    const where = {
      ...(action ? { action } : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(userId ? { userId } : {}),
      ...(dateFrom ? { createdAt: { gte: dateFrom } } : {}),
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      logs,
      total,
      page,
      totalPages,
    })
  } catch (err) {
    void logger.error('GET /api/admin/logs', err, { route: 'GET /api/admin/logs' })
    return internalError()
  }
}
