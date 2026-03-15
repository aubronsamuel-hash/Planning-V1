'use client'
// ─────────────────────────────────────────────────────────
// Toast — Système de notifications éphémères
// Usage : const { success, error, warning, info } = useToast()
// ─────────────────────────────────────────────────────────
import { createContext, useContext, useState, useCallback, useEffect } from 'react'

// ── Types ──────────────────────────────────────────────────
type ToastVariant = 'success' | 'error' | 'warning' | 'info'

type Toast = {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  duration?: number
}

type ToastContextType = {
  toast:   (opts: Omit<Toast, 'id'>) => void
  success: (title: string, description?: string) => void
  error:   (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
  info:    (title: string, description?: string) => void
}

// ── Context ────────────────────────────────────────────────
const ToastContext = createContext<ToastContextType | null>(null)

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast doit être utilisé dans un ToastProvider')
  return ctx
}

// ── Styles par variante ────────────────────────────────────
const STYLES: Record<ToastVariant, { wrapper: string; icon: string; iconText: string }> = {
  success: {
    wrapper:  'border-green-200 shadow-green-100/60',
    icon:     'bg-green-100 text-green-700',
    iconText: '✓',
  },
  error: {
    wrapper:  'border-red-200 shadow-red-100/60',
    icon:     'bg-red-100 text-red-700',
    iconText: '✕',
  },
  warning: {
    wrapper:  'border-amber-200 shadow-amber-100/60',
    icon:     'bg-amber-100 text-amber-700',
    iconText: '⚠',
  },
  info: {
    wrapper:  'border-indigo-200 shadow-indigo-100/60',
    icon:     'bg-indigo-100 text-indigo-700',
    iconText: 'ℹ',
  },
}

// ── Composant toast individuel ─────────────────────────────
function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: string) => void
}) {
  const s = STYLES[toast.variant]

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration ?? 4000)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  return (
    <div
      className={`toast-enter flex items-start gap-3 pl-3 pr-4 py-3 bg-white rounded-xl border shadow-lg ${s.wrapper} min-w-72 max-w-sm`}
      role="alert"
      aria-live="polite"
    >
      {/* Icône */}
      <span
        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${s.icon}`}
      >
        {s.iconText}
      </span>

      {/* Contenu */}
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-sm font-semibold text-gray-900 leading-tight">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-gray-500 mt-0.5 leading-snug">{toast.description}</p>
        )}
      </div>

      {/* Bouton fermer */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors mt-0.5"
        aria-label="Fermer"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── Provider ───────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev.slice(-4), { ...opts, id }]) // max 5 toasts simultanés
  }, [])

  const ctx: ToastContextType = {
    toast:   addToast,
    success: (title, description) => addToast({ variant: 'success', title, description }),
    error:   (title, description) => addToast({ variant: 'error',   title, description }),
    warning: (title, description) => addToast({ variant: 'warning', title, description }),
    info:    (title, description) => addToast({ variant: 'info',    title, description }),
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}

      {/* Conteneur des toasts — coin haut droit */}
      {toasts.length > 0 && (
        <div
          className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none"
          aria-label="Notifications"
        >
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}
