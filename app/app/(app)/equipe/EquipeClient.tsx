'use client'
// ─────────────────────────────────────────────────────────
// EquipeClient — Annuaire de l'organisation avec recherche
// doc/07 §7.1-§7.4
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type ProjetLight = { id: string; title: string; colorCode: string }

type MembreItem = {
  userId: string
  collaborateurId: string | null
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
  orgRole: string
  accountStatus: string | null
  contractType: string | null
  projetsActifs: { id: string; title: string; colorCode: string }[]
  hasDpaeAFaire: boolean
  joinedAt: string | null
}

const CONTRACT_BADGE: Record<string, { label: string; color: string }> = {
  INTERMITTENT: { label: 'Inter.', color: 'bg-orange-100 text-orange-700' },
  CDD:          { label: 'CDD',   color: 'bg-yellow-100 text-yellow-700' },
  CDI:          { label: 'CDI',   color: 'bg-blue-100 text-blue-700' },
}
const ROLE_LABEL: Record<string, string> = {
  DIRECTEUR:     'Directeur',
  REGISSEUR:     'Régisseur',
  RH:            'RH',
  COLLABORATEUR: 'Collaborateur',
}

export function EquipeClient({
  projets,
  canInvite,
}: {
  projets: ProjetLight[]
  canInvite: boolean
}) {
  const [membres, setMembres] = useState<MembreItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const [q, setQ]             = useState('')
  const [contrat, setContrat] = useState('')
  const [projetId, setProjetId] = useState('')

  const [showInvite, setShowInvite] = useState(false)

  const fetchMembres = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q)       params.set('q', q)
      if (contrat) params.set('contrat', contrat)
      if (projetId) params.set('projetId', projetId)
      const res = await fetch(`/api/collaborateurs?${params}`)
      if (!res.ok) throw new Error()
      setMembres(await res.json())
    } catch {
      setError('Impossible de charger l\'annuaire')
    } finally {
      setLoading(false)
    }
  }, [q, contrat, projetId])

  useEffect(() => { fetchMembres() }, [fetchMembres])

  return (
    <div className="p-6">
      {/* ── En-tête ─────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Équipe</h1>
          {!loading && <p className="text-sm text-gray-500 mt-0.5">{membres.length} membre{membres.length > 1 ? 's' : ''}</p>}
        </div>
        {canInvite && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Inviter
          </button>
        )}
      </div>

      {/* ── Filtres ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Rechercher par nom, email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <select
          value={contrat}
          onChange={(e) => setContrat(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">Tous types</option>
          <option value="INTERMITTENT">Intermittent</option>
          <option value="CDD">CDD</option>
          <option value="CDI">CDI</option>
        </select>
        {projets.length > 0 && (
          <select
            value={projetId}
            onChange={(e) => setProjetId(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">Toutes prods</option>
            {projets.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        )}
      </div>

      {/* ── Tableau ─────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Chargement…</p>
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-500 mb-3">⚠️ {error}</p>
          <button onClick={fetchMembres} className="text-sm text-indigo-600 hover:underline">Réessayer</button>
        </div>
      ) : membres.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">👥</p>
          <p className="text-gray-500 text-sm">
            {q || contrat || projetId ? 'Aucun membre ne correspond à votre recherche.' : 'Aucun membre pour le moment.'}
          </p>
          {(q || contrat || projetId) && (
            <button
              onClick={() => { setQ(''); setContrat(''); setProjetId('') }}
              className="mt-2 text-sm text-indigo-600 hover:underline"
            >
              Effacer les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Nom</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Rôle / Type</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Projets actifs</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">DPAE</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {membres.map((m) => (
                <tr key={m.userId} className="hover:bg-gray-50/50 transition-colors">
                  {/* Nom + email */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-semibold text-indigo-700 flex-shrink-0">
                        {m.firstName[0]}{m.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{m.firstName} {m.lastName}</p>
                        <p className="text-xs text-gray-400">{m.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Rôle + contrat */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500">{ROLE_LABEL[m.orgRole] ?? m.orgRole}</span>
                      {m.contractType && (
                        <span className={`inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-medium ${CONTRACT_BADGE[m.contractType]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                          {CONTRACT_BADGE[m.contractType]?.label ?? m.contractType}
                        </span>
                      )}
                      {m.accountStatus === 'GHOST' && (
                        <span className="text-xs text-gray-400 italic">Invitation en attente</span>
                      )}
                    </div>
                  </td>

                  {/* Projets actifs */}
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {m.projetsActifs.slice(0, 3).map((p) => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white font-medium"
                          style={{ backgroundColor: p.colorCode }}
                        >
                          {p.title.length > 12 ? p.title.slice(0, 10) + '…' : p.title}
                        </span>
                      ))}
                      {m.projetsActifs.length === 0 && <span className="text-xs text-gray-400">—</span>}
                    </div>
                  </td>

                  {/* DPAE */}
                  <td className="py-3 px-4">
                    {m.contractType === 'CDI' ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : m.hasDpaeAFaire ? (
                      <span className="text-sm" title="DPAE à soumettre">🟡</span>
                    ) : (
                      <span className="text-sm" title="DPAE à jour">✅</span>
                    )}
                  </td>

                  {/* Lien fiche */}
                  <td className="py-3 px-4 text-right">
                    {m.collaborateurId ? (
                      <Link
                        href={`/equipe/${m.collaborateurId}`}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        ···
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal invitation ────────────────────────────── */}
      {showInvite && (
        <ModalInviter
          onClose={() => setShowInvite(false)}
          onSuccess={() => { setShowInvite(false); fetchMembres() }}
        />
      )}
    </div>
  )
}

// ── Modal d'invitation ──────────────────────────────────
function ModalInviter({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'COLLABORATEUR',
    contractType: 'INTERMITTENT',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/collaborateurs/inviter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Erreur')
      }
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Inviter un membre</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Prénom *</label>
              <input required className="input-field" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="label-field">Nom *</label>
              <input required className="input-field" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label-field">Email *</label>
            <input required type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label-field">Rôle dans l'organisation *</label>
            <select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="COLLABORATEUR">Collaborateur</option>
              <option value="REGISSEUR">Régisseur</option>
              <option value="RH">RH</option>
            </select>
          </div>
          {form.role === 'COLLABORATEUR' && (
            <div>
              <label className="label-field">Type de contrat</label>
              <select className="input-field" value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })}>
                <option value="INTERMITTENT">Intermittent du spectacle</option>
                <option value="CDD">CDD</option>
                <option value="CDI">CDI</option>
              </select>
            </div>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Envoi…' : 'Envoyer l\'invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
