// ─────────────────────────────────────────────────────────
// POST /api/me/ical/regenerate — Régénérer le token iCal
// Le token est un UUID aléatoire stocké en clair sur User.icalToken
// L'ancienne URL devient immédiatement invalide
// doc/06-regles-decisions.md · CLAUDE.md (iCal : statut CONFIRMEE uniquement)
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { internalError } from '@/lib/api-response'
import logger from '@/lib/logger'

// ── POST — Régénérer le token iCal ────────────────────────
export async function POST(_req: Request) {
  try {
    const { session, error } = await requireSession()
    if (error) return error

    // Générer un nouveau UUID
    const newToken = crypto.randomUUID()

    // Stocker dans User.icalToken
    await prisma.user.update({
      where: { id: session.user.id },
      data: { icalToken: newToken },
    })

    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const icalUrl = `${baseUrl}/api/ical/${newToken}`

    return NextResponse.json({ icalToken: newToken, icalUrl })
  } catch (err) {
    void logger.error('POST /api/me/ical/regenerate', err, { route: 'POST /api/me/ical/regenerate' })
    return internalError()
  }
}
