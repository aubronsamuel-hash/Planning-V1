// ─────────────────────────────────────────────────────────
// Sentry — configuration serveur (Node.js / Route Handlers)
// Initialisé automatiquement par @sentry/nextjs
// ─────────────────────────────────────────────────────────
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  environment: process.env.NODE_ENV ?? 'development',

  // Contexte additionnel : version déployée (Vercel injecte VERCEL_GIT_COMMIT_SHA)
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Filtrer les erreurs non actionnables côté serveur
  beforeSend(event, hint) {
    const error = hint?.originalException

    // Ne pas remonter les 4xx (erreurs métier attendues)
    if (error instanceof Error && 'statusCode' in error) {
      const status = (error as any).statusCode as number
      if (status >= 400 && status < 500) return null
    }

    return event
  },
})
