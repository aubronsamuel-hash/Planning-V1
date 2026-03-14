// ─────────────────────────────────────────────────────────
// GET /api/rh/export-csv — Export paie CSV (Règle #11)
// doc/06 Règle #11 — colonnes définies, séparateur point-virgule
// Auth : minRole RH — guard plan exportCsv
// ─────────────────────────────────────────────────────────
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError, forbidden } from '@/lib/api-response'
import { hasFeature } from '@/lib/plans'
import { decrypt, maskSocialSecurityNumber } from '@/lib/crypto'
import type { OrganizationPlan } from '@prisma/client'
import logger from '@/lib/logger'

export async function GET(req: Request) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'RH' })
    if (error) return error

    const organizationId = session.user.organizationId!
    const plan = session.user.organizationPlan as OrganizationPlan

    // Guard plan — exportCsv disponible à partir du plan PRO
    if (!hasFeature(plan, 'exportCsv')) {
      return forbidden(
        'Export CSV disponible à partir du plan PRO. Passez au plan supérieur sur /settings/organisation#facturation'
      )
    }

    // Paramètres optionnels de filtre
    const { searchParams } = new URL(req.url)
    const projetIdParam = searchParams.get('projetId')
    const dateFromParam = searchParams.get('dateFrom')
    const dateToParam   = searchParams.get('dateTo')

    // Construire les filtres de date
    const dateFilter: Record<string, Date> = {}
    if (dateFromParam) {
      const d = new Date(dateFromParam)
      if (!isNaN(d.getTime())) dateFilter.gte = d
    }
    if (dateToParam) {
      const d = new Date(dateToParam)
      if (!isNaN(d.getTime())) dateFilter.lte = d
    }

    // Récupérer les affectations éligibles DPAE (CDD + INTERMITTENT uniquement)
    const affectations = await prisma.affectation.findMany({
      where: {
        contractTypeUsed: { in: ['CDD', 'INTERMITTENT'] },
        dpaeStatus: { in: ['A_FAIRE', 'ENVOYEE', 'CONFIRMEE'] },
        representation: {
          projet: { organizationId },
          ...(projetIdParam ? { projetId: projetIdParam } : {}),
          ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
        },
      },
      include: {
        collaborateur: {
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
        },
        representation: {
          select: {
            date: true,
            projet: { select: { title: true } },
          },
        },
        posteRequis: { select: { name: true } },
      },
      orderBy: [
        { representation: { date: 'asc' } },
        { collaborateur: { user: { lastName: 'asc' } } },
      ],
    })

    // ── Construire le CSV ─────────────────────────────────────
    const BOM = '\uFEFF'  // UTF-8 BOM pour compatibilité Excel FR
    const SEP = ';'

    // En-tête (Règle #11)
    const headers = [
      'Nom',
      'Prénom',
      'N°SS (masqué)',
      'Type contrat',
      'Date représentation',
      'Projet',
      'Poste',
      'Cachet HT',
      'Statut DPAE',
    ]

    const escapeCell = (value: string | number | null | undefined): string => {
      if (value === null || value === undefined) return ''
      const str = String(value)
      // Échapper les guillemets et encadrer si nécessaire
      if (str.includes(SEP) || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const DPAE_STATUS_LABELS: Record<string, string> = {
      A_FAIRE:   'À faire',
      ENVOYEE:   'Envoyée',
      CONFIRMEE: 'Confirmée',
    }

    const CONTRACT_LABELS: Record<string, string> = {
      CDI:          'CDI',
      CDD:          'CDD',
      INTERMITTENT: 'Intermittent',
    }

    const rows: string[] = affectations.map((a) => {
      const { collaborateur } = a
      const user = collaborateur.user

      // N°SS : déchiffrer si disponible puis masquer (Règle #9 — visible RH)
      let noss = 'N/A'
      if (collaborateur.socialSecurityNumber) {
        try {
          const decrypted = decrypt(collaborateur.socialSecurityNumber)
          noss = maskSocialSecurityNumber(decrypted)
        } catch {
          noss = 'ERREUR'
        }
      }

      // Cachet HT en euros (centimes / 100)
      const cachetEuros =
        a.remuneration !== null && a.remuneration !== undefined
          ? (a.remuneration / 100).toFixed(2).replace('.', ',') + ' €'
          : 'N/A'

      const dateRep = a.representation.date.toLocaleDateString('fr-FR')
      const dpaeLabel = DPAE_STATUS_LABELS[a.dpaeStatus] ?? a.dpaeStatus
      const contractLabel = CONTRACT_LABELS[a.contractTypeUsed] ?? a.contractTypeUsed

      const cells = [
        user.lastName,
        user.firstName,
        noss,
        contractLabel,
        dateRep,
        a.representation.projet.title,
        a.posteRequis.name,
        cachetEuros,
        dpaeLabel,
      ]

      return cells.map(escapeCell).join(SEP)
    })

    const csvContent =
      BOM +
      headers.map(escapeCell).join(SEP) +
      '\r\n' +
      rows.join('\r\n')

    // Nom du fichier avec la date du jour
    const today = new Date().toISOString().slice(0, 10)
    const filename = `export-paie-${today}.csv`

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    void logger.error('GET /api/rh/export-csv', err, { route: 'GET /api/rh/export-csv' })
    return internalError()
  }
}
