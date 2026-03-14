// ─────────────────────────────────────────────────────────
// GET /api/projets/[id]/annulations/export
// Export CSV des annulations du projet (RH/Directeur)
// Colonnes : nom, prénom, contrat, poste, date_repré, cachet_prévu, dpae_status, décision_cachet
// doc §12.6
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { internalError, notFound, forbidden } from '@/lib/api-response'

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

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
      select: { id: true, organizationId: true, title: true },
    })

    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

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
          select: { date: true, venueName: true, venueCity: true, annulationReason: true },
        },
        dpae: {
          select: { status: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ representation: { date: 'asc' } }],
    })

    const lignes = affectations.map((aff) => {
      const dpaeStatus = aff.dpae[0]?.status ?? null
      const dpaeLabel =
        dpaeStatus === 'ENVOYEE'
          ? 'Soumise'
          : dpaeStatus === 'CONFIRMEE'
          ? 'Confirmée'
          : dpaeStatus === 'A_FAIRE'
          ? 'À faire'
          : 'Non soumise'

      const cachetDecision =
        aff.cachetAnnulation === 'DU'
          ? 'Cachet dû'
          : aff.cachetAnnulation === 'ANNULE'
          ? 'Cachet annulé'
          : aff.cachetAnnulation === 'A_DECIDER'
          ? 'À décider'
          : '—'

      const typeAnnulation =
        aff.confirmationStatus === 'ANNULEE_TARDIVE' ? 'Tardive (≤48h)' : 'Simple'

      return [
        escapeCsv(aff.collaborateur.user.lastName),
        escapeCsv(aff.collaborateur.user.firstName),
        escapeCsv(aff.collaborateur.contractType),
        escapeCsv(aff.posteRequis.name),
        escapeCsv(formatDate(aff.representation.date)),
        escapeCsv(aff.representation.venueName),
        escapeCsv(aff.representation.venueCity),
        escapeCsv(aff.cachet != null ? `${aff.cachet.toFixed(2)} €` : '—'),
        escapeCsv(dpaeLabel),
        escapeCsv(typeAnnulation),
        escapeCsv(cachetDecision),
        escapeCsv(aff.annulationRaison),
        escapeCsv(aff.representation.annulationReason),
      ].join(',')
    })

    const header = [
      'Nom',
      'Prénom',
      'Type contrat',
      'Poste',
      'Date représentation',
      'Salle',
      'Ville',
      'Cachet prévu',
      'Statut DPAE',
      'Type annulation',
      'Décision cachet',
      'Raison désistement',
      'Raison annulation',
    ].join(',')

    const csv = [header, ...lignes].join('\n')
    const filename = `annulations-${projet.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[GET /api/projets/[id]/annulations/export]', err)
    return internalError()
  }
}
