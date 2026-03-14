// ─────────────────────────────────────────────────────────
// Next.js config — avec Sentry enveloppé via withSentryConfig
// ─────────────────────────────────────────────────────────
import { withSentryConfig } from '@sentry/nextjs'

/** @type {import("next").NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
    // Activer l'instrumentation hook (requis pour Sentry SDK v8+)
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
        pathname: '/**',
      },
    ],
  },
}

export default withSentryConfig(nextConfig, {
  // ── Organisation / projet Sentry ──────────────────────
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // ── Source maps ──────────────────────────────────────
  // Uploader les source maps vers Sentry et les supprimer du build public
  sourcemaps: {
    uploadSourceMaps: true,
    deleteSourcemapsAfterUpload: true,
  },

  // ── Silencer le CLI Sentry en dev ────────────────────
  silent: process.env.NODE_ENV !== 'production',

  // ── Tunnel ───────────────────────────────────────────
  // Proxifier les requêtes Sentry via /api/monitoring pour éviter les ad-blockers
  tunnelRoute: '/api/monitoring',

  // ── Tree-shaking SDK ─────────────────────────────────
  disableLogger: true,

  // ── Désactiver les auto-instrumentation lourdes en dev ──
  autoInstrumentServerFunctions: process.env.NODE_ENV === 'production',
  autoInstrumentMiddleware: process.env.NODE_ENV === 'production',
  autoInstrumentAppDirectory: process.env.NODE_ENV === 'production',
})
