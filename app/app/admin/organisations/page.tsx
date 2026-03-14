'use client'
// ─────────────────────────────────────────────────────────
// /admin/organisations — Liste des organisations
// doc/17-back-office-super-admin.md §17.4
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Org = {
  id: string
  name: string
  type: string
  plan: string
  isReadOnly: boolean
  suspendedAt: string | null
  paymentFailedAt: string | null
  createdAt: string
  _count: { memberships: number }
}

type PageData = {
  organizations: Org[]
  total: number
  page: number
  totalPages: number
}

const PLAN_COLORS: Record<string, string> = {
  FREE:       'bg-gray-100 text-gray-600',
  PRO:        'bg-indigo-100 text-indigo-700',
  ENTERPRISE: 'bg-purple-100 text-purple-700',
}

const TYPE_LABELS: Record<string, string> = {
  THEATRE:          'Théâtre',
  COMPAGNIE_DANSE:  'Compagnie danse',
  COMPAGNIE_THEATRE:'Compagnie théâtrale',
  PRODUCTEUR:       'Producteur',
  SALLE_CONCERT:    'Salle de concert',
  FESTIVAL:         'Festival',
  AUTRE:            'Autre',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function OrgStatus({ org }: { org: Org }) {
  if (org.suspendedAt) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Suspendue</span>
  if (org.paymentFailedAt) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Paiement échoué</span>
  if (org.isReadOnly) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Lecture seule</span>
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>
}

export default function AdminOrganisationsPage() {
  const [data, setData]       = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [plan, setPlan]       = useState('')
  const [page, setPage]       = useState(1)

  const load = useCallback(async (s: string, p: string, pg: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pg), limit: '20' })
      if (s) params.set('search', s)
      if (p) params.set('plan', p)
      const res = await fetch(`/api/admin/organisations?${params}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { load(search, plan, page) }, 300)
    return () => clearTimeout(t)
  }, [search, plan, page, load])

  return (
    <>
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4 flex-shrink-0">
        <h1 className="text-lg font-semibold text-gray-900 flex-1">
          Organisations
          {data && <span className="ml-2 text-sm font-normal text-gray-400">{data.total}</span>}
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {/* Filtres */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={plan}
            onChange={(e) => { setPlan(e.target.value); setPage(1) }}
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Tous les plans</option>
            <option value="FREE">Gratuit</option>
            <option value="PRO">Pro</option>
            <option value="ENTERPRISE">Enterprise</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Membres</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Créée le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-gray-400">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Chargement…
                  </td>
                </tr>
              ) : data?.organizations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-gray-400">Aucune organisation trouvée.</td>
                </tr>
              ) : (
                data?.organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/organisations/${org.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                        {org.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{TYPE_LABELS[org.type] ?? org.type}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLAN_COLORS[org.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                        {org.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{org._count.memberships}</td>
                    <td className="px-4 py-3"><OrgStatus org={org} /></td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(org.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">
              Page {data.page} / {data.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                ← Précédent
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Suivant →
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
