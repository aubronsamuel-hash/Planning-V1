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
import logger from '@/lib/logger'

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
    let monHebergement = null
    let monTransport = null

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

      // Hébergement (§19.1.6) — chercher la chambre pour la nuit de cette représentation
      const chambreOccupant = await prisma.chambreOccupant.findFirst({
        where: {
          collaborateurId: collaborateur.id,
          nuitDu: rep.date,
          chambre: { hebergement: { projetId: rep.projet.id } },
        },
        include: {
          chambre: { include: { hebergement: true } },
        },
      })
      if (chambreOccupant) {
        const h = chambreOccupant.chambre.hebergement
        monHebergement = {
          nomHotel: h.nom,
          adresse: h.adresse,
          ville: h.ville,
          telephone: h.telephone,
          chambreNumero: chambreOccupant.chambre.numero,
          chambreType: chambreOccupant.chambre.type,
          checkIn: h.checkIn.toISOString(),
          checkOut: h.checkOut.toISOString(),
        }
      }

      // Transport (§19.2.5) — véhicule assigné pour cette représentation
      const vehiculePassager = await prisma.vehiculePassager.findFirst({
        where: {
          collaborateurId: collaborateur.id,
          vehiculeAssignment: { representationId: params.representationId },
        },
        include: {
          vehiculeAssignment: {
            include: {
              vehicule: { select: { label: true, type: true } },
              passagers: {
                where: { role: 'CONDUCTEUR' },
                include: {
                  collaborateur: {
                    include: { user: { select: { firstName: true, lastName: true, phone: true } } },
                  },
                },
              },
            },
          },
        },
      })
      if (vehiculePassager) {
        const va = vehiculePassager.vehiculeAssignment
        const conducteurPassager = va.passagers[0]
        monTransport = {
          role: vehiculePassager.role,
          vehicule: va.vehicule,
          departLieu: va.departLieu,
          departTime: va.departTime,
          arriveeEstimeeTime: va.arriveeEstimeeTime,
          notes: va.notes,
          conducteur: conducteurPassager
            ? {
                nom: `${conducteurPassager.collaborateur.user.firstName} ${conducteurPassager.collaborateur.user.lastName}`,
                telephone: conducteurPassager.collaborateur.user.phone,
              }
            : null,
        }
      }
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
      monHebergement,
      monTransport,
    })
  } catch (err) {
    void logger.error('GET /api/mon-planning/[representationId]/feuille-de-route', err, { route: 'GET /api/mon-planning/[representationId]/feuille-de-route' })
    return internalError()
  }
}
