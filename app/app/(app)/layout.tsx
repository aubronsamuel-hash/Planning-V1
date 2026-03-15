// ─────────────────────────────────────────────────────────
// Layout authentifié — shell avec sidebar + topbar
// doc/04-pages-interfaces-ux.md §6.1, §11.3
// doc/23-architecture-technique.md §23.1
// ─────────────────────────────────────────────────────────
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/layout/Sidebar'
import { NotificationBell } from '@/components/layout/NotificationBell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  // Normalement couvert par le middleware, double-vérification défensive
  if (!session) redirect('/login')

  // SUPER_ADMIN → redirige vers son espace dédié
  if (session.user.role === 'SUPER_ADMIN') redirect('/admin')

  // Onboarding : si l'org n'a pas encore terminé l'onboarding, forcer le wizard
  // Ne pas rediriger si on est déjà sur /onboarding (évite la boucle infinie)
  const headersList = headers()
  const pathname = headersList.get('x-invoke-path') || headersList.get('x-pathname') || ''
  const isOnOnboarding = pathname.startsWith('/onboarding')

  if (session.user.organizationId && !isOnOnboarding) {
    const org = await prisma.organization.findFirst({
      where: { id: session.user.organizationId },
      select: { onboardingCompletedAt: true, suspendedAt: true },
    })

    if (org && !org.onboardingCompletedAt) {
      redirect('/onboarding')
    }
  }

  // ── Charger les organisations de l'utilisateur ─────────
  // Nécessaire pour l'OrgSwitcher
  const memberships = await prisma.organizationMembership.findMany({
    where: {
      userId: session.user.id,
      joinedAt: { not: null }, // exclure les invitations en attente (Règle B16-2)
    },
    include: {
      organization: {
        select: { id: true, name: true, logo: true },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })

  const organizations = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    logo: m.organization.logo,
  }))

  const activeOrgName =
    organizations.find((o) => o.id === session.user.organizationId)?.name ?? 'Mon organisation'

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        organizations={organizations}
        activeOrgId={session.user.organizationId ?? ''}
        activeOrgName={activeOrgName}
      />

      {/* Zone principale */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-end px-6 flex-shrink-0">
          <NotificationBell />
        </header>

        {/* Contenu page */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
