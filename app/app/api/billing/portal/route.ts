import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { requireOrgSession } from '@/lib/auth'
import { internalError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

const APP_URL = process.env.NEXTAUTH_URL!

export async function GET(_req: Request) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'DIRECTEUR' })
    if (error) return error

    const organizationId = session!.user.organizationId!

    // Charger l'organisation depuis la DB — jamais la session pour les données sensibles
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        stripeCustomerId: true,
      },
    })

    if (!org) {
      return NextResponse.json(
        { error: 'Organisation introuvable', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Guard : pas de Customer Portal sans stripeCustomerId
    if (!org.stripeCustomerId) {
      return NextResponse.json(
        { error: "Pas d'abonnement Stripe actif", code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    // Générer un lien Customer Portal Stripe à usage unique
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${APP_URL}/settings/organisation`,
    })

    return NextResponse.json({ portalUrl: portalSession.url })
  } catch (err) {
    console.error('[GET /api/billing/portal]', err)
    return internalError()
  }
}
