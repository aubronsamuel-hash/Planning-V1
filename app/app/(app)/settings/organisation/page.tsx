// ─────────────────────────────────────────────────────────
// /settings/organisation — Paramètres organisation (DIRECTEUR uniquement)
// doc/04-pages-interfaces-ux.md · doc/02-roles-permissions.md
// ─────────────────────────────────────────────────────────
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import OrganisationSettingsClient from './OrganisationSettingsClient'

export default async function OrganisationSettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session || !session.user.organizationId) redirect('/login')
  if (session.user.organizationRole !== 'DIRECTEUR') redirect('/dashboard')

  const orgId = session.user.organizationId

  const [org, memberships] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        city: true,
        plan: true,
        isReadOnly: true,
        suspendedAt: true,
        suspendedReason: true,
        paymentFailedAt: true,
        stripeCustomerId: true,
        trialEndsAt: true,
        billingEmail: true,
        createdAt: true,
      },
    }),
    prisma.organizationMembership.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    }),
  ])

  if (!org) redirect('/dashboard')

  const membresData = memberships.map((m) => ({
    id: m.id,
    role: m.role,
    joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
    user: m.user,
  }))

  return (
    <OrganisationSettingsClient
      org={{
        ...org,
        suspendedAt: org.suspendedAt ? org.suspendedAt.toISOString() : null,
        paymentFailedAt: org.paymentFailedAt ? org.paymentFailedAt.toISOString() : null,
        trialEndsAt: org.trialEndsAt ? org.trialEndsAt.toISOString() : null,
        createdAt: org.createdAt.toISOString(),
      }}
      membres={membresData}
      currentUserId={session.user.id}
    />
  )
}
