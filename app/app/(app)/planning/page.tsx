// ─────────────────────────────────────────────────────────
// Planning global — /planning
// doc/04-pages-interfaces-ux.md §6.4
// Vue calendrier mois — toutes les représentations de l'org
// ─────────────────────────────────────────────────────────
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { PlanningClient } from './PlanningClient'

export default async function PlanningPage() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user.organizationId) redirect('/login')

  const orgRole = session.user.organizationRole
  if (orgRole === 'COLLABORATEUR') redirect('/mon-planning')

  const orgId = session.user.organizationId

  // Projets actifs pour le filtre
  const projets = await prisma.projet.findMany({
    where: {
      organizationId: orgId,
      status: { in: ['EN_PREPARATION', 'EN_COURS'] },
    },
    select: { id: true, title: true, colorCode: true },
    orderBy: { title: 'asc' },
  })

  return <PlanningClient projets={projets} />
}
