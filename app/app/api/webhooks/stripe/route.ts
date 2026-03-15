export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { createInAppNotification } from '@/lib/notifications.server'
import { sendEmail, paymentFailedEmail } from '@/lib/email'
import logger from '@/lib/logger'

// Pas de auth session — vérification par signature Stripe uniquement
// Next.js 14 App Router : req.text() lit le raw body sans configuration supplémentaire

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Résout le plan applicatif depuis un price_id Stripe.
 * Retourne null si le price_id n'est pas reconnu.
 */
function resolvePlan(priceId: string): 'PRO' | 'ENTERPRISE' | null {
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'PRO'
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return 'ENTERPRISE'
  return null
}

/**
 * Vérifie si le nombre de collaborateurs dépasse le quota FREE (3 max).
 * Retourne true si isReadOnly doit être activé.
 */
async function shouldBeReadOnly(organizationId: string): Promise<boolean> {
  const nbCollabs = await prisma.organizationMembership.count({
    where: {
      organizationId,
      role: 'COLLABORATEUR',
    },
  })
  return nbCollabs > 3
}

/**
 * Trouve le Directeur d'une organisation pour lui envoyer des notifications.
 * Retourne null si aucun Directeur trouvé.
 */
async function findDirecteur(
  organizationId: string
): Promise<{ userId: string; email: string; firstName: string } | null> {
  const membership = await prisma.organizationMembership.findFirst({
    where: {
      organizationId,
      role: 'DIRECTEUR',
    },
    include: {
      user: {
        select: { id: true, email: true, firstName: true },
      },
    },
  })
  if (!membership) return null
  return {
    userId: membership.user.id,
    email: membership.user.email,
    firstName: membership.user.firstName,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handlers par type d'événement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * §18.3 — customer.subscription.updated
 * Déclenché lors d'un upgrade ou downgrade de plan.
 */
async function handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription
  const stripeCustomerId = subscription.customer as string
  const priceId = subscription.items.data[0]?.price?.id

  // Trouver l'organisation par stripeCustomerId
  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId },
    select: { id: true, name: true },
  })

  if (!org) {
    void logger.warn(
      `[webhook/stripe] subscription.updated: organisation introuvable pour customerId=${stripeCustomerId}`,
      { route: "POST /api/webhooks/stripe" }
    )
    return
  }

  // Mapper le price_id vers un plan applicatif
  const newPlan = resolvePlan(priceId)

  if (!newPlan) {
    // Price inconnu — log d'erreur sans modifier Organization.plan
    void logger.warn(
      `[webhook/stripe] subscription.updated: price_id inconnu "${priceId}" pour org=${org.id} — plan non modifié`,
      { route: "POST /api/webhooks/stripe" }
    )
    return
  }

  // Calculer isReadOnly selon le nouveau plan
  let isReadOnly = false
  if (newPlan === 'PRO' || newPlan === 'ENTERPRISE') {
    // Toujours remettre isReadOnly à false pour les plans payants
    isReadOnly = false
  } else {
    // Plan FREE — vérifier le quota de collaborateurs
    isReadOnly = await shouldBeReadOnly(org.id)
  }

  // Mettre à jour le plan et isReadOnly en base (idempotent)
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      plan: newPlan,
      isReadOnly,
    },
  })

  // ActivityLog — action système (userId: null)
  await prisma.activityLog.create({
    data: {
      action: 'PLAN_CHANGED',
      entityType: 'Organization',
      entityId: org.id,
      userId: null, // action webhook — pas d'auteur humain
      metadata: {
        newPlan,
        source: 'stripe_webhook',
        stripeEventId: event.id,
        priceId,
      },
    },
  })

  // Notification in-app au Directeur
  const directeur = await findDirecteur(org.id)
  if (directeur) {
    const isUpgrade = newPlan === 'PRO' || newPlan === 'ENTERPRISE'
    await createInAppNotification({
      userId: directeur.userId,
      organizationId: org.id,
      type: 'AFFECTATION_MODIFIEE', // NotificationType — pas de type PLAN_CHANGED disponible
      title: isUpgrade
        ? `Votre plan a été mis à jour vers ${newPlan}`
        : 'Votre plan a été réduit à FREE',
      body: isUpgrade
        ? `Votre organisation "${org.name}" bénéficie maintenant du plan ${newPlan}.`
        : `Votre organisation "${org.name}" est repassée en plan Découverte (FREE).`,
      link: '/settings/organisation#facturation',
      actionLabel: 'Voir la facturation',
    })
  }
}

/**
 * §18.4 — customer.subscription.deleted
 * Déclenché lors d'une résiliation d'abonnement.
 * Décision retenue : Option A (dégradation douce → FREE).
 */
async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription
  const stripeCustomerId = subscription.customer as string

  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId },
    select: { id: true, name: true },
  })

  if (!org) {
    void logger.warn(
      `[webhook/stripe] subscription.deleted: organisation introuvable pour customerId=${stripeCustomerId}`,
      { route: "POST /api/webhooks/stripe" }
    )
    return
  }

  // Vérifier si isReadOnly est nécessaire (quota FREE = 3 collaborateurs max)
  const isReadOnly = await shouldBeReadOnly(org.id)

  // Rétrograder vers FREE (Option A — dégradation douce)
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      plan: 'FREE',
      isReadOnly,
    },
  })

  // ActivityLog — SUBSCRIPTION_CANCELLED (userId: null — action système)
  await prisma.activityLog.create({
    data: {
      action: 'SUBSCRIPTION_CANCELLED',
      entityType: 'Organization',
      entityId: org.id,
      userId: null,
      metadata: {
        source: 'stripe_webhook',
        stripeEventId: event.id,
        isReadOnly,
      },
    },
  })

  // Notification in-app au Directeur
  const directeur = await findDirecteur(org.id)
  if (directeur) {
    await createInAppNotification({
      userId: directeur.userId,
      organizationId: org.id,
      type: 'AFFECTATION_ANNULEE', // NotificationType — pas de type SUBSCRIPTION_CANCELLED disponible
      title: 'Votre abonnement a expiré',
      body: `Votre organisation "${org.name}" est repassée en plan Découverte. Vous conservez l'accès à vos données.`,
      link: '/settings/organisation#facturation',
      actionLabel: 'Choisir un plan',
    })
  }
}

/**
 * §18.5 — invoice.payment_failed
 * Déclenché à chaque tentative de débit échouée.
 */
async function handlePaymentFailed(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice
  const stripeCustomerId = invoice.customer as string
  const attemptCount = invoice.attempt_count ?? 1
  const invoiceId = invoice.id
  const montantCentimes = invoice.amount_due // en centimes

  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId },
    select: {
      id: true,
      name: true,
      billingEmail: true,
    },
  })

  if (!org) {
    void logger.warn(
      `[webhook/stripe] invoice.payment_failed: organisation introuvable pour customerId=${stripeCustomerId}`,
      { route: "POST /api/webhooks/stripe" }
    )
    return
  }

  // Toujours mettre à jour paymentFailedAt (toutes tentatives)
  await prisma.organization.update({
    where: { id: org.id },
    data: { paymentFailedAt: new Date() },
  })

  // ActivityLog — PAYMENT_FAILED (userId: null — action système)
  await prisma.activityLog.create({
    data: {
      action: 'PAYMENT_FAILED',
      entityType: 'Organization',
      entityId: org.id,
      userId: null,
      metadata: {
        source: 'stripe_webhook',
        stripeEventId: event.id,
        invoiceId,
        attemptCount,
        montantCentimes,
      },
    },
  })

  const directeur = await findDirecteur(org.id)

  // Actions spécifiques selon le numéro de tentative
  if (attemptCount === 1) {
    // Premier échec : email + notification in-app + alerte back-office

    // Email au billingEmail (ou email du Directeur en fallback)
    const recipientEmail = org.billingEmail ?? directeur?.email
    if (recipientEmail) {
      const portalUrl = `${process.env.NEXTAUTH_URL}/api/billing/portal`
      await sendEmail({
        to: recipientEmail,
        subject: `⚠️ Problème de paiement — ${org.name}`,
        html: paymentFailedEmail({
          directeurPrenom: directeur?.firstName ?? 'Directeur',
          organizationName: org.name,
          montant: `${(montantCentimes / 100).toFixed(2)} €`,
          portalUrl,
        }),
      })
    }

    // Notification in-app au Directeur
    if (directeur) {
      await createInAppNotification({
        userId: directeur.userId,
        organizationId: org.id,
        type: 'AFFECTATION_ANNULEE', // NotificationType — pas de type PAYMENT_FAILED disponible
        title: 'Paiement échoué',
        body: `Le paiement pour "${org.name}" a échoué. Veuillez mettre à jour votre moyen de paiement pour éviter une interruption de service.`,
        link: '/settings/organisation#facturation',
        actionLabel: 'Mettre à jour le paiement',
      })
    }
  }
  // Pour attempt_count >= 2, Stripe gère les relances selon sa propre config (Smart Retries)
  // L'email de relance est géré par Stripe Dashboard ou peut être ajouté ici si nécessaire
}

/**
 * §18.6 — invoice.payment_succeeded
 * Déclenché à chaque paiement réussi (renouvellement mensuel ou reprise après échec).
 */
async function handlePaymentSucceeded(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice
  const stripeCustomerId = invoice.customer as string
  const invoiceId = invoice.id
  const amount = invoice.amount_paid // en centimes

  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId },
    select: {
      id: true,
      name: true,
      paymentFailedAt: true,
      suspendedAt: true,
      suspendedReason: true,
    },
  })

  if (!org) {
    void logger.warn(
      `[webhook/stripe] invoice.payment_succeeded: organisation introuvable pour customerId=${stripeCustomerId}`,
      { route: "POST /api/webhooks/stripe" }
    )
    return
  }

  // Toujours remettre paymentFailedAt à null
  const updateData: {
    paymentFailedAt: null
    suspendedAt?: null
    suspendedReason?: null
  } = { paymentFailedAt: null }

  // Si l'organisation était suspendue pour raison de paiement → lever la suspension
  const wasPaymentSuspended =
    org.suspendedAt !== null && org.suspendedReason === 'Abonnement résilié'
  if (wasPaymentSuspended) {
    updateData.suspendedAt = null
    updateData.suspendedReason = null
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: updateData,
  })

  // ActivityLog — PAYMENT_SUCCEEDED
  await prisma.activityLog.create({
    data: {
      action: 'PAYMENT_SUCCEEDED',
      entityType: 'Organization',
      entityId: org.id,
      userId: null, // action système
      metadata: {
        source: 'stripe_webhook',
        stripeEventId: event.id,
        invoiceId,
        amount,
      },
    },
  })

  // Si suspension levée → notifier le Directeur
  if (wasPaymentSuspended) {
    const directeur = await findDirecteur(org.id)
    if (directeur) {
      await createInAppNotification({
        userId: directeur.userId,
        organizationId: org.id,
        type: 'AFFECTATION_CREEE', // NotificationType — pas de type PAYMENT_SUCCEEDED disponible
        title: 'Accès rétabli',
        body: `Votre paiement a bien été reçu. L'accès à "${org.name}" est maintenant rétabli.`,
        link: '/settings/organisation#facturation',
        actionLabel: 'Voir la facturation',
      })
    }
  }
}

/**
 * §18.2 — invoice.finalized
 * Juste un log ActivityLog — pas d'action UI.
 */
async function handleInvoiceFinalized(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice
  const stripeCustomerId = invoice.customer as string
  const invoiceId = invoice.id

  const org = await prisma.organization.findUnique({
    where: { stripeCustomerId },
    select: { id: true },
  })

  if (!org) {
    // Pas d'erreur loguée — une facture peut être finalisée avant que l'org soit créée en base
    return
  }

  await prisma.activityLog.create({
    data: {
      action: 'INVOICE_FINALIZED',
      entityType: 'Organization',
      entityId: org.id,
      userId: null,
      metadata: {
        source: 'stripe_webhook',
        stripeEventId: event.id,
        invoiceId,
        amountDue: (event.data.object as Stripe.Invoice).amount_due,
      },
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Route principale — POST /api/webhooks/stripe
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover',
  })
  // Récupérer le raw body — Next.js 14 App Router ne nécessite pas de config spéciale
  const rawBody = await req.text()

  // Lire la signature Stripe depuis les headers
  const sig = headers().get('stripe-signature')

  if (!sig) {
    void logger.warn('webhook/stripe Header stripe-signature manquant', { route: 'POST /api/webhooks/stripe' })
    return NextResponse.json(
      { error: 'Signature manquante' },
      { status: 400 }
    )
  }

  // Vérification de signature — obligatoire avant tout traitement
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    void logger.error('webhook/stripe Signature invalide', err, { route: 'POST /api/webhooks/stripe' })
    return NextResponse.json(
      { error: 'Signature Stripe invalide' },
      { status: 400 }
    )
  }

  // Dispatch selon le type d'événement
  try {
    switch (event.type) {
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event)
        break

      case 'invoice.finalized':
        await handleInvoiceFinalized(event)
        break

      default:
        // Événements non traités — ignorer silencieusement
        break
    }
  } catch (err) {
    void logger.error(`webhook/stripe Erreur lors du traitement de ${event.type}`, err, { route: 'POST /api/webhooks/stripe' })
    // Toujours répondre 200 pour éviter que Stripe retente indéfiniment
    // Les erreurs sont loguées côté serveur — ne pas exposer le détail à Stripe
  }

  // Toujours répondre 200 { received: true } sauf signature invalide (400 ci-dessus)
  return NextResponse.json({ received: true })
}
