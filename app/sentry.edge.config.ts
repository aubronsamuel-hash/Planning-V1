// ─────────────────────────────────────────────────────────
// Sentry — configuration Edge Runtime (middleware Next.js)
// Initialisé automatiquement par @sentry/nextjs
// ─────────────────────────────────────────────────────────
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Edge runtime : pas de tracing complet (overhead minimal)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,

  environment: process.env.NODE_ENV ?? 'development',

  release: process.env.VERCEL_GIT_COMMIT_SHA,
})
