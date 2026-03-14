// ─────────────────────────────────────────────────────────
// /admin/logs — Logs d'activité (back-office)
// doc/17-back-office-super-admin.md
// ─────────────────────────────────────────────────────────
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

type LogEntry = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  createdAt: string
  user: { firstName: string; lastName: string; email: string } | null
  organization: { name: string } | null
  metadata: Record<string, unknown> | null
}

const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/organisations', label: 'Organisations' },
  { href: '/admin/admins', label: 'Admins' },
  { href: '/admin/logs', label: 'Logs' },
]

const PERIOD_OPTIONS = [
  { value: '24h', label: '24 heures' },
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
]

const ACTION_BADGE_COLORS: Record<string, string> = {
  CREATED: 'bg-green-100 text-green-700',
  UPDATED: 'bg-blue-100 text-blue-700',
  DELETED: 'bg-red-100 text-red-700',
  ANNULEE: 'bg-orange-100 text-orange-700',
}

function getActionColor(action: string): string {
  for (const [key, cls] of Object.entries(ACTION_BADGE_COLORS)) {
    if (action.includes(key)) return cls
  }
  return 'bg-gray-100 text-gray-600'
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: {
    action?: string
    organizationId?: string
    userId?: string
    period?: string
    page?: string
  }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'SUPER_ADMIN') redirect('/dashboard')

  const { action, organizationId, userId, period = '7d', page = '1' } = searchParams

  let logs: LogEntry[] = []
  let total = 0
  let fetchError = false

  try {
    const params = new URLSearchParams()
    if (action) params.set('action', action)
    if (organizationId) params.set('organizationId', organizationId)
    if (userId) params.set('userId', userId)
    params.set('period', period)
    params.set('page', page)
    params.set('limit', '50')

    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/admin/logs?${params.toString()}`, {
      headers: {
        Cookie: `next-auth.session-token=${(session as any).__raw ?? ''}`,
      },
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      logs = data.logs ?? []
      total = data.total ?? 0
    } else {
      fetchError = true
    }
  } catch {
    fetchError = true
  }

  const currentPage = Math.max(1, parseInt(page, 10))
  const totalPages = Math.ceil(total / 50)

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
                item.href === '/admin/logs'
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
          <h1 className="text-lg font-semibold text-gray-900">Logs d&apos;activité</h1>
          <span className="ml-3 text-sm text-gray-400">{total} entrées</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {/* Filtres */}
          <div className="mb-5 bg-white rounded-xl border border-gray-200 p-4">
            <form method="get" className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Action</label>
                <input
                  name="action"
                  defaultValue={action ?? ''}
                  placeholder="ex: PROJET_CREATED"
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none w-44"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Organisation ID</label>
                <input
                  name="organizationId"
                  defaultValue={organizationId ?? ''}
                  placeholder="cuid…"
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none w-44"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Période</label>
                <select
                  name="period"
                  defaultValue={period}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
                >
                  {PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
              >
                Filtrer
              </button>
              {(action || organizationId || userId) && (
                <Link
                  href={`/admin/logs?period=${period}`}
                  className="px-4 py-1.5 text-sm text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Réinitialiser
                </Link>
              )}
            </form>
          </div>

          {fetchError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-5">
              <p className="text-sm text-red-700">Erreur lors du chargement des logs.</p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Entité</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Utilisateur</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Organisation</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                      Aucun log trouvé
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-medium ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        <span className="font-medium">{log.entityType}</span>
                        {log.entityId && (
                          <span className="block font-mono text-gray-400 mt-0.5 truncate max-w-[120px]">
                            {log.entityId}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.user ? (
                          <div>
                            <p className="text-gray-800">{log.user.firstName} {log.user.lastName}</p>
                            <p className="text-xs text-gray-400">{log.user.email}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Système</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.organization ? (
                          <span className="text-gray-700">{log.organization.name}</span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(log.createdAt).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
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
                Page {currentPage} sur {totalPages} ({total} logs)
              </p>
              <div className="flex gap-2">
                {currentPage > 1 && (
                  <Link
                    href={`/admin/logs?period=${period}&page=${currentPage - 1}${action ? `&action=${action}` : ''}${organizationId ? `&organizationId=${organizationId}` : ''}`}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    &larr; Précédent
                  </Link>
                )}
                {currentPage < totalPages && (
                  <Link
                    href={`/admin/logs?period=${period}&page=${currentPage + 1}${action ? `&action=${action}` : ''}${organizationId ? `&organizationId=${organizationId}` : ''}`}
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
