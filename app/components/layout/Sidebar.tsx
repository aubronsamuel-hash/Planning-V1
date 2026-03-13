'use client'
// ─────────────────────────────────────────────────────────
// Sidebar — navigation principale
// doc/04-pages-interfaces-ux.md §6.1 (wireframes)
// doc/02-roles-permissions.md — visibilité des liens par rôle
// ─────────────────────────────────────────────────────────
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import type { OrganizationRole } from '@prisma/client'
import { OrgSwitcher } from './OrgSwitcher'

type Org = {
  id: string
  name: string
  logo: string | null
}

type SidebarProps = {
  organizations: Org[]
  activeOrgId: string
  activeOrgName: string
}

// ── Navigation par rôle ───────────────────────────────────
type NavItem = {
  href: string
  label: string
  icon: string
  // rôles qui peuvent voir ce lien (null = tous les rôles org)
  roles?: OrganizationRole[]
  // true = visible uniquement pour les SUPER_ADMIN (côté platform)
  superAdminOnly?: boolean
  // true = visible uniquement pour COLLABORATEUR (espace personnel)
  collaborateurOnly?: boolean
  // true = caché pour COLLABORATEUR
  hideForCollaborateur?: boolean
  exact?: boolean // pour le matching actif exact
}

const ORG_NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: '🏠',
    exact: true,
    hideForCollaborateur: true,
  },
  // Espace collaborateur — remplace Dashboard pour COLLABORATEUR
  {
    href: '/dashboard',
    label: 'Accueil',
    icon: '🏠',
    exact: true,
    collaborateurOnly: true,
  },
  {
    href: '/projets',
    label: 'Projets',
    icon: '🎭',
    roles: ['DIRECTEUR', 'REGISSEUR', 'RH'],
  },
  {
    href: '/planning',
    label: 'Planning',
    icon: '📅',
    roles: ['DIRECTEUR', 'REGISSEUR', 'RH'],
  },
  {
    href: '/equipe',
    label: 'Équipe',
    icon: '👥',
    roles: ['DIRECTEUR', 'REGISSEUR', 'RH'],
  },
  {
    href: '/rh',
    label: 'RH / Paie',
    icon: '💶',
    roles: ['DIRECTEUR', 'RH'],
  },
  // Espace collaborateur
  {
    href: '/mon-planning',
    label: 'Mon planning',
    icon: '📅',
    collaborateurOnly: true,
  },
  {
    href: '/mes-contrats',
    label: 'Mes contrats',
    icon: '📄',
    collaborateurOnly: true,
  },
]

const BOTTOM_NAV_ITEMS: NavItem[] = [
  {
    href: '/settings',
    label: 'Réglages',
    icon: '⚙️',
  },
]

function isActive(href: string, pathname: string, exact = false): boolean {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(href + '/')
}

function canSeeItem(item: NavItem, orgRole: OrganizationRole | null): boolean {
  const isCollaborateur = orgRole === 'COLLABORATEUR'

  if (item.collaborateurOnly && !isCollaborateur) return false
  if (item.hideForCollaborateur && isCollaborateur) return false
  if (item.roles && !item.roles.includes(orgRole as OrganizationRole)) return false
  return true
}

export function Sidebar({ organizations, activeOrgId, activeOrgName }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()

  const orgRole = session?.user?.organizationRole ?? null
  const userName = session?.user?.name ?? session?.user?.email ?? ''

  const visibleNavItems = ORG_NAV_ITEMS.filter((item) => canSeeItem(item, orgRole))
  const visibleBottomItems = BOTTOM_NAV_ITEMS.filter((item) => canSeeItem(item, orgRole))

  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      {/* Org Switcher */}
      <div className="px-3 pt-4 pb-2">
        <OrgSwitcher
          organizations={organizations}
          activeOrgId={activeOrgId}
          activeOrgName={activeOrgName}
        />
      </div>

      <div className="mx-3 border-t border-gray-100" />

      {/* Navigation principale */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto sidebar-scroll" aria-label="Navigation principale">
        <ul className="space-y-0.5">
          {visibleNavItems.map((item) => {
            const active = isActive(item.href, pathname, item.exact)
            return (
              <li key={`${item.href}-${item.label}`}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="text-base leading-none w-5 text-center">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Navigation du bas — réglages + profil */}
      <div className="px-3 pb-4 space-y-0.5">
        <div className="border-t border-gray-100 mb-2" />

        {visibleBottomItems.map((item) => {
          const active = isActive(item.href, pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="text-base leading-none w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}

        {/* Profil utilisateur + déconnexion */}
        <div className="flex items-center gap-2 px-3 py-2 mt-1">
          {/* Avatar initiale */}
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-indigo-700">
              {getInitial(userName)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{userName}</p>
            {orgRole && (
              <p className="text-xs text-gray-400 truncate">{ROLE_LABELS[orgRole]}</p>
            )}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            title="Déconnexion"
            aria-label="Se déconnecter"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}

function getInitial(name: string): string {
  return (name.trim().charAt(0) || '?').toUpperCase()
}

const ROLE_LABELS: Record<OrganizationRole, string> = {
  DIRECTEUR:     'Directeur',
  REGISSEUR:     'Régisseur',
  RH:            'RH',
  COLLABORATEUR: 'Collaborateur',
}
