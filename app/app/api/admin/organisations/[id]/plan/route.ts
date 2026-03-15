// ─────────────────────────────────────────────────────────
// PATCH /api/admin/organisations/[id]/plan — Changer le plan d'une org
// doc/06-regles-decisions.md §17.5.1
// Accès : SUPER_ADMIN uniquement
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth'
import { internalError, validationError, notFound } from '@/lib/api-response'
import type { OrganizationPlan } from '@prisma/client'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let stripe: any = null
async function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Stripe = require('stripe')
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })
    } catch { /* stripe not installed */ }
  }
  return stripe
}

// Prix Stripe par plan (en centimes)
const STRIPE_PRICE_IDS: Partial<Record<OrganizationPlan, string>> = {
  PRO: process.env.STRIPE_PRICE_PRO!,
  ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE!,
}

const PatchPlanSchema = z.object({
  plan: z.enum(['FREE', 'PRO', 'ENTERPRISE']),
  raison: z.string().max(500).optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { session, error } = await requireSuperAdmin()
    if (error) return error

    const { id } = params

    const body = await req.json()
    const parsed = PatchPlanSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { plan: newPlan, raison } = parsed.data

    // Charger l'organisation
    const org = await prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        plan: true,
        stripeCustomerId: true,
        _count: {
          select: { memberships: true },
        },
      },
    })
    if (!org) return notFound('Organisation')

    const ancienPlan = org.plan
    const nbCollabs = org._count.memberships

    // ── CAS A : Stripe actif ────────────────────────────────
    const stripeClient = await getStripe()
    if (org.stripeCustomerId && stripeClient) {
      try {
        // Récupérer l'abonnement actif
        const subscriptions = await stripeClient.subscriptions.list({
          customer: org.stripeCustomerId,
          status: 'active',
          limit: 1,
        })

        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0]

          if (newPlan === 'FREE') {
            // Annuler l'abonnement Stripe
            await stripeClient.subscriptions.cancel(subscription.id)
          } else {
            // Mettre à jour le price
            const newPriceId = STRIPE_PRICE_IDS[newPlan as keyof typeof STRIPE_PRICE_IDS]
            if (!newPriceId) {
              return NextResponse.json(
                { error: `Price ID manquant pour le plan ${newPlan}`, code: 'CONFIGURATION_ERROR' },
                { status: 500 }
              )
            }
            await stripeClient.subscriptions.update(subscription.id, {
              items: [
                {
                  id: subscription.items.data[0].id,
                  price: newPriceId,
                },
              ],
              proration_behavior: 'always_invoice',
            })
          }
        }
      } catch (stripeErr) {
        void logger.error('PATCH /api/admin/organisations/[id]/plan Stripe error', stripeErr, { route: 'PATCH /api/admin/organisations/[id]/plan' })
        // On continue malgré l'erreur Stripe pour l'écriture DB
      }
    }

    // ── Calcul isReadOnly : FREE + nbCollabs > 3 ────────────
    const nbCollabsCount = await prisma.organizationMembership.count({
      where: { organizationId: id, joinedAt: { not: null } },
    })
    const shouldBeReadOnly = newPlan === 'FREE' && nbCollabsCount > 3

    // ── Écriture DB dans tous les cas ───────────────────────
    const updated = await prisma.organization.update({
      where: { id },
      data: {
        plan: newPlan as OrganizationPlan,
        isReadOnly: shouldBeReadOnly,
        // Réinitialiser paymentFailedAt si changement de plan
        ...(newPlan !== 'FREE' ? { paymentFailedAt: null } : {}),
      },
    })

    // ── ActivityLog ─────────────────────────────────────────
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'PLAN_CHANGED',
        entityType: 'Organization',
        entityId: id,
        metadata: {
          raison: raison ?? null,
          ancienPlan,
          nouveauPlan: newPlan,
          source: 'admin_override',
        },
      },
    })

    return NextResponse.json({
      id: updated.id,
      plan: updated.plan,
      isReadOnly: updated.isReadOnly,
    })
  } catch (err) {
    void logger.error('PATCH /api/admin/organisations/[id]/plan', err, { route: 'PATCH /api/admin/organisations/[id]/plan' })
    return internalError()
  }
}
