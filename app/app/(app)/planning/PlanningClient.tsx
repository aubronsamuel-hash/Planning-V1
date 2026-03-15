'use client'
// ─────────────────────────────────────────────────────────
// PlanningClient — vue calendrier mois multi-projets
// doc/04 §6.4 — Planning global
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { SkeletonCalendar } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

type ProjetLight = { id: string; title: string; colorCode: string }

type RepresentationGlobale = {
  id: string
  projetId: string
  projetTitle: string
  projetColorCode: string
  date: string
  type: string
  status: string
  showStartTime: string | null
  venueName: string | null
  venueCity: string | null
  statutVisuel: 'VERT' | 'JAUNE' | 'ROUGE'
  totalRequis: number
  totalPourvus: number
}

type PlanningData = {
  month: string
  projets: ProjetLight[]
  representations: RepresentationGlobale[]
  parDate: Record<string, RepresentationGlobale[]>
}

const STATUT_ICON: Record<string, string> = { VERT: '🟢', JAUNE: '🟡', ROUGE: '🔴' }
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function getMonthStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function addMonths(monthStr: string, n: number): string {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return getMonthStr(d)
}

function formatMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function getDaysInMonth(monthStr: string): Date[] {
  const [y, m] = monthStr.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const last = new Date(y, m, 0)
  const days: Date[] = []
  // Padding lundi (day 1) du début
  let dayOfWeek = first.getDay() === 0 ? 7 : first.getDay() // 1=Lun, 7=Dim
  for (let i = 1; i < dayOfWeek; i++) days.push(null as unknown as Date)
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(y, m - 1, d))
  }
  return days
}

function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function PlanningClient({ projets }: { projets: ProjetLight[] }) {
  const [month, setMonth] = useState(getMonthStr(new Date()))
  const [projetFiltre, setProjetFiltre] = useState('')
  const [data, setData] = useState<PlanningData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ month })
      if (projetFiltre) params.set('projetId', projetFiltre)
      const res = await fetch(`/api/planning/global?${params.toString()}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setError('Impossible de charger le planning')
    } finally {
      setLoading(false)
    }
  }, [month, projetFiltre])

  useEffect(() => { fetchData() }, [fetchData])

  const days = getDaysInMonth(month)

  return (
    <div className="p-6">
      {/* ── En-tête ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Planning global</h1>
        <div className="flex items-center gap-3">
          {projets.length > 0 && (
            <select
              value={projetFiltre}
              onChange={(e) => setProjetFiltre(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Tous les projets</option>
              {projets.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ── Navigation mois ──────────────────────────────── */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setMonth(addMonths(month, -1))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
        >
          ‹
        </button>
        <h2 className="text-lg font-semibold text-gray-900 min-w-44 text-center">
          {formatMonthLabel(month)}
        </h2>
        <button
          onClick={() => setMonth(addMonths(month, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
        >
          ›
        </button>
        <button
          onClick={() => setMonth(getMonthStr(new Date()))}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium ml-2"
        >
          Aujourd'hui
        </button>
      </div>

      {loading ? (
        <SkeletonCalendar />
      ) : error ? (
        <div className="bg-white rounded-xl border border-red-200 px-6 py-12 text-center">
          <p className="text-sm text-red-600 mb-3">⚠️ {error}</p>
          <button
            onClick={fetchData}
            className="btn btn-secondary btn-sm"
          >
            Réessayer
          </button>
        </div>
      ) : (
        <>
          {/* ── Grille calendrier ─────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* En-têtes jours */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {JOURS.map((j) => (
                <div key={j} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {j}
                </div>
              ))}
            </div>

            {/* Cases du calendrier */}
            <div className="grid grid-cols-7">
              {days.map((day, idx) => {
                if (!day) {
                  return <div key={`pad-${idx}`} className="min-h-28 border-r border-b border-gray-50 bg-gray-50/50" />
                }
                const dateKey = toDateKey(day)
                const reprs = data?.parDate[dateKey] ?? []
                const isToday = toDateKey(new Date()) === dateKey
                const isWeekend = day.getDay() === 0 || day.getDay() === 6

                return (
                  <div
                    key={dateKey}
                    className={`min-h-28 border-r border-b border-gray-100 p-1 ${isWeekend ? 'bg-gray-50/30' : ''}`}
                  >
                    {/* Numéro du jour */}
                    <div className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                      isToday ? 'bg-indigo-600 text-white' : 'text-gray-500'
                    }`}>
                      {day.getDate()}
                    </div>

                    {/* Événements du jour */}
                    <div className="space-y-0.5">
                      {reprs.map((rep) => (
                        <Link
                          key={rep.id}
                          href={`/projets/${rep.projetId}?onglet=planning`}
                          className="flex items-start gap-1 px-1.5 py-1 rounded-md hover:opacity-90 transition-opacity text-white cursor-pointer"
                          style={{ backgroundColor: rep.projetColorCode }}
                          title={`${rep.projetTitle} — ${rep.venueName ?? ''}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-semibold truncate">
                                {rep.projetTitle.length > 10 ? rep.projetTitle.slice(0, 8) + '…' : rep.projetTitle}
                              </span>
                              <span className="text-xs">{STATUT_ICON[rep.statutVisuel]}</span>
                            </div>
                            {rep.showStartTime && (
                              <span className="text-xs opacity-80">{rep.showStartTime.replace(':', 'h')}</span>
                            )}
                            {rep.totalRequis > 0 && (
                              <span className="text-xs opacity-75 ml-1">{rep.totalPourvus}/{rep.totalRequis}</span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Légende ──────────────────────────────────── */}
          <div className="mt-4 flex items-center gap-6 text-xs text-gray-400 flex-wrap">
            <span>🟢 100% pourvu</span>
            <span>🟡 Postes non critiques manquants</span>
            <span>🔴 Poste critique manquant</span>
            {projets.slice(0, 4).map((p) => (
              <span key={p.id} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: p.colorCode }} />
                {p.title}
              </span>
            ))}
          </div>

          {/* Empty state si aucune représentation */}
          {data && data.representations.length === 0 && (
            <EmptyState
              icon="📅"
              title="Aucune représentation ce mois-ci"
              description="Pas de spectacle programmé pour cette période. Naviguez vers un autre mois ou ajoutez des représentations depuis un projet."
              className="mt-6"
            />
          )}
        </>
      )}
    </div>
  )
}
