// ─────────────────────────────────────────────────────────
// GET  /api/projets/[id]/annulations
// Liste les affectations annulées du projet + statuts cachets
// doc §12.6 — Page RH suivi des annulations
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { internalError, notFound, forbidden } from '@/lib/api-response'
import logger from '@/lib/logger'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'RH' })
    if (error) return error

    const roleOrg = session.user.organizationRole
    if (roleOrg !== 'RH' && roleOrg !== 'DIRECTEUR') {
      return forbidden('Accès réservé au RH et au Directeur.')
    }

    const projet = await prisma.projet.findFirst({
      where: { id: params.id, deletedAt: null },
    })

    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    // Affectations annulées (ANNULEE ou ANNULEE_TARDIVE) — Règle §12.6
    const affectations = await prisma.affectation.findMany({
      where: {
        representation: { projetId: params.id },
        confirmationStatus: { in: ['ANNULEE', 'ANNULEE_TARDIVE'] },
      },
      include: {
        collaborateur: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        posteRequis: { select: { name: true } },
        representation: {
          select: {
            id: true,
            date: true,
            venueName: true,
            venueCity: true,
            status: true,
            annulationReason: true,
            annulationAt: true,
          },
        },
        dpae: {
          select: { status: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [
        { representation: { date: 'asc' } },
        { collaborateur: { user: { lastName: 'asc' } } },
      ],
    })

    // Grouper par représentation
    const parRepresentation = new Map<
      string,
      {
        representationId: string
        date: Date
        venueName: string | null
        venueCity: string | null
        annulationReason: string | null
        annulationAt: Date | null
        affectations: typeof affectations
      }
    >()

    for (const aff of affectations) {
      const repId = aff.representationId
      if (!parRepresentation.has(repId)) {
        parRepresentation.set(repId, {
          representationId: repId,
          date: aff.representation.date,
          venueName: aff.representation.venueName,
          venueCity: aff.representation.venueCity,
          annulationReason: aff.representation.annulationReason,
          annulationAt: aff.representation.annulationAt,
          affectations: [],
        })
      }
      parRepresentation.get(repId)!.affectations.push(aff)
    }

    // Compter total cachets A_DECIDER
    const totalCachetsADecider = affectations
      .filter((a) => a.cachetAnnulation === 'A_DECIDER' && a.cachet)
      .reduce((sum, a) => sum + (a.cachet ?? 0), 0)

    const result = Array.from(parRepresentation.values()).map((rep) => ({
      representationId: rep.representationId,
      date: rep.date,
      venueName: rep.venueName,
      venueCity: rep.venueCity,
      annulationReason: rep.annulationReason,
      annulationAt: rep.annulationAt,
      affectations: rep.affectations.map((aff) => ({
        id: aff.id,
        collaborateur: {
          nom: `${aff.collaborateur.user.lastName} ${aff.collaborateur.user.firstName}`,
          prenom: aff.collaborateur.user.firstName,
        },
        contractType: aff.collaborateur.contractType,
        poste: aff.posteRequis.name,
        cachet: aff.cachet,
        confirmationStatus: aff.confirmationStatus,
        cachetAnnulation: aff.cachetAnnulation,
        annulationRaison: aff.annulationRaison,
        annulationDate: aff.annulationDate,
        dpaeStatus: aff.dpae[0]?.status ?? null,
      })),
    }))

    return NextResponse.json({
      annulations: result,
      totalCachetsADecider,
    })
  } catch (err) {
    void logger.error('GET /api/projets/[id]/annulations', err, { route: 'GET /api/projets/[id]/annulations' })
    return internalError()
  }
}
