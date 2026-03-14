'use client'

// ─────────────────────────────────────────────────────────
// OrganisationSettingsClient — Client Component principal
// 4 onglets : Informations | Membres | Abonnement | Danger
// ─────────────────────────────────────────────────────────
import { useState } from 'react'
import Link from 'next/link'

type OrgRole = 'DIRECTEUR' | 'REGISSEUR' | 'RH' | 'COLLABORATEUR'

type Membre = {
  id: string
  role: OrgRole
  joinedAt: string | null
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  }
}

type OrgData = {
  id: string
  name: string
  slug: string
  type: string | null
  city: string | null
  plan: 'FREE' | 'PRO' | 'ENTERPRISE'
  isReadOnly: boolean
  suspendedAt: string | null
  suspendedReason: string | null
  paymentFailedAt: string | null
  stripeCustomerId: string | null
  trialEndsAt: string | null
  billingEmail: string | null
  createdAt: string
}

type Props = {
  org: OrgData
  membres: Membre[]
  currentUserId: string
}

const ROLE_LABELS: Record<OrgRole, string> = {
  DIRECTEUR: 'Directeur',
  REGISSEUR: 'Régisseur',
  RH: 'RH',
  COLLABORATEUR: 'Collaborateur',
}

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Gratuit',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
}

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-700',
  PRO: 'bg-indigo-100 text-indigo-700',
  ENTERPRISE: 'bg-purple-100 text-purple-700',
}

const PLAN_LIMITS: Record<string, { collaborateurs: string; projets: string; stockage: string }> = {
  FREE: { collaborateurs: '3', projets: '1 actif', stockage: '500 Mo' },
  PRO: { collaborateurs: '20', projets: 'Illimités', stockage: '5 Go' },
  ENTERPRISE: { collaborateurs: 'Illimités', projets: 'Illimités', stockage: '50 Go' },
}

const ORG_TYPES = [
  { value: 'THEATRE', label: 'Théâtre' },
  { value: 'COMPAGNIE', label: 'Compagnie' },
  { value: 'PRODUCTEUR', label: 'Producteur' },
  { value: 'FESTIVAL', label: 'Festival' },
  { value: 'AUTRE', label: 'Autre' },
]

type Tab = 'informations' | 'membres' | 'abonnement' | 'danger'

export default function OrganisationSettingsClient({ org, membres, currentUserId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('informations')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'informations', label: 'Informations' },
    { key: 'membres', label: 'Membres' },
    { key: 'abonnement', label: 'Abonnement' },
    { key: 'danger', label: 'Danger' },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* En-tête */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Paramètres de l&apos;organisation</h1>
        <p className="text-sm text-gray-500 mt-1">{org.name}</p>
      </div>

      {/* Bannière suspension */}
      {org.suspendedAt && (
        <div className="mb-6 bg-red-50 border border-red-300 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700 font-medium">
            Compte suspendu — {org.suspendedReason ?? 'Contactez le support'}
          </p>
        </div>
      )}

      {/* Bannière isReadOnly */}
      {!org.suspendedAt && org.isReadOnly && (
        <div className="mb-6 bg-orange-50 border border-orange-300 rounded-lg px-4 py-3">
          <p className="text-sm text-orange-700 font-medium">
            Organisation en lecture seule. Mettez à niveau votre abonnement pour reprendre les modifications.
          </p>
        </div>
      )}

      {/* Onglets */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } ${tab.key === 'danger' ? 'text-red-500 hover:text-red-600 hover:border-red-300' : ''}`}
            >
              {tab.label}
            </button>
          ))}
          {/* Lien Flotte (ENTERPRISE) — page dédiée */}
          {org.plan === 'ENTERPRISE' && (
            <Link
              href="/settings/organisation/flotte"
              className="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
            >
              🚌 Flotte
            </Link>
          )}
        </nav>
      </div>

      {/* Contenu des onglets */}
      {activeTab === 'informations' && (
        <OngletInformations org={org} />
      )}
      {activeTab === 'membres' && (
        <OngletMembres membres={membres} orgId={org.id} currentUserId={currentUserId} />
      )}
      {activeTab === 'abonnement' && (
        <OngletAbonnement org={org} />
      )}
      {activeTab === 'danger' && (
        <OngletDanger org={org} />
      )}
    </div>
  )
}

// ── Onglet Informations ────────────────────────────────────
function OngletInformations({ org }: { org: OrgData }) {
  const [form, setForm] = useState({
    name: org.name,
    type: org.type ?? '',
    city: org.city ?? '',
    billingEmail: org.billingEmail ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/settings/organisation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error ?? 'Une erreur est survenue' })
      } else {
        setMessage({ type: 'success', text: 'Informations mises à jour avec succès.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau. Veuillez réessayer.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nom de l&apos;organisation <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          minLength={2}
          maxLength={100}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">-- Choisir --</option>
          {ORG_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
        <input
          type="text"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          maxLength={100}
          placeholder="Paris"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email de facturation</label>
        <input
          type="email"
          value={form.billingEmail}
          onChange={(e) => setForm({ ...form, billingEmail: e.target.value })}
          placeholder="facturation@monorg.fr"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <p className="text-xs text-gray-400">Slug : <span className="font-mono">{org.slug}</span> (non modifiable)</p>
      </div>
    </form>
  )
}

// ── Onglet Membres ─────────────────────────────────────────
function OngletMembres({
  membres,
  orgId,
  currentUserId,
}: {
  membres: Membre[]
  orgId: string
  currentUserId: string
}) {
  const [list, setList] = useState(membres)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OrgRole>('COLLABORATEUR')
  const [inviting, setSending] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setInviteMsg(null)
    try {
      const res = await fetch('/api/collaborateurs/inviter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        setInviteMsg({ type: 'error', text: data.error ?? 'Erreur lors de l\'invitation' })
      } else {
        setInviteMsg({ type: 'success', text: `Invitation envoyée à ${inviteEmail}.` })
        setInviteEmail('')
      }
    } catch {
      setInviteMsg({ type: 'error', text: 'Erreur réseau.' })
    } finally {
      setSending(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: OrgRole) {
    try {
      const res = await fetch(`/api/settings/organisation/membres/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        setList((prev) =>
          prev.map((m) => (m.user.id === userId ? { ...m, role: newRole } : m))
        )
      }
    } catch {
      // Erreur silencieuse — l'utilisateur peut réessayer
    }
  }

  async function handleRetirer(userId: string) {
    if (!confirm('Retirer ce membre de l\'organisation ?')) return
    try {
      const res = await fetch(`/api/settings/organisation/membres/${userId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setList((prev) => prev.filter((m) => m.user.id !== userId))
      }
    } catch {
      // Erreur silencieuse
    }
  }

  return (
    <div className="space-y-6">
      {/* Formulaire d'invitation */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Inviter un membre</h2>
        <form onSubmit={handleInvite} className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              placeholder="jean@compagnie.fr"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Rôle</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as OrgRole)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {(Object.keys(ROLE_LABELS) as OrgRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting}
            className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {inviting ? 'Envoi…' : 'Inviter'}
          </button>
        </form>
        {inviteMsg && (
          <p className={`mt-3 text-sm ${inviteMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {inviteMsg.text}
          </p>
        )}
      </div>

      {/* Liste des membres */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">{list.length} membre{list.length > 1 ? 's' : ''}</h2>
        </div>
        <ul className="divide-y divide-gray-50">
          {list.map((m) => {
            const displayName =
              m.user.firstName || m.user.lastName
                ? `${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim()
                : m.user.email
            const isMe = m.user.id === currentUserId
            const isPending = m.joinedAt === null

            return (
              <li key={m.id} className="flex items-center gap-4 px-5 py-3">
                {/* Avatar initiales */}
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-semibold flex-shrink-0">
                  {(m.user.firstName?.[0] ?? m.user.email[0]).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {displayName}
                    {isMe && <span className="ml-2 text-xs text-gray-400">(vous)</span>}
                    {isPending && <span className="ml-2 text-xs text-orange-500">Invitation en attente</span>}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{m.user.email}</p>
                </div>

                {/* Sélecteur de rôle */}
                <select
                  value={m.role}
                  onChange={(e) => handleRoleChange(m.user.id, e.target.value as OrgRole)}
                  disabled={isMe}
                  className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {(Object.keys(ROLE_LABELS) as OrgRole[]).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>

                {/* Bouton retirer */}
                {!isMe && (
                  <button
                    onClick={() => handleRetirer(m.user.id)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium flex-shrink-0"
                  >
                    Retirer
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

// ── Onglet Abonnement ──────────────────────────────────────
function OngletAbonnement({ org }: { org: OrgData }) {
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [selectingPlan, setSelectingPlan] = useState<'PRO' | 'ENTERPRISE' | null>(null)
  const [portalError, setPortalError] = useState<string | null>(null)

  const limits = PLAN_LIMITS[org.plan]

  async function handlePortal() {
    setLoadingPortal(true)
    setPortalError(null)
    try {
      const res = await fetch('/api/billing/portal')
      const data = await res.json()
      if (!res.ok) {
        setPortalError(data.error ?? 'Erreur lors de la redirection')
      } else {
        window.location.href = data.portalUrl
      }
    } catch {
      setPortalError('Erreur réseau.')
    } finally {
      setLoadingPortal(false)
    }
  }

  async function handleChoisirPlan(plan: 'PRO' | 'ENTERPRISE') {
    setSelectingPlan(plan)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Erreur lors de la création du paiement')
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    } catch {
      alert('Erreur réseau.')
    } finally {
      setSelectingPlan(null)
      setShowPlanModal(false)
    }
  }

  const trialDaysLeft = org.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(org.trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : null

  return (
    <div className="space-y-6 max-w-lg">
      {/* Plan actuel */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Plan actuel</h2>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PLAN_COLORS[org.plan]}`}>
            {PLAN_LABELS[org.plan]}
          </span>
        </div>

        {trialDaysLeft !== null && trialDaysLeft >= 0 && (
          <p className="text-sm text-orange-600 mb-3">
            Période d&apos;essai : {trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''} restant{trialDaysLeft > 1 ? 's' : ''}
          </p>
        )}

        {org.paymentFailedAt && (
          <p className="text-sm text-red-600 mb-3">
            Paiement en échec depuis le {new Date(org.paymentFailedAt).toLocaleDateString('fr-FR')}.
            Mettez à jour votre moyen de paiement.
          </p>
        )}

        <dl className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <dt className="text-xs text-gray-500">Collaborateurs</dt>
            <dd className="text-sm font-medium text-gray-900">{limits.collaborateurs}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Projets</dt>
            <dd className="text-sm font-medium text-gray-900">{limits.projets}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Stockage</dt>
            <dd className="text-sm font-medium text-gray-900">{limits.stockage}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">DPAE</dt>
            <dd className="text-sm font-medium text-gray-900">
              {org.plan !== 'FREE' ? 'Inclus' : 'Non inclus'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Actions */}
      {portalError && (
        <p className="text-sm text-red-600">{portalError}</p>
      )}

      {org.stripeCustomerId ? (
        <button
          onClick={handlePortal}
          disabled={loadingPortal}
          className="w-full bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loadingPortal ? 'Redirection…' : 'Gérer l\'abonnement (Portail Stripe)'}
        </button>
      ) : (
        <button
          onClick={() => setShowPlanModal(true)}
          className="w-full bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Choisir un plan
        </button>
      )}

      {/* Modal choix de plan */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Choisir un plan</h2>
              <button onClick={() => setShowPlanModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Plan PRO */}
              <div className="border-2 border-indigo-200 rounded-xl p-5 hover:border-indigo-400 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">Pro</h3>
                  <span className="text-indigo-700 font-bold">49 €/mois</span>
                </div>
                <ul className="text-sm text-gray-600 space-y-1 mb-4">
                  <li>20 collaborateurs</li>
                  <li>Projets illimités</li>
                  <li>5 Go de stockage</li>
                  <li>DPAE, exports CSV</li>
                </ul>
                <button
                  onClick={() => handleChoisirPlan('PRO')}
                  disabled={selectingPlan !== null}
                  className="w-full bg-indigo-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {selectingPlan === 'PRO' ? 'Redirection…' : 'Choisir Pro'}
                </button>
              </div>

              {/* Plan ENTERPRISE */}
              <div className="border-2 border-purple-200 rounded-xl p-5 hover:border-purple-400 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">Enterprise</h3>
                  <span className="text-purple-700 font-bold">149 €/mois</span>
                </div>
                <ul className="text-sm text-gray-600 space-y-1 mb-4">
                  <li>Collaborateurs illimités</li>
                  <li>Projets illimités</li>
                  <li>50 Go de stockage</li>
                  <li>Module tournée inclus</li>
                </ul>
                <button
                  onClick={() => handleChoisirPlan('ENTERPRISE')}
                  disabled={selectingPlan !== null}
                  className="w-full bg-purple-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {selectingPlan === 'ENTERPRISE' ? 'Redirection…' : 'Choisir Enterprise'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Onglet Danger ──────────────────────────────────────────
function OngletDanger({ org }: { org: OrgData }) {
  const [confirmName, setConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isConfirmed = confirmName === org.name

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault()
    if (!isConfirmed) return
    if (!confirm(`Supprimer définitivement ${org.name} ? Cette action est irréversible.`)) return

    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/organisation', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmName }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erreur lors de la suppression')
      } else if (data.redirectTo) {
        window.location.href = data.redirectTo
      }
    } catch {
      setError('Erreur réseau.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="bg-red-50 border border-red-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-red-700 mb-2">Supprimer l&apos;organisation</h2>
        <p className="text-sm text-red-600 mb-4">
          Cette action est <strong>irréversible</strong>. Toutes les données (projets, représentations,
          affectations, collaborateurs) seront définitivement supprimées. L&apos;abonnement Stripe sera annulé.
        </p>

        <form onSubmit={handleDelete} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Pour confirmer, tapez le nom exact de l&apos;organisation :{' '}
              <span className="font-semibold font-mono">{org.name}</span>
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={org.name}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={!isConfirmed || deleting}
            className="bg-red-600 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {deleting ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </form>
      </div>
    </div>
  )
}
