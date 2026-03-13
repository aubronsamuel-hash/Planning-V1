'use client'
// ─────────────────────────────────────────────────────────
// NotificationBell — cloche + badge + dropdown
// doc/13-notifications.md §13.1 → §13.4
// Polling badge : GET /api/notifications/unread-count toutes les 30s
// ─────────────────────────────────────────────────────────
import { useState, useRef, useEffect, useCallback } from 'react'
import { NOTIFICATION_LABELS } from '@/lib/notifications'
import type { NotificationType, NotificationPriority } from '@prisma/client'

type Notification = {
  id: string
  type: NotificationType
  body: string
  priority: NotificationPriority
  link: string | null
  actionLabel: string | null
  readAt: string | null
  createdAt: string
  groupId: string | null
}

type UnreadCountResponse = { count: number }
type NotificationsResponse = { notifications: Notification[]; hasMore: boolean }

const POLL_INTERVAL_MS = 30_000 // 30s

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Polling badge ─────────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/unread-count')
      if (!res.ok) return
      const data: UnreadCountResponse = await res.json()
      setUnreadCount(data.count)
    } catch {
      // silencieux — le badge reste à sa dernière valeur connue
    }
  }, [])

  useEffect(() => {
    fetchUnreadCount()
    pollRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchUnreadCount])

  // ── Fermer en cliquant ailleurs ───────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Charger les notifs au clic ────────────────────────
  async function handleOpen() {
    const nextOpen = !open
    setOpen(nextOpen)
    if (!nextOpen) return

    setLoading(true)
    try {
      const res = await fetch('/api/notifications?limit=20')
      if (!res.ok) return
      const data: NotificationsResponse = await res.json()
      setNotifications(data.notifications)
    } catch {
      // silencieux
    } finally {
      setLoading(false)
    }
  }

  // ── Marquer toutes comme lues ─────────────────────────
  async function markAllRead() {
    try {
      await fetch('/api/notifications/mark-all-read', { method: 'POST' })
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })))
      setUnreadCount(0)
    } catch {
      // silencieux
    }
  }

  // ── Marquer une notif comme lue + naviguer ────────────
  async function handleNotifClick(notif: Notification) {
    if (!notif.readAt) {
      try {
        await fetch(`/api/notifications/${notif.id}/read`, { method: 'PATCH' })
        setNotifications((prev) =>
          prev.map((n) => n.id === notif.id ? { ...n, readAt: new Date().toISOString() } : n)
        )
        setUnreadCount((c) => Math.max(0, c - 1))
      } catch {
        // silencieux
      }
    }
    if (notif.link) {
      setOpen(false)
      window.location.href = notif.link
    }
  }

  // ── Badge display ─────────────────────────────────────
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount)

  // ── Couleur du dot selon priorité ────────────────────
  // ⚠️ NotificationPriority : CRITIQUE | URGENT | INFO (schéma Prisma)
  const dotColor: Record<NotificationPriority, string> = {
    CRITIQUE: 'bg-red-500',
    URGENT:   'bg-orange-500',
    INFO:     'bg-indigo-400',
  }

  return (
    <div ref={ref} className="relative">
      {/* Bouton cloche */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lue${unreadCount > 1 ? 's' : ''})` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {/* Icône cloche */}
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Badge rouge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
            {badgeLabel}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="dialog"
          aria-label="Centre de notifications"
          className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-medium text-white bg-red-500 rounded-full">
                  {badgeLabel}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* Liste */}
          <div className="max-h-[420px] overflow-y-auto scrollbar-hide">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                <svg className="animate-spin w-5 h-5 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Chargement…
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <div className="text-3xl mb-3">🔔</div>
                <p className="text-sm font-medium text-gray-600">Aucune notification</p>
                <p className="text-xs text-gray-400 mt-1">Vous êtes à jour !</p>
              </div>
            ) : (
              <ul>
                {notifications.map((notif) => {
                  const isUnread = !notif.readAt
                  return (
                    <li key={notif.id}>
                      <button
                        onClick={() => handleNotifClick(notif)}
                        className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                          isUnread ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        {/* Indicateur priorité */}
                        <div className="flex-shrink-0 mt-1">
                          <span className={`block w-2 h-2 rounded-full mt-0.5 ${dotColor[notif.priority]}`} />
                        </div>

                        {/* Contenu */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium mb-0.5 ${
                            isUnread ? 'text-gray-900' : 'text-gray-500'
                          }`}>
                            {NOTIFICATION_LABELS[notif.type]}
                          </p>
                          <p className={`text-sm leading-snug ${
                            isUnread ? 'text-gray-800' : 'text-gray-500'
                          }`}>
                            {notif.body}
                          </p>
                          {notif.actionLabel && (
                            <span className="mt-1.5 inline-block text-xs font-medium text-indigo-600">
                              {notif.actionLabel} →
                            </span>
                          )}
                        </div>

                        {/* Horodatage */}
                        <div className="flex-shrink-0 text-right">
                          <time className="text-xs text-gray-400">
                            {formatRelativeTime(notif.createdAt)}
                          </time>
                          {isUnread && (
                            <span className="block mt-1 w-2 h-2 rounded-full bg-indigo-500 ml-auto" aria-hidden="true" />
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Footer — lien vers le centre complet */}
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
            <a
              href="/notifications"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              onClick={() => setOpen(false)}
            >
              Voir toutes les notifications →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helper : horodatage relatif ───────────────────────────
function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1)  return "À l'instant"
  if (diffMin < 60) return `${diffMin} min`

  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)   return `${diffH}h`

  const diffD = Math.floor(diffH / 24)
  if (diffD < 7)    return `${diffD}j`

  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
