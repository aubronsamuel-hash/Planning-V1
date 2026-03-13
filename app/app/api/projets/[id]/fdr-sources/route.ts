// ─────────────────────────────────────────────────────────
// GET /api/projets/[id]/fdr-sources
// Retourne les représentations ayant une FDR PUBLIEE ou ARCHIVEE
// Utilisé par la modal "Copier depuis…" (§11.9.3)
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError, notFound } from '@/lib/api-response'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR' })
    if (error) return error

    const projet = await prisma.projet.findFirst({
      where: { id: params.id, organizationId: session.user.organizationId! },
      select: { id: true },
    })
    if (!projet) return notFound('Projet')

    const representations = await prisma.representation.findMany({
      where: {
        projetId: params.id,
        feuilleDeRoute: { statut: { in: ['PUBLIEE', 'ARCHIVEE'] } },
      },
      select: {
        id: true,
        date: true,
        venueName: true,
        venueCity: true,
        feuilleDeRoute: {
          select: {
            id: true,
            statut: true,
            transportInfo: true,
            _count: { select: { phases: true, contacts: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(
      representations.map((r) => ({
        id: r.id,
        date: r.date.toISOString(),
        venueName: r.venueName,
        venueCity: r.venueCity,
        feuilleDeRoute: r.feuilleDeRoute
          ? {
              id: r.feuilleDeRoute.id,
              statut: r.feuilleDeRoute.statut,
              transportInfo: r.feuilleDeRoute.transportInfo,
              phasesCount: r.feuilleDeRoute._count.phases,
              contactsCount: r.feuilleDeRoute._count.contacts,
            }
          : null,
      }))
    )
  } catch (err) {
    console.error('[GET /api/projets/[id]/fdr-sources]', err)
    return internalError()
  }
}
