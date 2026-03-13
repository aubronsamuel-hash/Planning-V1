'use client'
// ─────────────────────────────────────────────────────────
// Page /mon-planning — Planning personnel du collaborateur
// doc/04 §6.5 — vue liste chronologique + rémunération
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type AffectationPerso = {
  id: string
  date: string
  showStartTime: string | null
  venueName: string | null
  venueCity: string | null
  projetId: string
  projetTitle: string
  projetColorCode: string
  poste: string
  contractTypeUsed: string
  confirmationStatus: string
  startTime: string
  endTime: string
  remuneration: number | null
  hasConflict: boolean
}

const CONFIRMATION_BADGE: Record<string, { label: string; style: string }> = {
  CONFIRMEE:    { label: '✅ Confirmée',   style: 'bg-green-100 text-green-700' },
  EN_ATTENTE:   { label: '🟠 À confirmer', style: 'bg-orange-100 text-orange-700' },
  REFUSEE:      { label: '❌ Refusée',     style: 'bg-red-100 text-red-700' },
  NON_REQUISE:  { label: '—',              style: 'bg-gray-100 text-gray-500' },
  ANNULEE:      { label: 'Annulée',        style: 'bg-gray-100 text-gray-400' },
}

function getMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function addMonths(m: string, n: number) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + n, 1)
  return getMonthStr(d)
}
function formatMonthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number)
  const label = new Date(y, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function MonPlanningPage() {
  const [month, setMonth] = useState(getMonthStr(new Date()))
  const [affectations, setAffectations] = useState<AffectationPerso[]>([])
  const [remunerationMois, setRemunerationMois] = useState(0)
  const [enAttente, setEnAttente]               = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/mon-planning?month=${month}`)
      const data = await res.json()
      setAffectations(data.affectations ?? [])
      setRemunerationMois(data.remunerationMois ?? 0)
      setEnAttente(data.enAttente ?? 0)
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { fetchData() }, [fetchData])

  const avenir   = affectations.filter((a) => new Date(a.date) >= new Date() && a.confirmationStatus !== 'ANNULEE')
  const passes   = affectations.filter((a) => new Date(a.date) < new Date()  && a.confirmationStatus !== 'ANNULEE')

  return (
    <div className="p-6">
      {/* ── En-tête ─────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Mon planning</h1>

        {/* Navigation mois */}
        <div className="flex items-center gap-3">
          <button onClick={() => setMonth(addMonths(month, -1))} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">‹</button>
          <span className="text-base font-semibold text-gray-900 min-w-40 text-center">{formatMonthLabel(month)}</span>
          <button onClick={() => setMonth(addMonths(month, 1))}  className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">›</button>
          <button onClick={() => setMonth(getMonthStr(new Date()))} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            Aujourd'hui
          </button>
        </div>
      </div>

      {/* ── Bannière en attente ──────────────────────────── */}
      {enAttente > 0 && (
        <div className="mb-5 flex items-center justify-between gap-4 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-sm">
          <span className="text-orange-800 font-medium">
            🟠 {enAttente} date{enAttente > 1 ? 's attendent' : ' attend'} votre confirmation
          </span>
          <Link
            href="/affectation"
            className="text-orange-700 hover:text-orange-900 font-semibold text-sm"
          >
            Répondre →
          </Link>
        </div>
      )}

      {/* ── Stats du mois ────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-indigo-600">{affectations.filter((a) => a.confirmationStatus !== 'ANNULEE').length}</p>
          <p className="text-xs text-gray-500 mt-1">Représentations</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">
            {(remunerationMois / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">Prévisionnel</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{enAttente}</p>
          <p className="text-xs text-gray-500 mt-1">En attente</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Chargement…</p>
        </div>
      ) : affectations.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">📅</p>
          <p className="text-gray-500 text-sm">Aucune représentation ce mois-ci.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Dates à venir */}
          {avenir.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">À venir</h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                {avenir.map((a) => <AffectationRow key={a.id} a={a} />)}
              </div>
            </div>
          )}

          {/* Dates passées */}
          {passes.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Passées</h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50 opacity-60">
                {passes.map((a) => <AffectationRow key={a.id} a={a} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AffectationRow({ a }: { a: AffectationPerso }) {
  const badge = CONFIRMATION_BADGE[a.confirmationStatus] ?? { label: a.confirmationStatus, style: 'bg-gray-100 text-gray-500' }
  const date  = new Date(a.date)

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-gray-50/50 transition-colors">
      {/* Bande couleur projet */}
      <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: a.projetColorCode }} />

      {/* Date */}
      <div className="flex-shrink-0 text-center w-12">
        <p className="text-xs font-semibold text-gray-400 uppercase">
          {date.toLocaleDateString('fr-FR', { weekday: 'short' })}
        </p>
        <p className="text-lg font-bold text-gray-900">{date.getDate()}</p>
        <p className="text-xs text-gray-400">{date.toLocaleDateString('fr-FR', { month: 'short' })}</p>
      </div>

      {/* Détails */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{a.projetTitle}</p>
        <p className="text-sm text-gray-500">{a.poste}</p>
        <p className="text-xs text-gray-400">
          {a.showStartTime && `${a.showStartTime.replace(':', 'h')} `}
          {a.venueName && `· ${a.venueName}`}
          {a.venueCity && `, ${a.venueCity}`}
        </p>
      </div>

      {/* Statut + rémunération */}
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.style}`}>
          {badge.label}
        </span>
        {a.remuneration != null && a.remuneration > 0 && (
          <span className="text-sm font-medium text-gray-700">
            {(a.remuneration / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </span>
        )}
        {a.hasConflict && (
          <span className="text-xs text-orange-600" title="Conflit horaire détecté">⚠️ Conflit</span>
        )}
      </div>

      {/* Lien projet */}
      <Link
        href={`/projets/${a.projetId}?onglet=planning`}
        className="text-indigo-400 hover:text-indigo-600 flex-shrink-0"
      >
        →
      </Link>
    </div>
  )
}
