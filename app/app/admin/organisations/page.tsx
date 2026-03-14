// ─────────────────────────────────────────────────────────
// /admin/organisations — Liste des organisations (back-office)
// doc/17-back-office-super-admin.md
// ─────────────────────────────────────────────────────────
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

type Org = {
  id: string
  name: string
  slug: string
  plan: string
  isReadOnly: boolean
  suspendedAt: string | null
  paymentFailedAt: string | null
  createdAt: string
  _count: { memberships: number; projets: number }
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

const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/organisations', label: 'Organisations' },
  { href: '/admin/admins', label: 'Admins' },
  { href: '/admin/logs', label: 'Logs' },
]

export default async function AdminOrganisationsPage({
  searchParams,
}: {
  searchParams: { plan?: string; search?: string; page?: string; filter?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'SUPER_ADMIN') redirect('/dashboard')

  const { plan, search, page = '1', filter } = searchParams

  let orgs: Org[] = []
  let total = 0
  let fetchError = false

  try {
    const params = new URLSearchParams()
    if (plan) params.set('plan', plan)
    if (search) params.set('search', search)
    params.set('page', page)
    params.set('limit', '20')

    // Filter shortcuts
    if (filter === 'payment_failed') params.set('filter', 'payment_failed')
    if (filter === 'readonly') params.set('filter', 'readonly')

    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/admin/organisations?${params.toString()}`, {
      headers: {
        Cookie: `next-auth.session-token=${(session as any).__raw ?? ''}`,
      },
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      orgs = data.organizations ?? []
      total = data.total ?? 0
    } else {
      fetchError = true
    }
  } catch {
    fetchError = true
  }

  const currentPage = Math.max(1, parseInt(page, 10))
  const totalPages = Math.ceil(total / 20)

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
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                item.href === '/admin/organisations'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
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
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 flex-shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">Organisations</h1>
          <span className="ml-3 text-sm text-gray-400">{total} au total</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {/* Filtres */}
          <div className="mb-5 flex flex-wrap gap-3 items-center">
            <form method="get" className="flex gap-2 flex-1 max-w-md">
              <input
                name="search"
                defaultValue={search ?? ''}
                placeholder="Rechercher par nom…"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
              >
                Chercher
              </button>
            </form>

            <div className="flex gap-2">
              {['FREE', 'PRO', 'ENTERPRISE'].map((p) => (
                <Link
                  key={p}
                  href={`/admin/organisations?plan=${p}`}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                    plan === p ? PLAN_COLORS[p] + ' ring-2 ring-offset-1 ring-indigo-400' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {PLAN_LABELS[p]}
                </Link>
              ))}
              {plan && (
                <Link href="/admin/organisations" className="px-3 py-1.5 rounded-full text-xs text-gray-500 bg-gray-100 hover:bg-gray-200">
                  ✕ Réinitialiser
                </Link>
              )}
            </div>
          </div>

          {fetchError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-5">
              <p className="text-sm text-red-700">Erreur lors du chargement des organisations.</p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Organisation</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Membres</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Projets</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Créée le</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orgs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                      Aucune organisation trouvée
                    </td>
                  </tr>
                ) : (
                  orgs.map((org) => (
                    <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/admin/organisations/${org.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                          {org.name}
                        </Link>
                        <p className="text-xs text-gray-400">{org.slug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_COLORS[org.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                          {PLAN_LABELS[org.plan] ?? org.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{org._count?.memberships ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{org._count?.projets ?? '—'}</td>
                      <td className="px-4 py-3">
                        {org.suspendedAt ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Suspendue</span>
                        ) : org.paymentFailedAt ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Paiement échoué</span>
                        ) : org.isReadOnly ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Lecture seule</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(org.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/organisations/${org.id}`}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Voir &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {currentPage} sur {totalPages} ({total} organisations)
              </p>
              <div className="flex gap-2">
                {currentPage > 1 && (
                  <Link
                    href={`/admin/organisations?page=${currentPage - 1}${plan ? `&plan=${plan}` : ''}${search ? `&search=${search}` : ''}`}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    &larr; Précédent
                  </Link>
                )}
                {currentPage < totalPages && (
                  <Link
                    href={`/admin/organisations?page=${currentPage + 1}${plan ? `&plan=${plan}` : ''}${search ? `&search=${search}` : ''}`}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Suivant &rarr;
                  </Link>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
