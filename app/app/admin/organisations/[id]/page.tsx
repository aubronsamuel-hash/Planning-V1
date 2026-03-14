// ─────────────────────────────────────────────────────────
// /admin/organisations/[id] — Fiche organisation (back-office)
// doc/17-back-office-super-admin.md
// ─────────────────────────────────────────────────────────
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

type Membership = {
  role: string
  joinedAt: string
  user: { id: string; email: string; firstName: string; lastName: string }
}

type ActivityLog = {
  id: string
  action: string
  entityType: string
  createdAt: string
  user: { firstName: string; lastName: string; email: string } | null
}

type OrgDetail = {
  id: string
  name: string
  slug: string
  type: string
  plan: string
  isReadOnly: boolean
  suspendedAt: string | null
  paymentFailedAt: string | null
  trialEndsAt: string | null
  stripeCustomerId: string | null
  createdAt: string
  memberships: Membership[]
  activityLogs: ActivityLog[]
  _count: { projets: number; affectations: number }
}

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-600',
  PRO: 'bg-indigo-100 text-indigo-700',
  ENTERPRISE: 'bg-purple-100 text-purple-700',
}

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Gratuit',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
}

const ROLE_LABELS: Record<string, string> = {
  DIRECTEUR: 'Directeur',
  REGISSEUR: 'Régisseur',
  RH: 'RH',
  COLLABORATEUR: 'Collaborateur',
}

const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/organisations', label: 'Organisations' },
  { href: '/admin/admins', label: 'Admins' },
  { href: '/admin/logs', label: 'Logs' },
]

export default async function AdminOrgDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'SUPER_ADMIN') redirect('/dashboard')

  let org: OrgDetail | null = null
  let fetchError = false

  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/admin/organisations/${params.id}`, {
      headers: {
        Cookie: `next-auth.session-token=${(session as any).__raw ?? ''}`,
      },
      cache: 'no-store',
    })
    if (res.ok) {
      org = await res.json()
    } else if (res.status === 404) {
      notFound()
    } else {
      fetchError = true
    }
  } catch {
    fetchError = true
  }

  if (!org && !fetchError) notFound()

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 flex flex-col flex-shrink-0">
        <div className="px-5 py-5 border-b border-gray-700">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Back-office</p>
          <p className="text-sm font-semibold text-white truncate">{session.user.email}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-gray-700">
          <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
            Retour au SaaS &rarr;
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 flex-shrink-0 gap-3">
          <Link href="/admin/organisations" className="text-sm text-gray-400 hover:text-gray-600">&larr; Organisations</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-semibold text-gray-900 truncate">{org?.name ?? '…'}</h1>
          {org && (
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[org.plan] ?? ''}`}>
              {PLAN_LABELS[org.plan] ?? org.plan}
            </span>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {fetchError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-5">
              <p className="text-sm text-red-700">Erreur lors du chargement de l&apos;organisation.</p>
            </div>
          )}

          {org && (
            <div className="space-y-6">
              {/* Statut alerte */}
              {(org.suspendedAt || org.paymentFailedAt || org.isReadOnly) && (
                <div className={`rounded-lg px-4 py-3 border ${
                  org.suspendedAt ? 'bg-red-50 border-red-300' :
                  org.paymentFailedAt ? 'bg-orange-50 border-orange-300' :
                  'bg-yellow-50 border-yellow-300'
                }`}>
                  <p className={`text-sm font-medium ${
                    org.suspendedAt ? 'text-red-700' :
                    org.paymentFailedAt ? 'text-orange-700' :
                    'text-yellow-700'
                  }`}>
                    {org.suspendedAt
                      ? `Organisation suspendue le ${new Date(org.suspendedAt).toLocaleDateString('fr-FR')}`
                      : org.paymentFailedAt
                      ? `Paiement échoué le ${new Date(org.paymentFailedAt).toLocaleDateString('fr-FR')}`
                      : 'Organisation en lecture seule'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Infos principales */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Informations</h2>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                      <dt className="text-gray-500">ID</dt>
                      <dd className="font-mono text-xs text-gray-700 mt-0.5 break-all">{org.id}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Slug</dt>
                      <dd className="text-gray-700 mt-0.5">{org.slug}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Type</dt>
                      <dd className="text-gray-700 mt-0.5">{org.type ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Créée le</dt>
                      <dd className="text-gray-700 mt-0.5">{new Date(org.createdAt).toLocaleDateString('fr-FR')}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Projets</dt>
                      <dd className="text-gray-700 mt-0.5 font-medium">{org._count.projets}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Affectations</dt>
                      <dd className="text-gray-700 mt-0.5 font-medium">{org._count.affectations}</dd>
                    </div>
                    {org.stripeCustomerId && (
                      <div className="col-span-2">
                        <dt className="text-gray-500">Stripe customer</dt>
                        <dd className="font-mono text-xs text-gray-700 mt-0.5">{org.stripeCustomerId}</dd>
                      </div>
                    )}
                    {org.trialEndsAt && (
                      <div>
                        <dt className="text-gray-500">Fin du trial</dt>
                        <dd className="text-gray-700 mt-0.5">{new Date(org.trialEndsAt).toLocaleDateString('fr-FR')}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Actions rapides */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Actions</h2>
                  <div className="space-y-2">
                    {!org.suspendedAt ? (
                      <form action={`/api/admin/organisations/${org.id}/suspendre`} method="post">
                        <button
                          type="submit"
                          className="w-full px-3 py-2 text-sm text-red-700 bg-red-50 hover:bg-red-100 rounded-lg font-medium transition-colors text-left"
                        >
                          Suspendre l&apos;organisation
                        </button>
                      </form>
                    ) : (
                      <form action={`/api/admin/organisations/${org.id}/reactiver`} method="post">
                        <button
                          type="submit"
                          className="w-full px-3 py-2 text-sm text-green-700 bg-green-50 hover:bg-green-100 rounded-lg font-medium transition-colors text-left"
                        >
                          Réactiver l&apos;organisation
                        </button>
                      </form>
                    )}
                    <Link
                      href={`/admin/logs?organizationId=${org.id}`}
                      className="block w-full px-3 py-2 text-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-medium transition-colors"
                    >
                      Voir les logs d&apos;activité &rarr;
                    </Link>
                  </div>
                </div>
              </div>

              {/* Membres */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">
                  Membres ({org.memberships.length})
                </h2>
                <div className="divide-y divide-gray-50">
                  {org.memberships.map((m) => (
                    <div key={m.user.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {m.user.firstName} {m.user.lastName}
                        </p>
                        <p className="text-xs text-gray-400">{m.user.email}</p>
                      </div>
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {ROLE_LABELS[m.role] ?? m.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Derniers logs */}
              {org.activityLogs.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-700">Activité récente</h2>
                    <Link
                      href={`/admin/logs?organizationId=${org.id}`}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Voir tout &rarr;
                    </Link>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {org.activityLogs.map((log) => (
                      <div key={log.id} className="py-2.5 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-gray-800 font-mono">{log.action}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {log.user
                              ? `${log.user.firstName} ${log.user.lastName}`
                              : 'Système'}
                            {' · '}
                            {log.entityType}
                          </p>
                        </div>
                        <time className="text-xs text-gray-400 flex-shrink-0">
                          {new Date(log.createdAt).toLocaleDateString('fr-FR')}
                        </time>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
