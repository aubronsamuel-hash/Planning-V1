// ─────────────────────────────────────────────────────────
// GET /api/cron/nettoyage-tokens
// Supprime les MagicLinkToken expirés et expire les PropositionRemplacement sans réponse
// Fréquence : quotidien à 3h00 — idempotent
// doc §21.4
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronSecret } from '@/lib/cron'
import logger from '@/lib/logger'

export async function GET(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  try {
    const maintenant = new Date()

    // Supprimer les tokens expirés (utilisés ou non)
    const { count: tokensSupprimes } = await prisma.magicLinkToken.deleteMany({
      where: { expiresAt: { lt: maintenant } },
    })

    // Passer les PropositionRemplacement sans réponse à EXPIREE
    const { count: propositionsExpirees } = await prisma.propositionRemplacement.updateMany({
      where: {
        expiresAt: { lt: maintenant },
        status: 'EN_ATTENTE',
      },
      data: { status: 'EXPIREE' },
    })

    console.log(
      `[cron/nettoyage-tokens] ${tokensSupprimes} tokens supprimés · ${propositionsExpirees} propositions expirées`
    )

    return NextResponse.json({
      tokensSupprimes,
      propositionsExpirees,
    })
  } catch (err) {
    void logger.error('cron/nettoyage-tokens', err, { route: 'cron/nettoyage-tokens' })
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
