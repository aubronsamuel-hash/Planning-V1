// ─────────────────────────────────────────────────────────
// lib/cron.ts — Guard CRON_SECRET pour les endpoints cron
// doc §21.8 — Cron Jobs
// ─────────────────────────────────────────────────────────

/**
 * Vérifie que la requête vient bien de Vercel Cron (ou d'un appel interne autorisé).
 * Retourne une Response 401 si non autorisé, null si OK.
 */
export function verifyCronSecret(request: Request): Response | null {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    // En développement local sans CRON_SECRET, on autorise
    if (process.env.NODE_ENV === 'development') return null
    return new Response('CRON_SECRET non configuré', { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  return null
}
