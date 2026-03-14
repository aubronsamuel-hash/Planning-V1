// ─────────────────────────────────────────────────────────
// PATCH /api/settings/organisation — Modifier les infos générales
// DELETE /api/settings/organisation — Supprimer l'organisation (§16.6)
// doc/06-regles-decisions.md · doc/23-architecture-technique.md
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import logger from '@/lib/logger'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

// ── Schémas de validation ──────────────────────────────────
const PatchOrgSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').max(100).optional(),
  type: z.string().optional(),
  city: z.string().max(100).optional(),
  billingEmail: z.string().email('Email de facturation invalide').optional(),
})

const DeleteOrgSchema = z.object({
  confirmName: z.string(),
})

// ── PATCH — Modifier les infos générales ──────────────────
export async function PATCH(req: Request) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'DIRECTEUR', write: true })
    if (error) return error

    const organizationId = session.user.organizationId!

    const body = await req.json()
    const parsed = PatchOrgSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { name, type, city, billingEmail } = parsed.data

    // Vérifier que l'org existe
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    })
    if (!org) return notFound('Organisation')

    // Mettre à jour — le slug n'est jamais modifié
    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(billingEmail !== undefined ? { billingEmail } : {}),
      },
    })

    // ActivityLog
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'PLAN_CHANGED', // ORG_SETTINGS_UPDATED si disponible
        entityType: 'Organization',
        entityId: organizationId,
        metadata: { updatedFields: Object.keys(parsed.data) },
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    void logger.error('PATCH /api/settings/organisation', err, { route: 'PATCH /api/settings/organisation' })
    return internalError()
  }
}

// ── DELETE — Supprimer l'organisation (§16.6) ─────────────
export async function DELETE(req: Request) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'DIRECTEUR', write: true })
    if (error) return error

    const organizationId = session.user.organizationId!

    const body = await req.json()
    const parsed = DeleteOrgSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { confirmName } = parsed.data

    // Charger l'organisation
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, stripeCustomerId: true },
    })
    if (!org) return notFound('Organisation')

    // Vérifier la confirmation par le nom exact
    if (confirmName !== org.name) {
      return NextResponse.json(
        {
          error: 'Le nom de confirmation ne correspond pas au nom de l\'organisation.',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    // Annuler l'abonnement Stripe si présent — erreur non bloquante
    if (org.stripeCustomerId) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: org.stripeCustomerId,
          status: 'active',
          limit: 10,
        })
        for (const sub of subscriptions.data) {
          await stripe.subscriptions.cancel(sub.id)
        }
      } catch (stripeErr) {
        void logger.error('DELETE /api/settings/organisation Stripe cancel error', stripeErr, { route: 'DELETE /api/settings/organisation' })
        // On continue malgré l'erreur Stripe
      }
    }

    // Soft delete si le champ deletedAt existe sur Organization, sinon delete hard
    try {
      await prisma.organization.update({
        where: { id: organizationId },
        data: { deletedAt: new Date() },
      })
    } catch {
      // deletedAt n'existe pas sur le modèle → suppression en cascade
      await prisma.organization.delete({
        where: { id: organizationId },
      })
    }

    return NextResponse.json({ success: true, redirectTo: '/goodbye' })
  } catch (err) {
    void logger.error('DELETE /api/settings/organisation', err, { route: 'DELETE /api/settings/organisation' })
    return internalError()
  }
}
