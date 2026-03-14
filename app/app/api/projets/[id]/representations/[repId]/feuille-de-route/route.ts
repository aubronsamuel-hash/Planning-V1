// ─────────────────────────────────────────────────────────
// GET  /api/projets/[id]/representations/[repId]/feuille-de-route
// Retourne la feuille de route (crée si inexistante — BROUILLON)
// Pré-remplit la phase REPRESENTATION depuis showStartTime/showEndTime (§11.3)
// doc/11-feuille-de-route-logistique.md
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError, notFound } from '@/lib/api-response'
import logger from '@/lib/logger'

export async function GET(
  req: Request,
  { params }: { params: { id: string; repId: string } }
) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR' })
    if (error) return error

    const orgId = session.user.organizationId!

    // Vérifier ownership projet → org
    const projet = await prisma.projet.findFirst({
      where: { id: params.id, organizationId: orgId },
      select: { id: true, title: true, colorCode: true },
    })
    if (!projet) return notFound('Projet')

    const rep = await prisma.representation.findFirst({
      where: { id: params.repId, projetId: params.id },
      select: {
        id: true,
        date: true,
        showStartTime: true,
        showEndTime: true,
        venueName: true,
        venueCity: true,
        venueAddress: true,
        venueLatLng: true,
        type: true,
        status: true,
      },
    })
    if (!rep) return notFound('Représentation')

    // Chercher FDR existante
    let fdr = await prisma.feuilleDeRoute.findUnique({
      where: { representationId: params.repId },
      include: {
        phases: { orderBy: { ordre: 'asc' } },
        contacts: { orderBy: [{ type: 'asc' }, { nom: 'asc' }] },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    })

    if (!fdr) {
      // Créer une FDR vide en BROUILLON
      // Pré-remplir la phase REPRESENTATION si showStartTime existe (§11.3)
      fdr = await prisma.feuilleDeRoute.create({
        data: {
          representationId: params.repId,
          createdById: session.user.id,
          statut: 'BROUILLON',
          phases: rep.showStartTime
            ? {
                create: {
                  ordre: 1,
                  type: 'REPRESENTATION',
                  startTime: rep.showStartTime,
                  endTime: rep.showEndTime ?? undefined,
                },
              }
            : undefined,
        },
        include: {
          phases: { orderBy: { ordre: 'asc' } },
          contacts: { orderBy: [{ type: 'asc' }, { nom: 'asc' }] },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      })
    }

    // Récupérer l'équipe affectée à cette représentation
    const affectations = await prisma.affectation.findMany({
      where: {
        representationId: params.repId,
        confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE'] },
      },
      include: {
        collaborateur: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        posteRequis: {
          include: { equipe: { select: { id: true, name: true, icon: true } } },
        },
      },
      orderBy: { posteRequis: { equipe: { name: 'asc' } } },
    })

    return NextResponse.json({
      fdr,
      representation: {
        ...rep,
        date: rep.date.toISOString(),
      },
      projet: {
        id: projet.id,
        title: projet.title,
        colorCode: projet.colorCode,
      },
      affectations: affectations.map((a) => ({
        id: a.id,
        startTime: a.startTime,
        endTime: a.endTime,
        confirmationStatus: a.confirmationStatus,
        contractTypeUsed: a.contractTypeUsed,
        collaborateur: {
          id: a.collaborateur.id,
          nom: `${a.collaborateur.user.firstName} ${a.collaborateur.user.lastName}`,
          avatarUrl: a.collaborateur.user.avatarUrl,
        },
        poste: a.posteRequis.name,
        equipe: {
          id: a.posteRequis.equipe.id,
          name: a.posteRequis.equipe.name,
          icon: a.posteRequis.equipe.icon,
        },
      })),
    })
  } catch (err) {
    void logger.error('GET /api/projets/[id]/representations/[repId]/feuille-de-route', err, { route: 'GET /api/projets/[id]/representations/[repId]/feuille-de-route' })
    return internalError()
  }
}
