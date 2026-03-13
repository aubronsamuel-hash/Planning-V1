// ─────────────────────────────────────────────────────────
// GET /api/admin/organisations/[id] — Fiche organisation complète
// doc/23-architecture-technique.md §23.1
// Accès : SUPER_ADMIN uniquement
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth'
import { internalError, notFound } from '@/lib/api-response'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { session, error } = await requireSuperAdmin()
    if (error) return error

    void session // auth confirmée

    const { id } = params

    const organization = await prisma.organization.findUnique({
      where: { id, deletedAt: null },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        },
        activityLogs: {
          include: {
            organization: {
              select: { name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            projets: true,
            affectations: true,
          },
        },
      },
    })

    if (!organization) return notFound('Organisation')

    return NextResponse.json(organization)
  } catch (err) {
    console.error('[GET /api/admin/organisations/[id]]', err)
    return internalError()
  }
}
