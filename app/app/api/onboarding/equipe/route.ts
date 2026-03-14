// ─────────────────────────────────────────────────────────
// POST /api/onboarding/equipe — Étape 3 du wizard
// Invitations de collaborateurs (comptes GHOST + magic links)
// doc/14-onboarding.md §14.2 Étape 3
// doc/06-regles-decisions.md Règle #8, #16, #17
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrgSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail, magicLinkEmail } from '@/lib/email'
import { validationError, internalError } from '@/lib/api-response'
import logger from '@/lib/logger'

const InvitationSchema = z.object({
  email: z.string().email().toLowerCase(),
  role: z.enum(['REGISSEUR', 'RH', 'COLLABORATEUR']),
})

const Schema = z.object({
  invitations: z.array(InvitationSchema).min(1).max(3),
})

export async function POST(req: Request) {
  try {
    const { session, error } = await requireOrgSession({ write: true })
    if (error) return error

    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { invitations } = parsed.data
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

    const results: { email: string; status: 'invited' | 'already_member' | 'error' }[] = []

    for (const inv of invitations) {
      try {
        // Vérifier si l'email est déjà membre de l'organisation
        const existingUser = await prisma.user.findUnique({
          where: { email: inv.email },
          include: {
            memberships: {
              where: { organizationId: session.user.organizationId! },
            },
          },
        })

        if (existingUser?.memberships.length) {
          results.push({ email: inv.email, status: 'already_member' })
          continue
        }

        // Créer ou réutiliser un User GHOST (Règle #16 — Lazy Auth)
        const user = existingUser ?? (await prisma.user.create({
          data: {
            firstName: '',  // sera rempli lors de l'activation
            lastName: inv.email.split('@')[0],
            email: inv.email,
            role: 'MEMBER',
            locale: 'fr',
            timezone: 'Europe/Paris',
            collaborateur: {
              create: {
                accountStatus: 'GHOST',
                contractType: 'INTERMITTENT', // valeur par défaut — modifiable depuis /equipe
                ghostCreatedAt: new Date(),
              },
            },
          },
        }))

        // Créer le membership
        await prisma.organizationMembership.create({
          data: {
            userId: user.id,
            organizationId: session.user.organizationId!,
            role: inv.role,
            // joinedAt: null → invitation en attente
          },
        })

        // Créer un magic link ACTIVATION (7 jours — Règle #17)
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        const magicToken = await prisma.magicLinkToken.create({
          data: {
            userId: user.id,
            purpose: 'ACTIVATION',
            expiresAt,
            metadata: { organizationId: session.user.organizationId },
          },
        })

        // Récupérer le nom de l'organisation
        const org = await prisma.organization.findUnique({
          where: { id: session.user.organizationId! },
          select: { name: true },
        })

        const activationLink = `${baseUrl}/login/verify?token=${magicToken.token}`

        await sendEmail({
          to: inv.email,
          subject: `🎭 Vous êtes invité à rejoindre ${org?.name ?? 'une organisation'}`,
          html: magicLinkEmail({
            firstName: user.firstName || inv.email.split('@')[0],
            magicLink: activationLink,
            purpose: 'ACTIVATION',
            expiresInMinutes: 7 * 24 * 60, // 7 jours en minutes (affichage)
          }),
        })

        results.push({ email: inv.email, status: 'invited' })
      } catch (invErr) {
        void logger.error('onboarding/equipe Erreur pour ${inv.email}', invErr, { route: 'onboarding/equipe' })
        results.push({ email: inv.email, status: 'error' })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (err) {
    void logger.error('POST /api/onboarding/equipe', err, { route: 'POST /api/onboarding/equipe' })
    return internalError()
  }
}
