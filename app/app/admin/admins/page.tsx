// ─────────────────────────────────────────────────────────
// /admin/admins — Gestion des super-admins (back-office)
// doc/17-back-office-super-admin.md
// ─────────────────────────────────────────────────────────
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/organisations', label: 'Organisations' },
  { href: '/admin/admins', label: 'Admins' },
  { href: '/admin/logs', label: 'Logs' },
]

export default async function AdminAdminsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'SUPER_ADMIN') redirect('/dashboard')

  const admins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN', deletedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const recentLogs = await prisma.activityLog.findMany({
    where: {
      user: { role: 'SUPER_ADMIN' },
    },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

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
                item.href === '/admin/admins'
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
          <h1 className="text-lg font-semibold text-gray-900">Administrateurs</h1>
          <span className="ml-3 text-sm text-gray-400">{admins.length} super-admin{admins.length > 1 ? 's' : ''}</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Liste des admins */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Super-admins actifs</h2>
                <span className="text-xs text-gray-400">Role: SUPER_ADMIN</span>
              </div>

              {admins.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Aucun super-admin trouvé</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {admins.map((admin) => (
                    <li key={admin.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">
                            {admin.firstName} {admin.lastName}
                          </p>
                          {admin.email === session.user.email && (
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">Vous</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{admin.email}</p>
                        <p className="text-xs text-gray-300 mt-0.5 font-mono">{admin.id}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-500">
                          Créé {new Date(admin.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                        {admin.lastLoginAt && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Dernière connexion{' '}
                            {new Date(admin.lastLoginAt).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Activité récente des admins */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Activité admin récente</h2>
                <Link
                  href="/admin/logs"
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Voir tout &rarr;
                </Link>
              </div>

              {recentLogs.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Aucune activité récente</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {recentLogs.map((log) => (
                    <li key={log.id} className="py-2.5 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-gray-800">{log.action}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {log.user
                            ? `${log.user.firstName} ${log.user.lastName}`
                            : '—'}
                          {' · '}
                          {log.entityType}
                        </p>
                      </div>
                      <time className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(log.createdAt).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Note informative */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <p className="text-sm text-blue-700">
              <strong>Note :</strong> L&apos;ajout ou la suppression de super-admins se fait directement
              en base de données via le flag <code className="font-mono bg-blue-100 px-1 py-0.5 rounded">User.role = SUPER_ADMIN</code>.
              Contactez l&apos;équipe technique pour toute modification.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
