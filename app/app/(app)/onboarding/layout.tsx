// ─────────────────────────────────────────────────────────
// Layout du wizard d'onboarding
// Layout minimal sans sidebar — utilisé uniquement au premier accès
// doc/14-onboarding.md §14.2
// ─────────────────────────────────────────────────────────
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  // Si l'onboarding est déjà terminé, rediriger vers le dashboard
  if (session.user.organizationId) {
    const org = await prisma.organization.findFirst({
      where: { id: session.user.organizationId },
      select: { onboardingCompletedAt: true },
    })

    if (org?.onboardingCompletedAt) {
      redirect('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header minimal */}
      <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6">
        <span className="text-xl font-semibold text-indigo-600">🎭 Spectacle Vivant</span>
      </header>

      <main className="flex justify-center px-4 py-12">
        {children}
      </main>
    </div>
  )
}
