// ─────────────────────────────────────────────────────────
// Next.js Instrumentation Hook — initialise Sentry côté serveur
// Fichier requis par @sentry/nextjs pour le SDK v8+
// doc: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
// ─────────────────────────────────────────────────────────
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}
