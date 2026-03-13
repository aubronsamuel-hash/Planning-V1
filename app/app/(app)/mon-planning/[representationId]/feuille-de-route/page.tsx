'use client'
// ─────────────────────────────────────────────────────────
// Vue mobile Feuille de route — /mon-planning/[representationId]/feuille-de-route
// Compagnon terrain du collaborateur — mobile-first, lecture seule
// doc/11 §11.1, §11.9.4
// ─────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import Link from 'next/link'

type PhaseType =
  | 'DECHARGEMENT' | 'MONTAGE' | 'BALANCES' | 'CATERING' | 'ECHAUFFEMENT'
  | 'REPRESENTATION' | 'ENTRACTE' | 'DEMONTAGE' | 'PAUSE' | 'AUTRE'

type Phase = {
  id: string; ordre: number; type: PhaseType; labelCustom: string | null
  startTime: string; endTime: string | null; lieu: string | null; notes: string | null
}
type Contact = {
  id: string; nom: string; role: string; type: string
  telephone: string | null; email: string | null
}
type MonAffectation = {
  startTime: string; endTime: string; poste: string
  contractTypeUsed: string; confirmationStatus: string; remuneration: number | null
}
type Data = {
  representation: {
    id: string; date: string; venueName: string | null; venueCity: string | null
    venueAddress: string | null; venueLatLng: string | null
    showStartTime: string | null; showEndTime: string | null
  }
  projet: { id: string; title: string; colorCode: string }
  fdr: { id: string; phases: Phase[]; contacts: Contact[]; notesGenerales: string | null; transportInfo: string | null } | null
  nonDisponible: boolean
  monAffectation: MonAffectation | null
}

const PHASE_ICONS: Record<PhaseType, string> = {
  DECHARGEMENT: '📦', MONTAGE: '🔧', BALANCES: '🎛️', CATERING: '🍽️',
  ECHAUFFEMENT: '🎭', REPRESENTATION: '🎭', ENTRACTE: '⏸️',
  DEMONTAGE: '📦', PAUSE: '☕', AUTRE: '📋',
}
const PHASE_LABELS: Record<PhaseType, string> = {
  DECHARGEMENT: 'Déchargement', MONTAGE: 'Montage', BALANCES: 'Balances / Repet tech',
  CATERING: 'Catering', ECHAUFFEMENT: 'Échauffement', REPRESENTATION: 'Représentation',
  ENTRACTE: 'Entracte', DEMONTAGE: 'Démontage', PAUSE: 'Pause', AUTRE: 'Autre',
}
const CONTRAT_LABELS: Record<string, string> = {
  CDI: 'CDI', CDD: 'CDD', INTERMITTENT: '🟠 Intermittent',
}
const CONFIRM_LABELS: Record<string, string> = {
  CONFIRMEE: '✅ Confirmée', EN_ATTENTE: '🟠 En attente', REFUSEE: '❌ Refusée', NON_REQUISE: '—',
}

function formatTime(t: string) { return t.replace(':', 'h') }

export default function FeuilleDeRouteMobilePage({
  params,
}: {
  params: { representationId: string }
}) {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(true)
  const [cachedAt, setCachedAt] = useState<Date | null>(null)

  useEffect(() => {
    const handleOnline  = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    setIsOnline(navigator.onLine)
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/mon-planning/${params.representationId}/feuille-de-route`)
        if (res.ok) {
          const d = await res.json()
          setData(d)
          setCachedAt(new Date())
          // Persister en localStorage pour accès hors-ligne (§11.9.4)
          try {
            localStorage.setItem(
              `fdr-${params.representationId}`,
              JSON.stringify({ data: d, cachedAt: new Date().toISOString() })
            )
          } catch { /* quota dépassé — silencieux */ }
        } else {
          // Fallback cache local
          loadFromCache()
        }
      } catch {
        // Hors-ligne : charger depuis le cache
        loadFromCache()
      } finally {
        setLoading(false)
      }
    }

    function loadFromCache() {
      try {
        const cached = localStorage.getItem(`fdr-${params.representationId}`)
        if (cached) {
          const { data: d, cachedAt: ca } = JSON.parse(cached)
          setData(d)
          setCachedAt(new Date(ca))
        }
      } catch { /* pas de cache */ }
    }

    load()
  }, [params.representationId])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <p className="text-4xl mb-4">🗺️</p>
      <p className="text-gray-700 font-medium">Feuille de route introuvable</p>
      <Link href="/mon-planning" className="mt-4 text-sm text-indigo-600 hover:underline">← Mon planning</Link>
    </div>
  )

  const { representation, projet, fdr, nonDisponible, monAffectation } = data

  const dateFormatted = new Date(representation.date).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // Lien Maps depuis l'adresse ou latLng
  const mapsUrl = representation.venueLatLng
    ? `https://www.google.com/maps?q=${representation.venueLatLng}`
    : representation.venueAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(representation.venueAddress)}`
      : representation.venueName && representation.venueCity
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${representation.venueName} ${representation.venueCity}`)}`
        : null

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* ── Barre réseau hors-ligne ──────────────────────── */}
      {!isOnline && (
        <div className="bg-orange-500 text-white text-xs text-center py-2 px-4">
          🔴 Hors-ligne · Données mises en cache
          {cachedAt && ` le ${cachedAt.toLocaleDateString('fr-FR')} à ${cachedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
        </div>
      )}

      {/* ── En-tête ─────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <Link href="/mon-planning" className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-2">
          ← Mon planning
        </Link>
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: projet.colorCode }}
          />
          <div>
            <h1 className="font-semibold text-gray-900">{projet.title}</h1>
            <p className="text-sm text-gray-500 capitalize">{dateFormatted}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* ── Lieu + Maps ─────────────────────────────────── */}
        {(representation.venueName || representation.venueCity) && (
          <Card>
            <p className="font-semibold text-gray-900">
              {representation.venueName ?? representation.venueCity}
            </p>
            {representation.venueName && representation.venueCity && (
              <p className="text-sm text-gray-500">{representation.venueCity}</p>
            )}
            {representation.venueAddress && (
              <p className="text-xs text-gray-400 mt-0.5">{representation.venueAddress}</p>
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:underline"
              >
                📍 Ouvrir dans Maps
              </a>
            )}
          </Card>
        )}

        {/* ── Mon rôle ────────────────────────────────────── */}
        {monAffectation ? (
          <Card title="Mon rôle">
            <div className="space-y-1.5">
              <p className="font-semibold text-gray-900">{monAffectation.poste}</p>
              <p className="text-sm text-gray-500">{CONTRAT_LABELS[monAffectation.contractTypeUsed] ?? monAffectation.contractTypeUsed}</p>
              <p className="text-sm text-gray-600">
                Arrivée : {formatTime(monAffectation.startTime)} · Départ : {formatTime(monAffectation.endTime)}
              </p>
              {monAffectation.remuneration != null && monAffectation.remuneration > 0 && (
                <p className="text-sm font-medium text-green-700">
                  Rémunération prévue : {(monAffectation.remuneration / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </p>
              )}
              <p className="text-xs text-gray-400">{CONFIRM_LABELS[monAffectation.confirmationStatus] ?? monAffectation.confirmationStatus}</p>
            </div>
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-gray-500">Vous n'avez pas d'affectation sur cette date.</p>
          </Card>
        )}

        {/* ── Feuille non disponible ───────────────────────── */}
        {nonDisponible && (
          <Card>
            <p className="text-sm text-gray-500 text-center py-2">
              📋 La feuille de route pour cette date n'est pas encore disponible.
            </p>
          </Card>
        )}

        {/* ── Déroulé de la journée ─────────────────────── */}
        {fdr && fdr.phases.length > 0 && (
          <Card title="Déroulé de la journée">
            <div className="space-y-3">
              {fdr.phases.map((phase) => (
                <div key={phase.id} className="flex gap-3">
                  <div className="w-12 text-right flex-shrink-0 pt-0.5">
                    <span className="text-sm font-bold text-gray-900">{formatTime(phase.startTime)}</span>
                  </div>
                  <div className="flex-1 min-w-0 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {PHASE_ICONS[phase.type]} {phase.labelCustom ?? PHASE_LABELS[phase.type]}
                      {phase.endTime && (
                        <span className="font-normal text-gray-400"> ({formatTime(phase.startTime)}–{formatTime(phase.endTime)})</span>
                      )}
                    </p>
                    {phase.lieu && (
                      <p className="text-xs text-gray-500 mt-0.5">{phase.lieu}</p>
                    )}
                    {phase.notes && (
                      <p className="text-xs text-gray-400 italic mt-0.5">{phase.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Transport ────────────────────────────────────── */}
        {fdr?.transportInfo && (
          <Card title="Transport">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{fdr.transportInfo}</p>
          </Card>
        )}

        {/* ── Notes générales ──────────────────────────────── */}
        {fdr?.notesGenerales && (
          <Card title="Notes générales">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{fdr.notesGenerales}</p>
          </Card>
        )}

        {/* ── Contacts locaux ──────────────────────────────── */}
        {fdr && fdr.contacts.length > 0 && (
          <Card title="Contacts locaux">
            <div className="space-y-3">
              {fdr.contacts.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{c.nom}</p>
                    <p className="text-xs text-gray-500">{c.role}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {c.telephone && (
                      <a
                        href={`tel:${c.telephone}`}
                        className="w-9 h-9 rounded-xl bg-green-100 hover:bg-green-200 flex items-center justify-center text-base"
                        title={c.telephone}
                        aria-label={`Appeler ${c.nom}`}
                      >
                        📞
                      </a>
                    )}
                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        className="w-9 h-9 rounded-xl bg-indigo-100 hover:bg-indigo-200 flex items-center justify-center text-base"
                        title={c.email}
                        aria-label={`Envoyer un email à ${c.nom}`}
                      >
                        ✉️
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

      </div>
    </div>
  )
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {title && (
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h2>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
}
