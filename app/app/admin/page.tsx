// ─────────────────────────────────────────────────────────
// /admin — Dashboard back-office SUPER_ADMIN
// Layout géré par app/admin/layout.tsx
// doc/17-back-office-super-admin.md §17.3
// ─────────────────────────────────────────────────────────
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

type OrgsByPlan = Record<string, number>

type NewOrg = {
  id: string
  name: string
  plan: string
  createdAt: string
}

type AdminStats = {
  totalOrgs: number
  orgsByPlan: OrgsByPlan
  totalUsers: number
  activeUsers30d: number
  mrr: number
  newOrgs30d: NewOrg[]
  alertes: {
    orgsIsReadOnly: number
    orgsPaymentFailed: number
  }
}

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Gratuit',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
}

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-600',
  PRO: 'bg-indigo-100 text-indigo-700',
  ENTERPRISE: 'bg-purple-100 text-purple-700',
}

function formatMRR(centimes: number): string {
  return (centimes / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions)

  // Fetch stats côté serveur
  let stats: AdminStats | null = null
  let statsError = false

  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: {
        // Transmettre le cookie de session pour l'auth
        Cookie: `next-auth.session-token=${(session as any).__raw ?? ''}`,
      },
      cache: 'no-store',
    })
    if (res.ok) {
      stats = await res.json()
    } else {
      statsError = true
    }
  } catch {
    statsError = true
  }

  const orgsByPlan = stats?.orgsByPlan ?? {}
  const totalPlanOrgs = Object.values(orgsByPlan).reduce((a, b) => a + b, 0)

  return (
    <>
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 flex-shrink-0">
        <h1 className="text-lg font-semibold text-gray-900">Dashboard administration</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
          {statsError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-red-700">
                Impossible de charger les statistiques. Vérifiez la connexion à la base de données.
              </p>
            </div>
          )}

          {stats && (
            <>
              {/* Alertes système */}
              {(stats.alertes.orgsIsReadOnly > 0 || stats.alertes.orgsPaymentFailed > 0) && (
                <div className="mb-6 space-y-2">
                  {stats.alertes.orgsPaymentFailed > 0 && (
                    <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 flex items-center justify-between">
                      <p className="text-sm text-red-700 font-medium">
                        {stats.alertes.orgsPaymentFailed} organisation{stats.alertes.orgsPaymentFailed > 1 ? 's' : ''} avec paiement en échec
                      </p>
                      <Link href="/admin/organisations?filter=payment_failed" className="text-sm text-red-700 underline font-medium">
                        Voir &rarr;
                      </Link>
                    </div>
                  )}
                  {stats.alertes.orgsIsReadOnly > 0 && (
                    <div className="bg-orange-50 border border-orange-300 rounded-lg px-4 py-3 flex items-center justify-between">
                      <p className="text-sm text-orange-700 font-medium">
                        {stats.alertes.orgsIsReadOnly} organisation{stats.alertes.orgsIsReadOnly > 1 ? 's' : ''} en lecture seule
                      </p>
                      <Link href="/admin/organisations?filter=readonly" className="text-sm text-orange-700 underline font-medium">
                        Voir &rarr;
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* 4 métriques KPI */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Organisations</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalOrgs}</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Utilisateurs</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
                  <p className="text-xs text-gray-400 mt-1">{stats.activeUsers30d} actifs 30j</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">MRR estimé</p>
                  <p className="text-3xl font-bold text-gray-900">{formatMRR(stats.mrr)}</p>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Plan Pro+</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {(orgsByPlan['PRO'] ?? 0) + (orgsByPlan['ENTERPRISE'] ?? 0)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">sur {stats.totalOrgs} orgs</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Répartition par plan */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-700">Répartition par plan</h2>
                    <Link href="/admin/organisations" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                      Voir tout &rarr;
                    </Link>
                  </div>

                  <div className="space-y-3">
                    {(['FREE', 'PRO', 'ENTERPRISE'] as const).map((plan) => {
                      const count = orgsByPlan[plan] ?? 0
                      const pct = totalPlanOrgs > 0 ? Math.round((count / totalPlanOrgs) * 100) : 0
                      return (
                        <div key={plan}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLAN_COLORS[plan]}`}>
                                {PLAN_LABELS[plan]}
                              </span>
                            </div>
                            <span className="text-sm text-gray-700 font-medium">
                              {count} <span className="text-xs text-gray-400">({pct}%)</span>
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-indigo-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Nouvelles organisations */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-700">Dernières inscriptions</h2>
                    <Link href="/admin/organisations" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                      Voir tout &rarr;
                    </Link>
                  </div>

                  {stats.newOrgs30d.length === 0 ? (
                    <p className="text-sm text-gray-400">Aucune nouvelle organisation récemment</p>
                  ) : (
                    <ul className="divide-y divide-gray-50">
                      {stats.newOrgs30d.map((org) => (
                        <li key={org.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/admin/organisations/${org.id}`}
                              className="text-sm font-medium text-gray-900 hover:text-indigo-600 truncate block"
                            >
                              {org.name}
                            </Link>
                            <p className="text-xs text-gray-400">{formatDate(org.createdAt)}</p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${PLAN_COLORS[org.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                            {PLAN_LABELS[org.plan] ?? org.plan}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Raccourcis */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Link
                  href="/admin/organisations"
                  className="bg-white rounded-lg border border-gray-200 p-4 text-center hover:border-indigo-300 hover:shadow-sm transition-all group"
                >
                  <p className="text-2xl mb-1">&#x1F3E2;</p>
                  <p className="text-xs font-medium text-gray-700 group-hover:text-indigo-700">Organisations</p>
                </Link>
                <Link
                  href="/admin/logs"
                  className="bg-white rounded-lg border border-gray-200 p-4 text-center hover:border-indigo-300 hover:shadow-sm transition-all group"
                >
                  <p className="text-2xl mb-1">&#x1F4CB;</p>
                  <p className="text-xs font-medium text-gray-700 group-hover:text-indigo-700">Logs d&apos;activité</p>
                </Link>
                <Link
                  href="/admin/admins"
                  className="bg-white rounded-lg border border-gray-200 p-4 text-center hover:border-indigo-300 hover:shadow-sm transition-all group"
                >
                  <p className="text-2xl mb-1">&#x1F464;</p>
                  <p className="text-xs font-medium text-gray-700 group-hover:text-indigo-700">Administrateurs</p>
                </Link>
                <Link
                  href="/admin/organisations?filter=payment_failed"
                  className="bg-white rounded-lg border border-gray-200 p-4 text-center hover:border-red-300 hover:shadow-sm transition-all group"
                >
                  <p className="text-2xl mb-1">&#x26A0;&#xFE0F;</p>
                  <p className="text-xs font-medium text-gray-700 group-hover:text-red-700">Alertes paiement</p>
                </Link>
              </div>
            </>
          )}

          {!stats && !statsError && (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-gray-400">Chargement des statistiques…</p>
            </div>
          )}
      </main>
    </>
  )
}
