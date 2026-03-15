// ─────────────────────────────────────────────────────────
// Page /equipe — Annuaire de l'organisation
// doc/07 §7.1 — Server Component
// ─────────────────────────────────────────────────────────
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { EquipeClient } from './EquipeClient'

export default async function EquipePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const orgRole = session.user.organizationRole
  const organizationId = session.user.organizationId!

  // Seuls DIRECTEUR, REGISSEUR, RH accèdent à /equipe
  if (orgRole === 'COLLABORATEUR') redirect('/dashboard')

  // Liste des projets actifs pour le filtre
  const projets = await prisma.projet.findMany({
    where: {
      organizationId,
      status: { in: ['EN_PREPARATION', 'EN_COURS'] },
      deletedAt: null,
    },
    select: { id: true, title: true, colorCode: true },
    orderBy: { title: 'asc' },
  })

  // orgRole est forcément DIRECTEUR | REGISSEUR | RH ici (COLLABORATEUR redirigé plus haut)
  return <EquipeClient projets={projets} canInvite={orgRole != null} />
}
