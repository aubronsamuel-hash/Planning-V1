// ─────────────────────────────────────────────────────────
// GET  /api/me — Récupérer son profil
// PATCH /api/me — Mettre à jour profil (firstName, lastName, phone)
// doc/23-architecture-technique.md
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'

// ── Schéma de validation ───────────────────────────────────
const PatchMeSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().max(20).optional().nullable(),
})

// ── GET — Récupérer son profil ────────────────────────────
export async function GET(_req: Request) {
  try {
    const { session, error } = await requireSession()
    if (error) return error

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        timezone: true,
        emailPreferences: true,
        icalToken: true,
      },
    })
    if (!user) return notFound('Utilisateur')

    return NextResponse.json({
      ...user,
      // Exposer uniquement la présence du token, pas sa valeur brute
      hasIcalToken: user.icalToken !== null && user.icalToken !== '',
      icalToken: undefined,
    })
  } catch (err) {
    console.error('[GET /api/me]', err)
    return internalError()
  }
}

// ── PATCH — Mettre à jour profil ──────────────────────────
export async function PATCH(req: Request) {
  try {
    const { session, error } = await requireSession()
    if (error) return error

    const body = await req.json()
    const parsed = PatchMeSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { firstName, lastName, phone } = parsed.data

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(phone !== undefined ? { phone } : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        timezone: true,
        emailPreferences: true,
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/me]', err)
    return internalError()
  }
}
