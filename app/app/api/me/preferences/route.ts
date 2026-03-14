// ─────────────────────────────────────────────────────────
// PATCH /api/me/preferences — Sauvegarder préférences utilisateur
// Champs : timezone, emailPreferences (Json)
// doc/23-architecture-technique.md
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { validationError, internalError } from '@/lib/api-response'
import logger from '@/lib/logger'

// ── Schéma de validation ───────────────────────────────────
const PreferencesSchema = z.object({
  timezone: z.string().max(100).optional(),
  emailPreferences: z.record(z.unknown()).optional(),
})

// ── PATCH — Sauvegarder préférences ───────────────────────
export async function PATCH(req: Request) {
  try {
    const { session, error } = await requireSession()
    if (error) return error

    const body = await req.json()
    const parsed = PreferencesSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { timezone, emailPreferences } = parsed.data

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(timezone !== undefined ? { timezone } : {}),
        ...(emailPreferences !== undefined ? { emailPreferences } : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        timezone: true,
        emailPreferences: true,
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    void logger.error('PATCH /api/me/preferences', err, { route: 'PATCH /api/me/preferences' })
    return internalError()
  }
}
