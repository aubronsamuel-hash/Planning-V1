// ─────────────────────────────────────────────────────────
// POST /api/auth/signup — Inscription nouvelle organisation
// doc/14-onboarding.md §14.1
// doc/06-regles-decisions.md Règle #16, #17
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { generateUniqueOrgSlug } from '@/lib/slug'
import { sendEmail, magicLinkEmail } from '@/lib/email'
import { validationError, internalError } from '@/lib/api-response'
import logger from '@/lib/logger'

const SignupSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email().toLowerCase(),
  organizationName: z.string().min(1).max(100),
  organizationType: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = SignupSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { firstName, lastName, email, organizationName, organizationType } = parsed.data

    // Vérifier si l'email est déjà utilisé
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { error: 'Un compte existe déjà avec cet email. Utilisez la page de connexion.', code: 'EMAIL_ALREADY_EXISTS' },
        { status: 409 }
      )
    }

    const slug = await generateUniqueOrgSlug(organizationName)

    // Créer User + Organization + OrganizationMembership en transaction
    const { user, organization } = await prisma.$transaction(async (tx) => {
      // 1. Créer le User
      const user = await tx.user.create({
        data: {
          firstName,
          lastName,
          email,
          role: 'MEMBER',
          locale: 'fr',
          timezone: 'Europe/Paris',
        },
      })

      // 2. Créer l'Organisation — plan PRO, trial 14 jours (doc/14 §14.1)
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          slug,
          type: organizationType ?? null,
          plan: 'PRO',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          // stripeCustomerId: null — pas de Stripe pendant le trial (Décision session 9)
          // onboardingCompletedAt: null — le wizard n'a pas encore été complété
        },
      })

      // 3. Créer le membership DIRECTEUR
      await tx.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'DIRECTEUR',
          joinedAt: new Date(),
        },
      })

      return { user, organization }
    })

    // 4. Générer un magic link LOGIN (15 min) pour la connexion post-inscription
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    const magicToken = await prisma.magicLinkToken.create({
      data: {
        userId: user.id,
        purpose: 'LOGIN',
        expiresAt,
        metadata: { redirectTo: '/onboarding' },
      },
    })

    // 5. Envoyer l'email de connexion
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const magicLink = `${baseUrl}/login/verify?token=${magicToken.token}`

    await sendEmail({
      to: email,
      subject: '🎭 Votre espace Spectacle Vivant est prêt — Connectez-vous',
      html: magicLinkEmail({
        firstName,
        magicLink,
        purpose: 'LOGIN',
        expiresInMinutes: 15,
      }),
    })

    void logger.info('Nouveau compte créé', { route: 'POST /api/auth/signup', email })

    return NextResponse.json(
      {
        success: true,
        message: 'Compte créé avec succès. Vérifiez votre email pour vous connecter.',
        email,
      },
      { status: 201 }
    )
  } catch (err) {
    void logger.error('POST /api/auth/signup', err, { route: 'POST /api/auth/signup' })
    return internalError()
  }
}
