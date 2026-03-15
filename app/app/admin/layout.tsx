// ─────────────────────────────────────────────────────────
// Layout partagé du back-office SUPER_ADMIN
// Sidebar gris anthracite, séparé du layout (app) client
// doc/17-back-office-super-admin.md §17.2
// ─────────────────────────────────────────────────────────
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

const ADMIN_NAV = [
  { href: '/admin',               label: 'Tableau de bord', icon: '📊' },
  { href: '/admin/organisations', label: 'Organisations',   icon: '🏢' },
  { href: '/admin/admins',        label: 'Admins',          icon: '👤' },
  { href: '/admin/logs',          label: 'Logs',            icon: '📋' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')
  if (session.user.role !== 'SUPER_ADMIN') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar admin */}
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
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-gray-700">
          <Link
            href="/dashboard"
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            Retour au SaaS →
          </Link>
        </div>
      </aside>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
