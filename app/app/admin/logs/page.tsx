'use client'
// ─────────────────────────────────────────────────────────
// /admin/logs — Logs d'activité plateforme
// doc/17-back-office-super-admin.md §17.7
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'

type Log = {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  createdAt: string
  metadata: Record<string, unknown> | null
  user: { email: string; firstName: string; lastName: string } | null
  organization: { name: string } | null
}

type PageData = {
  logs: Log[]
  total: number
  page: number
  totalPages: number
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminLogsPage() {
  const searchParams = useSearchParams()
  const [data, setData]           = useState<PageData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [action, setAction]       = useState('')
  const [orgId, setOrgId]         = useState(searchParams.get('organizationId') ?? '')
  const [period, setPeriod]       = useState('7d')
  const [page, setPage]           = useState(1)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async (a: string, o: string, per: string, pg: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pg), limit: '50', period: per })
      if (a) params.set('action', a)
      if (o) params.set('userId', o)
      const res = await fetch(`/api/admin/logs?${params}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(action, orgId, period, page), 300)
    return () => clearTimeout(t)
  }, [action, orgId, period, page, load])

  async function handleExport() {
    setExporting(true)
    try {
      const params = new URLSearchParams({ period })
      if (action) params.set('action', action)
      if (orgId) params.set('organizationId', orgId)
      const res = await fetch(`/api/admin/logs/export?${params}`)
      if (!res.ok) return
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `logs-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-3 flex-shrink-0">
        <h1 className="text-lg font-semibold text-gray-900 flex-1">
          Logs d&apos;activité
          {data && <span className="ml-2 text-sm font-normal text-gray-400">{data.total} entrées</span>}
        </h1>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {exporting ? 'Export…' : 'Exporter CSV'}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {/* Filtres */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Type d'action (ex: PROJET_CREATED)"
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1) }}
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Email utilisateur"
            value={orgId}
            onChange={(e) => { setOrgId(e.target.value); setPage(1) }}
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={period}
            onChange={(e) => { setPeriod(e.target.value); setPage(1) }}
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="24h">Dernières 24h</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="all">Tout</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Horodatage</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Organisation</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Utilisateur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : data?.logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-sm text-gray-400">Aucun log trouvé.</td>
                </tr>
              ) : (
                data?.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-2.5 text-gray-700">{log.organization?.name ?? <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-mono bg-gray-100 text-gray-800 px-2 py-0.5 rounded">{log.action}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {log.user ? `${log.user.firstName} ${log.user.lastName}` : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">Page {data.page} / {data.totalPages}</p>
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
