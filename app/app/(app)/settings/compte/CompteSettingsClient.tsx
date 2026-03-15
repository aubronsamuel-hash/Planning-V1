'use client'

// ─────────────────────────────────────────────────────────
// CompteSettingsClient — Paramètres compte utilisateur
// 4 sections : Profil | Sécurité | Préférences | Calendrier
// ─────────────────────────────────────────────────────────
import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'

type UserData = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  timezone: string
  emailPreferences: Record<string, boolean>
}

type Props = {
  user: UserData
  icalUrl: string | null
}

type Tab = 'profil' | 'securite' | 'preferences' | 'calendrier'

const TIMEZONES = [
  'Europe/Paris',
  'Europe/Brussels',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'America/Montreal',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
]

const EMAIL_PREFS_LABELS: Record<string, string> = {
  affectationNouvelle: 'Nouvelle affectation',
  affectationModifiee: 'Modification d\'affectation',
  affectationAnnulee: 'Annulation d\'affectation',
  relanceConfirmation: 'Relance de confirmation',
  invitationOrg: 'Invitation dans une organisation',
  rappelDPAE: 'Rappel DPAE à faire',
}

export default function CompteSettingsClient({ user, icalUrl: initialIcalUrl }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('profil')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profil', label: 'Profil' },
    { key: 'securite', label: 'Sécurité' },
    { key: 'preferences', label: 'Préférences' },
    { key: 'calendrier', label: 'Calendrier' },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Mon compte</h1>
        <p className="text-sm text-gray-500 mt-1">{user.email}</p>
      </div>

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
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'profil' && <OngletProfil user={user} />}
      {activeTab === 'securite' && <OngletSecurite email={user.email} />}
      {activeTab === 'preferences' && (
        <OngletPreferences
          timezone={user.timezone}
          emailPreferences={user.emailPreferences}
        />
      )}
      {activeTab === 'calendrier' && (
        <OngletCalendrier icalUrl={initialIcalUrl} />
      )}
    </div>
  )
}

// ── Onglet Profil ──────────────────────────────────────────
function OngletProfil({ user }: { user: UserData }) {
  const { success, error: toastError } = useToast()
  const [form, setForm] = useState({
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    phone: user.phone ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showEmailChange, setShowEmailChange] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailMsg, setEmailMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSaveProfil(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName || null,
          lastName: form.lastName || null,
          phone: form.phone || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        const msg = data.error ?? 'Erreur lors de la mise à jour'
        setMessage({ type: 'error', text: msg })
        toastError('Mise à jour échouée', msg)
      } else {
        setMessage({ type: 'success', text: 'Profil mis à jour avec succès.' })
        success('Profil mis à jour')
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau.' })
      toastError('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault()
    setEmailSending(true)
    setEmailMsg(null)
    try {
      const res = await fetch('/api/me/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEmailMsg({ type: 'error', text: data.error ?? 'Erreur lors de la demande' })
        toastError('Demande échouée', data.error ?? 'Erreur lors de la demande')
      } else {
        setEmailMsg({ type: 'success', text: `Un lien de confirmation a été envoyé à ${newEmail}.` })
        success('Email de confirmation envoyé', `Vérifiez votre boîte ${newEmail}`)
        setNewEmail('')
      }
    } catch {
      setEmailMsg({ type: 'error', text: 'Erreur réseau.' })
      toastError('Erreur réseau')
    } finally {
      setEmailSending(false)
    }
  }

  return (
    <form onSubmit={handleSaveProfil} className="space-y-5 max-w-md">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
          <input
            type="text"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            maxLength={50}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
          <input
            type="text"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            maxLength={50}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Email (readonly) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Adresse email</label>
        <div className="flex items-center gap-3">
          <input
            type="email"
            value={user.email}
            readOnly
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() => setShowEmailChange(!showEmailChange)}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap"
          >
            Changer
          </button>
        </div>

        {showEmailChange && (
          <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 mb-3">
              Un lien de confirmation sera envoyé à la nouvelle adresse avant le changement.
            </p>
            <form onSubmit={handleEmailChange} className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                placeholder="nouvel@email.fr"
                className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={emailSending}
                className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {emailSending ? 'Envoi…' : 'Envoyer'}
              </button>
            </form>
            {emailMsg && (
              <p className={`mt-2 text-xs ${emailMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {emailMsg.text}
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          maxLength={20}
          placeholder="+33 6 12 34 56 78"
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

      <button
        type="submit"
        disabled={saving}
        className="btn btn-primary"
      >
        {saving ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Enregistrement…
          </>
        ) : 'Enregistrer le profil'}
      </button>
    </form>
  )
}

// ── Onglet Sécurité ────────────────────────────────────────
function OngletSecurite({ email }: { email: string }) {
  const [loggingOut, setLoggingOut] = useState(false)
  const [done, setDone] = useState(false)

  async function handleLogoutAll() {
    if (!confirm('Se déconnecter de toutes les sessions actives ?')) return
    setLoggingOut(true)
    try {
      // Appel hypothétique — l'API invalidera tous les tokens de session
      await fetch('/api/me/sessions/revoke-all', { method: 'POST' })
      setDone(true)
    } catch {
      // Erreur silencieuse
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="max-w-md space-y-6">
      {/* Connexion magic link */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="text-2xl">&#x1F517;</div>
          <div>
            <h3 className="text-sm font-semibold text-indigo-800 mb-1">
              Connexion par lien magique
            </h3>
            <p className="text-sm text-indigo-700">
              Votre compte <strong>{email}</strong> utilise l&apos;authentification par lien magique.
              Il n&apos;y a pas de mot de passe à gérer. Un lien de connexion sécurisé est envoyé
              à votre adresse email à chaque connexion.
            </p>
          </div>
        </div>
      </div>

      {/* Déconnexion globale */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Sessions actives</h3>
        <p className="text-sm text-gray-500 mb-4">
          Déconnectez-vous de tous les appareils sur lesquels vous êtes actuellement connecté(e).
        </p>
        {done ? (
          <p className="text-sm text-green-600">
            Toutes les sessions ont été révoquées. Vous serez redirigé(e) à votre prochaine action.
          </p>
        ) : (
          <button
            onClick={handleLogoutAll}
            disabled={loggingOut}
            className="bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors"
          >
            {loggingOut ? 'Déconnexion…' : 'Se déconnecter de partout'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Onglet Préférences ─────────────────────────────────────
function OngletPreferences({
  timezone: initialTimezone,
  emailPreferences: initialPrefs,
}: {
  timezone: string
  emailPreferences: Record<string, boolean>
}) {
  const { success, error: toastError } = useToast()
  const [timezone, setTimezone] = useState(initialTimezone)
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    affectationNouvelle: true,
    affectationModifiee: true,
    affectationAnnulee: true,
    relanceConfirmation: true,
    invitationOrg: true,
    rappelDPAE: true,
    ...initialPrefs,
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone, emailPreferences: prefs }),
      })
      if (!res.ok) {
        const data = await res.json()
        const msg = data.error ?? 'Erreur lors de la sauvegarde'
        setMessage({ type: 'error', text: msg })
        toastError('Sauvegarde échouée', msg)
      } else {
        setMessage({ type: 'success', text: 'Préférences mises à jour.' })
        success('Préférences mises à jour')
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau.' })
      toastError('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  function togglePref(key: string) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <form onSubmit={handleSave} className="max-w-md space-y-6">
      {/* Fuseau horaire */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fuseau horaire</label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      {/* Préférences email */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Notifications par email</h3>
        <div className="space-y-2">
          {Object.entries(EMAIL_PREFS_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={prefs[key] ?? true}
                onChange={() => togglePref(key)}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
            </label>
          ))}
        </div>
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

      <button
        type="submit"
        disabled={saving}
        className="btn btn-primary"
      >
        {saving ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Enregistrement…
          </>
        ) : 'Enregistrer les préférences'}
      </button>
    </form>
  )
}

// ── Onglet Calendrier ──────────────────────────────────────
function OngletCalendrier({ icalUrl: initialIcalUrl }: { icalUrl: string | null }) {
  const { success, error: toastError } = useToast()
  const [icalUrl, setIcalUrl] = useState<string | null>(initialIcalUrl)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/me/ical/regenerate', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error ?? 'Erreur lors de la génération'
        setError(msg)
        toastError('Génération échouée', msg)
      } else {
        setIcalUrl(data.icalUrl)
        success('Lien iCal généré', 'Copiez-le pour l\'ajouter à votre calendrier')
      }
    } catch {
      setError('Erreur réseau.')
      toastError('Erreur réseau')
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy() {
    if (!icalUrl) return
    try {
      await navigator.clipboard.writeText(icalUrl)
      setCopied(true)
      success('Lien copié dans le presse-papier')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback : sélectionner le texte
      const input = document.getElementById('ical-url-input') as HTMLInputElement
      if (input) {
        input.select()
        document.execCommand('copy')
        setCopied(true)
        success('Lien copié dans le presse-papier')
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  return (
    <div className="max-w-lg space-y-5">
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Flux iCal personnel</h3>
        <p className="text-sm text-gray-500 mb-4">
          Abonnez-vous à ce flux dans votre application calendrier (Google Calendar, Apple Calendar,
          Outlook…) pour voir vos affectations confirmées en temps réel.
        </p>

        {icalUrl ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                id="ical-url-input"
                type="text"
                value={icalUrl}
                readOnly
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono bg-white focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
              >
                {copied ? 'Copie !' : 'Copier'}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Seules les affectations au statut CONFIRMEE sont exportées.
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-4">
            Vous n&apos;avez pas encore de lien iCal. Générez-en un pour l&apos;utiliser dans votre calendrier.
          </p>
        )}

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="btn btn-secondary mt-4"
        >
          {generating ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Génération…
            </>
          ) : icalUrl
            ? "Régénérer le lien (invalide l'ancien)"
            : 'Générer le lien iCal'}
        </button>

        {icalUrl && (
          <p className="text-xs text-orange-600 mt-2">
            Régénérer le lien invalidera immédiatement l&apos;ancien.
            Pensez à mettre à jour votre calendrier.
          </p>
        )}
      </div>
    </div>
  )
}
