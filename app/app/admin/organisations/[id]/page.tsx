'use client'
// ─────────────────────────────────────────────────────────
// /admin/organisations/[id] — Fiche organisation
// doc/17-back-office-super-admin.md §17.5
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Member = {
  id: string
  role: string
  joinedAt: string | null
  user: { id: string; email: string; firstName: string; lastName: string }
}

type Log = {
  id: string
  action: string
  createdAt: string
  user: { email: string; firstName: string; lastName: string } | null
}

type OrgDetail = {
  id: string
  name: string
  slug: string
  type: string
  plan: string
  city: string | null
  stripeCustomerId: string | null
  billingEmail: string | null
  isReadOnly: boolean
  suspendedAt: string | null
  suspendedReason: string | null
  paymentFailedAt: string | null
  createdAt: string
  memberships: Member[]
  activityLogs: Log[]
  _count: { projets: number; affectations: number }
}

const PLAN_COLORS: Record<string, string> = {
  FREE:       'bg-gray-100 text-gray-600',
  PRO:        'bg-indigo-100 text-indigo-700',
  ENTERPRISE: 'bg-purple-100 text-purple-700',
}

const ROLE_LABELS: Record<string, string> = {
  DIRECTEUR:   'Directeur',
  REGISSEUR:   'Régisseur',
  RH:          'RH',
  CHEF_POSTE:  'Chef de poste',
  COLLABORATEUR: 'Collaborateur',
  MEMBRE:      'Membre',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ── Modal Changer le plan ────────────────────────────────
function ChangePlanModal({ org, onClose, onDone }: { org: OrgDetail; onClose: () => void; onDone: () => void }) {
  const [plan, setPlan]     = useState(org.plan)
  const [raison, setRaison] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (plan === org.plan) { onClose(); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/organisations/${org.id}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, raison }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Erreur lors du changement de plan.')
        return
      }
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Changer le plan — {org.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500">Plan actuel : <span className="font-semibold text-gray-900">{org.plan}</span></p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="FREE">Gratuit (FREE)</option>
              <option value="PRO">Pro (PRO)</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Raison interne (non visible par le client)</label>
            <input
              type="text"
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              placeholder="Ex: accord commercial — réunion 27/02"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-sm text-amber-800">Le changement est effectif immédiatement.</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
            <button
              type="submit"
              disabled={saving || plan === org.plan}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Confirmer le changement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal Suspendre ──────────────────────────────────────
function SuspendreModal({ org, onClose, onDone }: { org: OrgDetail; onClose: () => void; onDone: () => void }) {
  const [raison, setRaison] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!raison.trim()) { setError('La raison est obligatoire.'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/organisations/${org.id}/suspendre`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raison }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Erreur lors de la suspension.')
        return
      }
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Suspendre {org.name} ?</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            Les membres ne pourront plus se connecter. Les données sont conservées. La suspension est réversible.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Raison <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              placeholder="Ex: impayé — relance envoyée le 25/02"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? 'Suspension…' : "Suspendre l'organisation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal Supprimer ──────────────────────────────────────
function SupprimerModal({ org, onClose, onDone }: { org: OrgDetail; onClose: () => void; onDone: () => void }) {
  const [raison, setRaison]       = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!confirmed) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/organisations/${org.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raison }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Erreur lors de la suppression.')
        return
      }
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Supprimer {org.name} ?</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-sm font-medium text-red-800">⚠️ Action irréversible. Supprime toutes les données.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Raison</label>
            <input
              type="text"
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              placeholder="Ex: demande de suppression RGPD"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm text-gray-700">Je confirme la suppression définitive de cette organisation</span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
            <button
              type="submit"
              disabled={saving || !confirmed}
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? 'Suppression…' : 'Supprimer définitivement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page principale ──────────────────────────────────────
export default function AdminOrgDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [org, setOrg]           = useState<OrgDetail | null>(null)
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<'plan' | 'suspendre' | 'supprimer' | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/organisations/${id}`)
      if (res.ok) setOrg(await res.json())
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleReactiver() {
    await fetch(`/api/admin/organisations/${id}/reactiver`, { method: 'POST' })
    load()
  }

  if (loading) {
    return (
      <>
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6">
          <div className="w-48 h-4 bg-gray-200 rounded animate-pulse" />
        </header>
        <main className="flex-1 p-6">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mt-20" />
        </main>
      </>
    )
  }

  if (!org) {
    return (
      <>
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6">
          <p className="text-sm text-gray-500">Organisation introuvable</p>
        </header>
        <main className="flex-1 p-6">
          <Link href="/admin/organisations" className="text-sm text-indigo-600 hover:text-indigo-800">← Retour</Link>
        </main>
      </>
    )
  }

  const directeurs = org.memberships.filter((m) => m.role === 'DIRECTEUR')

  return (
    <>
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-3 flex-shrink-0">
        <Link href="/admin/organisations" className="text-sm text-gray-500 hover:text-gray-700">← Organisations</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-lg font-semibold text-gray-900 flex-1">{org.name}</h1>

        {/* Menu actions */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            ⚙️ Actions ▾
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
              <button
                onClick={() => { setModal('plan'); setMenuOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Changer le plan
              </button>
              <div className="border-t border-gray-100" />
              {org.suspendedAt ? (
                <button
                  onClick={() => { handleReactiver(); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-green-700 hover:bg-green-50"
                >
                  Réactiver l&apos;organisation
                </button>
              ) : (
                <button
                  onClick={() => { setModal('suspendre'); setMenuOpen(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-orange-700 hover:bg-orange-50"
                >
                  Suspendre l&apos;organisation
                </button>
              )}
              <div className="border-t border-gray-100" />
              <button
                onClick={() => { setModal('supprimer'); setMenuOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-700 hover:bg-red-50"
              >
                Supprimer l&apos;organisation
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Alertes actives */}
        {org.suspendedAt && (
          <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-red-800 font-medium">
              🔴 Organisation suspendue depuis le {formatDate(org.suspendedAt)}
              {org.suspendedReason && <span className="font-normal"> — {org.suspendedReason}</span>}
            </p>
            <button onClick={handleReactiver} className="text-sm font-medium text-red-700 underline">Réactiver</button>
          </div>
        )}

        {/* Infos + Usage */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Informations</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Slug</dt><dd className="text-gray-900 font-mono text-xs">{org.slug}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Ville</dt><dd className="text-gray-900">{org.city ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Plan</dt>
                <dd><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLAN_COLORS[org.plan] ?? 'bg-gray-100 text-gray-600'}`}>{org.plan}</span></dd>
              </div>
              <div className="flex justify-between"><dt className="text-gray-500">Stripe ID</dt><dd className="text-gray-900 font-mono text-xs">{org.stripeCustomerId ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Email facturation</dt><dd className="text-gray-900">{org.billingEmail ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Créée le</dt><dd className="text-gray-900">{formatDate(org.createdAt)}</dd></div>
            </dl>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Usage</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Projets actifs</dt><dd className="text-gray-900 font-semibold">{org._count.projets}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Membres</dt><dd className="text-gray-900 font-semibold">{org.memberships.length}</dd></div>
            </dl>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Directeurs</h3>
              {directeurs.length === 0 ? (
                <p className="text-sm text-red-600">⚠️ Aucun Directeur actif</p>
              ) : (
                <ul className="space-y-1">
                  {directeurs.map((m) => (
                    <li key={m.id} className="text-sm text-gray-700">
                      {m.user.firstName} {m.user.lastName} · <span className="text-gray-500">{m.user.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Membres */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Membres ({org.memberships.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rôle</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {org.memberships.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2.5 text-gray-900">{m.user.firstName} {m.user.lastName}</td>
                  <td className="px-4 py-2.5 text-gray-500">{m.user.email}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                      {ROLE_LABELS[m.role] ?? m.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {m.joinedAt
                      ? <span className="text-xs text-green-700">Active</span>
                      : <span className="text-xs text-gray-400">En attente</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Logs récents */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Activité récente</h2>
            <Link href={`/admin/logs?organizationId=${org.id}`} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
              Voir tout →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {org.activityLogs.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400">Aucune activité récente.</p>
            ) : (
              org.activityLogs.map((log) => (
                <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                  <span className="text-xs text-gray-400 w-32 flex-shrink-0 mt-0.5">{formatDateTime(log.createdAt)}</span>
                  <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded flex-shrink-0">{log.action}</span>
                  {log.user && (
                    <span className="text-xs text-gray-500">{log.user.firstName} {log.user.lastName}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      {modal === 'plan'      && <ChangePlanModal org={org} onClose={() => setModal(null)} onDone={() => { setModal(null); load() }} />}
      {modal === 'suspendre' && <SuspendreModal  org={org} onClose={() => setModal(null)} onDone={() => { setModal(null); load() }} />}
      {modal === 'supprimer' && <SupprimerModal  org={org} onClose={() => setModal(null)} onDone={() => { setModal(null); router.push('/admin/organisations') }} />}
    </>
  )
}
