// ─────────────────────────────────────────────────────────
// Page gestion de flotte — /settings/organisation/flotte
// doc/19-module-tournee.md §19.2 — DIRECTEUR + plan ENTERPRISE
// ─────────────────────────────────────────────────────────
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { hasFeature } from '@/lib/plans'
import { FlotteClient } from './FlotteClient'

export default async function FlottePage() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user.organizationId) redirect('/login')

  const orgId = session.user.organizationId
  const orgRole = session.user.organizationRole

  // DIRECTEUR uniquement pour gérer la flotte
  if (orgRole !== 'DIRECTEUR') redirect('/dashboard')

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  })

  // Module Tournée = ENTERPRISE uniquement
  if (!org || !hasFeature(org.plan, 'moduleTournee')) {
    redirect('/settings/organisation?upgrade=moduleTournee')
  }

  // Charger les véhicules actifs + conducteurs potentiels (avec permis)
  const [vehicules, conducteurs] = await Promise.all([
    prisma.vehicule.findMany({
      where: { organizationId: orgId, actif: true },
      include: {
        conducteurHabituel: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { label: 'asc' },
    }),
    prisma.collaborateur.findMany({
      where: {
        permisConduire: true,
        user: { memberships: { some: { organizationId: orgId, joinedAt: { not: null } } } },
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { user: { firstName: 'asc' } },
    }),
  ])

  return (
    <FlotteClient
      organisationId={orgId}
      vehiculesInitiaux={vehicules.map((v) => ({
        id: v.id,
        label: v.label,
        type: v.type,
        immatriculation: v.immatriculation,
        capacitePersonnes: v.capacitePersonnes,
        capaciteChargement: v.capaciteChargement,
        actif: v.actif,
        conducteurHabituel: v.conducteurHabituel
          ? { id: v.conducteurHabituel.id, user: v.conducteurHabituel.user }
          : null,
      }))}
      conducteursDisponibles={conducteurs.map((c) => ({
        id: c.id,
        user: c.user,
      }))}
    />
  )
}
