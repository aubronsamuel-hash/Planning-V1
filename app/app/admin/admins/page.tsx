'use client'
// ─────────────────────────────────────────────────────────
// /admin/admins — Gestion des Super Admins
// doc/17-back-office-super-admin.md §17.6
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'

type Admin = {
  id: string
  email: string
  firstName: string
  lastName: string
  createdAt: string
}

type Me = { id: string }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function AdminAdminsPage() {
  const [admins, setAdmins]     = useState<Admin[]>([])
  const [me, setMe]             = useState<Me | null>(null)
  const [loading, setLoading]   = useState(true)
  const [email, setEmail]       = useState('')
  const [adding, setAdding]     = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/admins')
      if (res.ok) {
        const data = await res.json()
        setAdmins(data.admins ?? [])
        setMe(data.me ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error ?? 'Erreur.'); return }
      setEmail('')
      load()
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(userId: string) {
    if (!confirm('Retirer ce Super Admin ?')) return
    const res = await fetch(`/api/admin/admins/${userId}`, { method: 'DELETE' })
    if (res.ok) load()
    else {
      const d = await res.json()
      alert(d.error ?? 'Erreur lors de la suppression.')
    }
  }

  return (
    <>
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 flex-shrink-0">
        <h1 className="text-lg font-semibold text-gray-900 flex-1">Super Admins</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Ajouter un admin */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Ajouter un Super Admin</h2>
          <form onSubmit={handleAdd} className="flex gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@plateforme.fr"
              required
              className="flex-1 h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={adding}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {adding ? 'Ajout…' : '+ Ajouter'}
            </button>
          </form>
          {addError && <p className="mt-2 text-sm text-red-600">{addError}</p>}
          <p className="mt-2 text-xs text-gray-400">
            L&apos;utilisateur doit avoir un compte sur la plateforme. Son rôle sera promu à SUPER_ADMIN.
          </p>
        </div>

        {/* Liste */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ajouté le</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{admin.firstName} {admin.lastName}</td>
                  <td className="px-4 py-3 text-gray-500">{admin.email}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(admin.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {me?.id === admin.id ? (
                      <span className="text-xs text-gray-400">(vous)</span>
                    ) : admins.length <= 1 ? (
                      <span className="text-xs text-gray-300">dernier admin</span>
                    ) : (
                      <button
                        onClick={() => handleRemove(admin.id)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Retirer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  )
}
