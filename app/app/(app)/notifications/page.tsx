'use client'
// ─────────────────────────────────────────────────────────
// Page /notifications — Liste complète avec pagination infinie
// doc/13 §13.3
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

type Notif = {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  actionLabel: string | null
  read: boolean
  priority: 'CRITIQUE' | 'URGENT' | 'INFO'
  createdAt: string
}

const PRIORITY_STYLE: Record<string, string> = {
  CRITIQUE: 'bg-red-50 border-l-4 border-red-400',
  URGENT:   'bg-orange-50 border-l-4 border-orange-400',
  INFO:     '',
}
const PRIORITY_ICON: Record<string, string> = {
  CRITIQUE: '🔴',
  URGENT:   '🟠',
  INFO:     '🔔',
}
const TYPE_ICON: Record<string, string> = {
  AFFECTATION_CREEE:           '🔔',
  AFFECTATION_MODIFIEE:        '✏️',
  AFFECTATION_ANNULEE:         '❌',
  CONFIRMATION_RECUE:          '✅',
  CONFIRMATION_REFUSEE:        '❌',
  POSTE_NON_POURVU:            '⚠️',
  REMPLACEMENT_URGENT:         '⚡',
  DPAE_A_FAIRE:                '📋',
  REPRESENTATION_ANNULEE:      '❌',
  REPRESENTATION_REPORTEE:     '📅',
  PROJET_ANNULE:               '🚫',
  FEUILLE_DE_ROUTE_PUBLIEE:    '📋',
  FEUILLE_DE_ROUTE_MODIFIEE:   '📝',
}

function groupByDay(notifs: Notif[]): { label: string; items: Notif[] }[] {
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const dayLabel = (d: Date) => {
    if (d.toDateString() === today.toDateString())     return "Aujourd'hui"
    if (d.toDateString() === yesterday.toDateString()) return 'Hier'
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  }

  const groups = new Map<string, Notif[]>()
  for (const n of notifs) {
    const d = new Date(n.createdAt)
    const label = dayLabel(d)
    const grp   = groups.get(label) ?? []
    grp.push(n)
    groups.set(label, grp)
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min  = Math.floor(diff / 60000)
  const h    = Math.floor(min / 60)
  if (min < 1)   return "à l'instant"
  if (min < 60)  return `il y a ${min}min`
  if (h < 24)    return `il y a ${h}h`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function NotificationsPage() {
  const [notifs, setNotifs]       = useState<Notif[]>([])
  const [loading, setLoading]     = useState(true)
  const [hasMore, setHasMore]     = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const cursorRef = useRef<string | null>(null)

  async function loadMore(append = false) {
    if (!append) setLoading(true)
    else setLoadingMore(true)
    try {
      const params = new URLSearchParams({ limit: '20' })
      if (append && cursorRef.current) params.set('cursor', cursorRef.current)
      const res  = await fetch(`/api/notifications?${params}`)
      const data = await res.json()
      const items: Notif[] = data.notifications ?? []
      setNotifs((prev) => append ? [...prev, ...items] : items)
      setHasMore(data.hasMore)
      if (items.length > 0) cursorRef.current = items[items.length - 1].id
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => { loadMore() }, [])

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' })
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  async function markRead(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, read: true }),
    })
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }

  const unreadCount = notifs.filter((n) => !n.read).length
  const groups      = groupByDay(notifs)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* ── En-tête ─────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Tout marquer lu
          </button>
        )}
      </div>

      {/* ── Contenu ─────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Chargement…</p>
        </div>
      ) : notifs.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">🔔</p>
          <p className="text-gray-500 text-sm">Aucune notification pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ label, items }) => (
            <div key={label}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{label}</h2>
              <div className="space-y-2">
                {items.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-xl p-4 transition-colors ${
                      !n.read ? PRIORITY_STYLE[n.priority] ?? 'bg-indigo-50/50 border-l-4 border-indigo-200' : 'bg-white border border-gray-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Point non lu */}
                      <div className="flex-shrink-0 mt-1">
                        {!n.read ? (
                          <span className="text-sm">{PRIORITY_ICON[n.priority]}</span>
                        ) : (
                          <span className="text-sm text-gray-300">{TYPE_ICON[n.type] ?? '🔔'}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`text-sm font-semibold ${!n.read ? 'text-gray-900' : 'text-gray-600'}`}>
                            {n.title}
                          </p>
                          <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(n.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-600">{n.body}</p>

                        {/* CTA action */}
                        {n.link && n.actionLabel && (
                          <Link
                            href={n.link}
                            onClick={() => markRead(n.id)}
                            className="inline-block mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            {n.actionLabel} →
                          </Link>
                        )}
                      </div>

                      {/* Marquer lu */}
                      {!n.read && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-600 ml-2"
                          title="Marquer comme lu"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Pagination infinie */}
          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={() => loadMore(true)}
                disabled={loadingMore}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
              >
                {loadingMore ? 'Chargement…' : 'Voir plus'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
