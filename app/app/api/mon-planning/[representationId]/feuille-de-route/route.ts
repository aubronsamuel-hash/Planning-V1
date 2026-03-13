// ─────────────────────────────────────────────────────────
// GET /api/mon-planning/[representationId]/feuille-de-route
// Vue mobile collaborateur — retourne la FDR si PUBLIEE
// + données personnelles de l'affectation du user connecté
// doc/11 §11.1
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError, notFound } from '@/lib/api-response'

export async function GET(
  req: Request,
  { params }: { params: { representationId: string } }
) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const orgId = session.user.organizationId!

    // Vérifier que la représentation appartient à l'org
    const rep = await prisma.representation.findFirst({
      where: { id: params.representationId },
      include: { projet: { select: { id: true, title: true, organizationId: true, colorCode: true } } },
    })
    if (!rep) return notFound('Représentation')
    if (rep.projet.organizationId !== orgId) {
      return NextResponse.json({ error: 'Accès refusé', code: 'FORBIDDEN' }, { status: 403 })
    }

    // Récupérer la FDR — seulement si PUBLIEE
    const fdr = await prisma.feuilleDeRoute.findUnique({
      where: { representationId: params.representationId },
      include: {
        phases:   { orderBy: { ordre: 'asc' } },
        contacts: { orderBy: [{ type: 'asc' }, { nom: 'asc' }] },
      },
    })

    // Récupérer l'affectation personnelle du collaborateur connecté
    const collaborateur = await prisma.collaborateur.findFirst({
      where: { userId: session.user.id },
    })

    let monAffectation = null
    if (collaborateur) {
      monAffectation = await prisma.affectation.findFirst({
        where: {
          representationId: params.representationId,
          collaborateurId: collaborateur.id,
          confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE'] },
        },
        include: {
          posteRequis: { select: { name: true } },
        },
      })
    }

    return NextResponse.json({
      representation: {
        id: rep.id,
        date: rep.date.toISOString(),
        venueName: rep.venueName,
        venueCity: rep.venueCity,
        venueAddress: rep.venueAddress,
        venueLatLng: rep.venueLatLng,
        showStartTime: rep.showStartTime,
        showEndTime: rep.showEndTime,
      },
      projet: {
        id: rep.projet.id,
        title: rep.projet.title,
        colorCode: rep.projet.colorCode,
      },
      fdr: fdr?.statut === 'PUBLIEE' || fdr?.statut === 'ARCHIVEE' ? fdr : null,
      nonDisponible: !fdr || fdr.statut === 'BROUILLON',
      monAffectation: monAffectation
        ? {
            startTime: monAffectation.startTime,
            endTime: monAffectation.endTime,
            poste: monAffectation.posteRequis.name,
            contractTypeUsed: monAffectation.contractTypeUsed,
            confirmationStatus: monAffectation.confirmationStatus,
            remuneration: monAffectation.remuneration,
          }
        : null,
    })
  } catch (err) {
    console.error('[GET /api/mon-planning/[representationId]/feuille-de-route]', err)
    return internalError()
  }
}
