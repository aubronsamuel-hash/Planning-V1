// ─────────────────────────────────────────────────────────
// Logger structuré — Logtail (Better Stack) + Sentry
// Server-only : ne jamais importer côté client
// ─────────────────────────────────────────────────────────
import 'server-only'
import * as Sentry from '@sentry/nextjs'

// ── Types ────────────────────────────────────────────────

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  organizationId?: string
  userId?: string
  route?: string
  [key: string]: unknown
}

// ── Transport Logtail (optionnel) ────────────────────────
// Si LOGTAIL_SOURCE_TOKEN n'est pas défini, les logs partent
// uniquement sur stdout (format JSON structuré).

let logtailLogger: { log: (msg: string, ctx: object) => void } | null = null

async function getLogtailLogger() {
  if (logtailLogger) return logtailLogger
  if (!process.env.LOGTAIL_SOURCE_TOKEN) return null

  try {
    const { Logtail } = await import('@logtail/node')
    const lt = new Logtail(process.env.LOGTAIL_SOURCE_TOKEN)
    logtailLogger = {
      log: (msg: string, ctx: object) => lt.log(msg, 'info', ctx),
    }
    return logtailLogger
  } catch {
    // Package non installé ou token invalide — dégradation silencieuse
    return null
  }
}

// ── Formateur JSON structuré ─────────────────────────────

function formatEntry(level: LogLevel, message: string, context?: LogContext) {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
    ...context,
  }
}

// ── Logger principal ─────────────────────────────────────

const logger = {
  /**
   * Log de débogage — désactivé en production pour éviter le bruit
   */
  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === 'production') return
    console.debug(JSON.stringify(formatEntry('debug', message, context)))
  },

  /**
   * Log informatif — événements métier normaux (affectation créée, email envoyé…)
   */
  async info(message: string, context?: LogContext) {
    const entry = formatEntry('info', message, context)
    console.log(JSON.stringify(entry))

    const lt = await getLogtailLogger()
    lt?.log(message, entry)
  },

  /**
   * Avertissement — situation anormale mais non bloquante (conflit horaire, quota proche…)
   */
  async warn(message: string, context?: LogContext) {
    const entry = formatEntry('warn', message, context)
    console.warn(JSON.stringify(entry))

    const lt = await getLogtailLogger()
    lt?.log(message, entry)

    // Remonter les warnings dans Sentry comme breadcrumb
    Sentry.addBreadcrumb({
      level: 'warning',
      message,
      data: context,
    })
  },

  /**
   * Erreur — exception ou état incohérent. Remontée automatique dans Sentry.
   */
  async error(message: string, error?: unknown, context?: LogContext) {
    const entry = formatEntry('error', message, {
      ...context,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    console.error(JSON.stringify(entry))

    const lt = await getLogtailLogger()
    lt?.log(message, entry)

    // Capturer dans Sentry avec le contexte enrichi
    Sentry.withScope((scope) => {
      if (context?.organizationId) scope.setTag('organizationId', context.organizationId)
      if (context?.userId) scope.setUser({ id: context.userId })
      if (context?.route) scope.setTag('route', context.route)
      scope.setExtras({ ...context })

      if (error instanceof Error) {
        Sentry.captureException(error)
      } else {
        Sentry.captureMessage(message, 'error')
      }
    })
  },
}

export default logger
