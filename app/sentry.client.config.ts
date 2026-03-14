// ─────────────────────────────────────────────────────────
// Sentry — configuration client (navigateur)
// Initialisé automatiquement par @sentry/nextjs
// ─────────────────────────────────────────────────────────
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Taux d'échantillonnage des traces de performance (0–1)
  // 0.1 = 10 % des transactions en production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Taux d'échantillonnage du Session Replay
  // Activé uniquement pour les sessions avec erreur en production
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0.0,

  // Ne pas afficher les breadcrumbs en production pour éviter les fuites de données
  beforeBreadcrumb(breadcrumb) {
    if (process.env.NODE_ENV === 'production' && breadcrumb.category === 'console') {
      return null
    }
    return breadcrumb
  },

  // Ignorer les erreurs non actionnables côté client
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
    /^ChunkLoadError/,
    /^Loading chunk/,
  ],

  environment: process.env.NODE_ENV ?? 'development',

  integrations: [
    Sentry.replayIntegration({
      // Masquer les champs sensibles dans le replay
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
})
