'use client'
// ─────────────────────────────────────────────────────────
// OrgSwitcher — switcher multi-organisation
// doc/04-pages-interfaces-ux.md §11.3
// doc/06-regles-decisions.md Règle #30
// ─────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

type Org = {
  id: string
  name: string
  logo: string | null
}

type OrgSwitcherProps = {
  organizations: Org[]
  activeOrgId: string
  activeOrgName: string
}

export function OrgSwitcher({ organizations, activeOrgId, activeOrgName }: OrgSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { update } = useSession()
  const router = useRouter()

  // Fermer le dropdown en cliquant ailleurs
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Si une seule org, on affiche juste le nom fixe (sans dropdown)
  if (organizations.length <= 1) {
    return (
      <div className="px-3 py-2 flex items-center gap-2 text-sm font-medium text-gray-900 truncate">
        <span className="text-base">🎭</span>
        <span className="truncate">{activeOrgName}</span>
      </div>
    )
  }

  async function switchOrg(orgId: string) {
    if (orgId === activeOrgId || switching) return
    setSwitching(true)
    setOpen(false)
    try {
      // Met à jour le JWT via NextAuth update() → callback jwt trigger='update'
      await update({ organizationId: orgId })
      // Recharger la page pour que tous les Server Components re-fetch avec le nouveau contexte
      router.refresh()
    } catch (err) {
      console.error('[OrgSwitcher] switch failed:', err)
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={switching}
        className="w-full px-3 py-2 flex items-center gap-2 text-sm font-medium text-gray-900 rounded-lg hover:bg-gray-100 transition-colors truncate disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-base flex-shrink-0">🎭</span>
        <span className="truncate flex-1 text-left">{activeOrgName}</span>
        <svg
          className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          <p className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
            Organisations
          </p>

          <ul role="listbox">
            {organizations.map((org) => (
              <li key={org.id}>
                <button
                  role="option"
                  aria-selected={org.id === activeOrgId}
                  onClick={() => switchOrg(org.id)}
                  className={`w-full px-3 py-2 flex items-center gap-2 text-sm text-left hover:bg-gray-50 transition-colors ${
                    org.id === activeOrgId
                      ? 'text-indigo-600 font-medium bg-indigo-50'
                      : 'text-gray-700'
                  }`}
                >
                  <span className="text-base flex-shrink-0">🎭</span>
                  <span className="flex-1 truncate">{org.name}</span>
                  {org.id === activeOrgId && (
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t border-gray-100 mt-1 pt-1">
            <a
              href="/join"
              className="w-full px-3 py-2 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => setOpen(false)}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Rejoindre une organisation
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
