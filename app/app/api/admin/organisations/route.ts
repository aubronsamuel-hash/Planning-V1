// ─────────────────────────────────────────────────────────
// GET /api/admin/organisations — Liste des organisations (back-office)
// doc/23-architecture-technique.md §23.1
// Accès : SUPER_ADMIN uniquement
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth'
import { internalError } from '@/lib/api-response'
import type { OrganizationPlan } from '@prisma/client'

export async function GET(req: Request) {
  try {
    const { session, error } = await requireSuperAdmin()
    if (error) return error

    void session // auth confirmée

    const { searchParams } = new URL(req.url)
    const plan = searchParams.get('plan') as OrganizationPlan | null
    const search = searchParams.get('search') ?? ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit

    // Construction du filtre
    const where = {
      deletedAt: null,
      ...(plan ? { plan } : {}),
      ...(search
        ? {
            name: { contains: search, mode: 'insensitive' as const },
          }
        : {}),
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          plan: true,
          isReadOnly: true,
          suspendedAt: true,
          paymentFailedAt: true,
          createdAt: true,
          _count: {
            select: { memberships: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.organization.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      organizations,
      total,
      page,
      totalPages,
    })
  } catch (err) {
    console.error('[GET /api/admin/organisations]', err)
    return internalError()
  }
}
