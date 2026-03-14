// ─────────────────────────────────────────────────────────
// GET /api/projets/[id]/annulations
//   Liste les affectations annulées + statuts cachets pour RH
//   ?export=csv → export CSV
// doc/12-annulations-reports.md §12.6, §12.8
// Accès : RH minimum
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { internalError, notFound } from '@/lib/api-response'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'RH' })
    if (error) return error

    const projet = await prisma.projet.findFirst({
      where: { id: params.id, deletedAt: null },
      select: { id: true, organizationId: true, title: true },
    })

    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const { searchParams } = new URL(req.url)
    const exportCsv = searchParams.get('export') === 'csv'

    const affectations = await prisma.affectation.findMany({
      where: {
        representation: { projetId: params.id },
        confirmationStatus: { in: ['ANNULEE', 'ANNULEE_TARDIVE'] },
      },
      include: {
        collaborateur: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        posteRequis: { select: { name: true } },
        representation: {
          select: {
            id:   true,
            date: true,
            annulationReason: true,
            annulationAt:     true,
          },
        },
      },
      orderBy: [
        { representation: { date: 'asc' } },
        { collaborateur:  { user: { lastName: 'asc' } } },
      ],
    })

    if (exportCsv) {
      const rows = [
        ['nom', 'prénom', 'email', 'contrat', 'poste', 'date_repr', 'cachet_prévu', 'dpae_status', 'décision_cachet'].join(';'),
        ...affectations.map((a) => [
          a.collaborateur.user.lastName,
          a.collaborateur.user.firstName,
          a.collaborateur.user.email,
          a.contractTypeUsed ?? '',
          a.posteRequis.name,
          new Date(a.representation.date).toLocaleDateString('fr-FR'),
          a.remuneration != null ? (a.remuneration / 100).toFixed(2).replace('.', ',') : '',
          a.dpaeStatus ?? '',
          a.cachetAnnulation ?? 'A_DECIDER',
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')),
      ].join('\n')

      return new Response('\uFEFF' + rows, {
        headers: {
          'Content-Type':        'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="annulations-${projet.title.replace(/\s+/g, '-')}.csv"`,
        },
      })
    }

    // Regrouper par représentation
    const byRep: Record<string, {
      representationId: string
      date: Date
      annulationReason: string | null
      annulationAt: Date | null
      affectations: typeof affectations
    }> = {}

    for (const aff of affectations) {
      const repId = aff.representation.id
      if (!byRep[repId]) {
        byRep[repId] = {
          representationId: repId,
          date:             aff.representation.date,
          annulationReason: aff.representation.annulationReason,
          annulationAt:     aff.representation.annulationAt,
          affectations:     [],
        }
      }
      byRep[repId].affectations.push(aff)
    }

    // Calculs agrégés
    const totalADecider = affectations
      .filter((a) => a.cachetAnnulation === 'A_DECIDER' && a.remuneration != null)
      .reduce((sum, a) => sum + (a.remuneration ?? 0), 0)

    const nbDpaeSoumises = affectations.filter(
      (a) => a.dpaeStatus === 'ENVOYEE' || a.dpaeStatus === 'CONFIRMEE'
    ).length

    return NextResponse.json({
      projetId:        projet.id,
      projetTitle:     projet.title,
      representations: Object.values(byRep),
      totaux: {
        nbAffectations:  affectations.length,
        nbDpaeSoumises,
        totalADecider,   // en centimes
      },
    })
  } catch (err) {
    console.error('[GET /api/projets/[id]/annulations]', err)
    return internalError()
  }
}
