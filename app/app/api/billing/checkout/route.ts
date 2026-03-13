import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'
import { requireOrgSession } from '@/lib/auth'
import { internalError, validationError, conflict } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

const APP_URL = process.env.NEXTAUTH_URL!

const CheckoutBodySchema = z.object({
  plan: z.enum(['PRO', 'ENTERPRISE']),
})

export async function POST(req: Request) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'DIRECTEUR', write: true })
    if (error) return error

    const body = await req.json()
    const parsed = CheckoutBodySchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { plan } = parsed.data
    const organizationId = session!.user.organizationId!

    // Charger l'organisation depuis la DB (source de vérité — jamais la session pour le plan)
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        billingEmail: true,
        stripeCustomerId: true,
      },
    })

    if (!org) {
      return NextResponse.json(
        { error: 'Organisation introuvable', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Guard idempotence : si un customer Stripe existe déjà → renvoyer vers le Portal
    if (org.stripeCustomerId) {
      return conflict(
        'Déjà abonné — utiliser le Customer Portal'
      )
    }

    // Résoudre le price_id selon le plan choisi
    const priceId =
      plan === 'PRO'
        ? process.env.STRIPE_PRICE_PRO!
        : process.env.STRIPE_PRICE_ENTERPRISE!

    // Récupérer l'email de l'utilisateur courant pour le fallback billing email
    const user = await prisma.user.findUnique({
      where: { id: session!.user.id },
      select: { email: true, firstName: true },
    })

    // Créer le Stripe Customer
    const customer = await stripe.customers.create({
      email: org.billingEmail ?? user?.email ?? undefined,
      name: org.name,
      metadata: {
        organizationId: org.id,
      },
    })

    // Sauvegarder immédiatement le stripeCustomerId en base — AVANT la Checkout Session
    // Évite les orphelins si l'utilisateur ferme la fenêtre après paiement
    await prisma.organization.update({
      where: { id: org.id },
      data: { stripeCustomerId: customer.id },
    })

    // ActivityLog — STRIPE_CUSTOMER_CREATED
    await prisma.activityLog.create({
      data: {
        action: 'STRIPE_CUSTOMER_CREATED',
        entityType: 'Organization',
        entityId: org.id,
        userId: session!.user.id,
        metadata: {
          stripeCustomerId: customer.id,
          plan,
        },
      },
    })

    // Créer la Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}/settings/organisation?checkout=success`,
      cancel_url: `${APP_URL}/settings/organisation?checkout=cancelled`,
      metadata: {
        organizationId: org.id,
      },
      subscription_data: {
        // Propagé au webhook customer.subscription.updated
        metadata: {
          organizationId: org.id,
        },
      },
    })

    return NextResponse.json({ checkoutUrl: checkoutSession.url })
  } catch (err) {
    console.error('[POST /api/billing/checkout]', err)
    return internalError()
  }
}
