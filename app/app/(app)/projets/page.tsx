// ─────────────────────────────────────────────────────────
// Liste des projets — /projets
// doc/04-pages-interfaces-ux.md §6.2
// Server Component : charge la liste initiale + membres pour le modal
// ─────────────────────────────────────────────────────────
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { ProjetsClient } from './ProjetsClient'

export default async function ProjetsPage() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user.organizationId) redirect('/login')

  const orgId = session.user.organizationId
  const orgRole = session.user.organizationRole
  const canCreate = orgRole === 'DIRECTEUR' || orgRole === 'REGISSEUR'

  // Charge les projets de l'org
  const projets = await prisma.projet.findMany({
    where: { organizationId: orgId },
    include: {
      _count: { select: { representations: true } },
      equipes: {
        include: { membres: true },
      },
      regisseur: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Membres pour le select "Régisseur" dans le modal création
  const membres = canCreate
    ? await prisma.organizationMembership.findMany({
        where: {
          organizationId: orgId,
          joinedAt: { not: null },
          role: { in: ['DIRECTEUR', 'REGISSEUR'] },
        },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { user: { firstName: 'asc' } },
      })
    : []

  // Sérialiser les données (les dates ne passent pas JSON brut en props)
  const projetsJson = projets.map((p) => ({
    id: p.id,
    title: p.title,
    subtitle: p.subtitle,
    type: p.type,
    status: p.status,
    colorCode: p.colorCode,
    startDate: p.startDate?.toISOString() ?? null,
    endDate: p.endDate?.toISOString() ?? null,
    posterUrl: p.posterUrl,
    regisseurId: p.regisseurId,
    regisseurNom: p.regisseur
      ? `${p.regisseur.firstName} ${p.regisseur.lastName.charAt(0)}.`
      : null,
    representationsCount: p._count.representations,
    collaborateursCount: new Set(p.equipes.flatMap((e) => e.membres.map((m) => m.userId))).size,
  }))

  const membresJson = membres.map((m) => ({
    userId: m.userId,
    nom: `${m.user.firstName} ${m.user.lastName}`,
  }))

  return (
    <ProjetsClient
      projets={projetsJson}
      membres={membresJson}
      canCreate={canCreate}
      currentUserId={session.user.id}
    />
  )
}
