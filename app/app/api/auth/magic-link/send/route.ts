// ─────────────────────────────────────────────────────────
// POST /api/auth/magic-link/send — Envoi d'un lien de connexion
// doc/06-regles-decisions.md Règle #17
// doc/15-schema-prisma.md — MagicLinkToken purposes
// Flux : saisie email → POST ici → email envoyé → page /login/verify
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendEmail, magicLinkEmail } from '@/lib/email'
import { validationError, internalError } from '@/lib/api-response'
import logger from '@/lib/logger'

const SendMagicLinkSchema = z.object({
  email: z.string().email().toLowerCase(),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = SendMagicLinkSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { email } = parsed.data

    // Trouver l'utilisateur — réponse générique pour éviter l'énumération d'emails
    const user = await prisma.user.findUnique({ where: { email } })

    if (user) {
      // Révoquer les tokens LOGIN non encore utilisés pour cet utilisateur (nettoyage)
      await prisma.magicLinkToken.updateMany({
        where: {
          userId: user.id,
          purpose: 'LOGIN',
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() }, // invalider les anciens tokens
      })

      // Créer un nouveau token LOGIN — expiration 15 minutes (Règle #17)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
      const magicToken = await prisma.magicLinkToken.create({
        data: {
          userId: user.id,
          purpose: 'LOGIN',
          expiresAt,
        },
      })

      const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
      const magicLink = `${baseUrl}/login/verify?token=${magicToken.token}`

      await sendEmail({
        to: email,
        subject: '🎭 Votre lien de connexion — Spectacle Vivant',
        html: magicLinkEmail({
          firstName: user.firstName,
          magicLink,
          purpose: 'LOGIN',
          expiresInMinutes: 15,
        }),
      })
    }

    // Toujours retourner le même message (ne pas révéler si l'email existe)
    return NextResponse.json({
      success: true,
      message: 'Si un compte existe avec cet email, vous recevrez un lien de connexion.',
    })
  } catch (err) {
    void logger.error('POST /api/auth/magic-link/send', err, { route: 'POST /api/auth/magic-link/send' })
    return internalError()
  }
}
