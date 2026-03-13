// ─────────────────────────────────────────────────────────
// /rh — Dashboard RH : suivi des DPAE
// doc/06 Règles #3, #9, #11
// Server Component → guard d'accès → Client Component
// ─────────────────────────────────────────────────────────
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { RhDashboardClient } from './RhDashboardClient'

export default async function RhPage() {
  const session = await getServerSession(authOptions)

  // Guard : seuls DIRECTEUR et RH peuvent accéder à cette page
  if (!session || !session.user.organizationId) {
    redirect('/login')
  }

  const role = session.user.organizationRole
  if (role !== 'RH' && role !== 'DIRECTEUR') {
    redirect('/dashboard')
  }

  const canExportCsv = session.user.organizationPlan !== 'FREE'

  return (
    <RhDashboardClient
      canExportCsv={canExportCsv}
      organizationPlan={session.user.organizationPlan ?? 'FREE'}
    />
  )
}
