// ─────────────────────────────────────────────────────────
// GET /api/mon-planning — Planning personnel du collaborateur connecté
// doc/04 §6.5 — Affectations du user session
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError } from '@/lib/api-response'

export async function GET(req: Request) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const organizationId = session.user.organizationId!
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') // 'YYYY-MM', optionnel

    // Trouver le collaborateur de l'user dans cette org
    const collab = await prisma.collaborateur.findFirst({
      where: { userId: session.user.id, organizationId },
    })
    if (!collab) return NextResponse.json({ affectations: [], remunerationMois: 0 })

    // Construire le filtre date
    let dateFilter: Record<string, unknown> = {}
    if (month) {
      const [y, m] = month.split('-').map(Number)
      dateFilter = {
        gte: new Date(y, m - 1, 1),
        lt:  new Date(y, m, 1),
      }
    }

    const affectations = await prisma.affectation.findMany({
      where: {
        collaborateurId: collab.id,
        deletedAt: null,
        ...(month ? { representation: { date: dateFilter } } : {}),
      },
      include: {
        representation: {
          include: {
            projet: { select: { id: true, title: true, colorCode: true } },
          },
        },
        posteRequis: { select: { name: true } },
      },
      orderBy: { representation: { date: 'asc' } },
    })

    // Calcul rémunération du mois (ou total si pas de filtre)
    const remunerationMois = affectations.reduce((sum, a) => sum + (a.remuneration ?? 0), 0)

    // En attente de confirmation
    const enAttente = affectations.filter((a) => a.confirmationStatus === 'EN_ATTENTE').length

    const result = affectations.map((a) => ({
      id: a.id,
      date: a.representation.date.toISOString(),
      showStartTime: a.representation.showStartTime,
      venueName: a.representation.venueName,
      venueCity: a.representation.venueCity,
      projetId: a.representation.projet.id,
      projetTitle: a.representation.projet.title,
      projetColorCode: a.representation.projet.colorCode,
      poste: a.posteRequis.name,
      contractTypeUsed: a.contractTypeUsed,
      confirmationStatus: a.confirmationStatus,
      startTime: a.startTime,
      endTime: a.endTime,
      remuneration: a.remuneration,
      hasConflict: a.hasConflict,
    }))

    return NextResponse.json({ affectations: result, remunerationMois, enAttente })
  } catch (err) {
    console.error('[GET /api/mon-planning]', err)
    return internalError()
  }
}
