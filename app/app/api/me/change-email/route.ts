// ─────────────────────────────────────────────────────────
// POST /api/me/change-email — Demander changement email
// doc/06-regles-decisions.md Règle #17 · doc/23 §23.1
// Magic link purpose: EMAIL_CHANGE, expiration 24h
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth'
import { validationError, internalError } from '@/lib/api-response'
import { sendEmail, emailChangeEmail } from '@/lib/email'

// ── Schéma de validation ───────────────────────────────────
const ChangeEmailSchema = z.object({
  newEmail: z.string().email('Adresse email invalide'),
})

// ── POST — Demander changement email ──────────────────────
export async function POST(req: Request) {
  try {
    const { session, error } = await requireSession()
    if (error) return error

    const body = await req.json()
    const parsed = ChangeEmailSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { newEmail } = parsed.data

    // Vérifier que le nouvel email n'est pas déjà utilisé
    const existing = await prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'Cette adresse email est déjà utilisée par un autre compte.', code: 'CONFLICT' },
        { status: 409 }
      )
    }

    // Stocker l'email en attente sur l'utilisateur
    await prisma.user.update({
      where: { id: session.user.id },
      data: { pendingEmail: newEmail },
    })

    // Charger les infos de l'utilisateur pour l'email
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true, email: true },
    })

    // Générer le MagicLinkToken EMAIL_CHANGE (expiration 24h)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const magicToken = await prisma.magicLinkToken.create({
      data: {
        userId: session.user.id,
        purpose: 'EMAIL_CHANGE',
        expiresAt,
        metadata: { newEmail },
      },
    })

    // Construire l'URL de confirmation
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const confirmUrl = `${baseUrl}/api/auth/magic-link/verify?token=${magicToken.token}&purpose=EMAIL_CHANGE`

    // Envoyer l'email de confirmation à la nouvelle adresse
    const html = emailChangeEmail({
      firstName: user?.firstName ?? 'Utilisateur',
      newEmail,
      confirmUrl,
      expiresInHours: 24,
    })

    await sendEmail({
      to: newEmail,
      subject: 'Confirmez votre nouvelle adresse email — Spectacle SaaS',
      html,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/me/change-email]', err)
    return internalError()
  }
}
