// ─────────────────────────────────────────────────────────
// GET /api/cron/expiration-trial
// Gère les trials PRO arrivant à terme (J-3 avertissement + expiration)
// Fréquence : quotidien à 8h00 — idempotent
// doc §21.3
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronSecret } from '@/lib/cron'
import { sendEmail, trialEndingEmail, trialExpiredEmail } from '@/lib/email'
import logger from '@/lib/logger'

export async function GET(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  try {
    const maintenant = new Date()
    const dans3Jours = new Date(maintenant.getTime() + 3 * 24 * 60 * 60 * 1000)
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const upgradeUrl = `${baseUrl}/settings/organisation#facturation`

    let avertissements = 0
    let expirations = 0

    // ── ÉTAPE 1 — Avertissement J-3 ───────────────────────
    const orgsJ3 = await prisma.organization.findMany({
      where: {
        plan: 'PRO',
        stripeCustomerId: null,
        trialEndsAt: { gte: maintenant, lte: dans3Jours },
        trialReminderSentAt: null,
      },
      include: {
        memberships: {
          where: { role: 'DIRECTEUR' },
          include: { user: { select: { id: true, email: true, firstName: true } } },
          take: 1,
        },
      },
    })

    for (const org of orgsJ3) {
      const directeur = org.memberships[0]?.user
      if (!directeur) continue

      const trialEnd = org.trialEndsAt!
      const daysLeft = Math.ceil((trialEnd.getTime() - maintenant.getTime()) / (24 * 60 * 60 * 1000))
      const trialEndDate = trialEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

      await sendEmail({
        to: directeur.email,
        subject: `⏰ Votre essai PRO se termine dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''} — ${org.name}`,
        html: trialEndingEmail({
          directeurPrenom: directeur.firstName,
          organizationName: org.name,
          daysLeft,
          trialEndDate,
          upgradeUrl,
        }),
      })

      await prisma.organization.update({
        where: { id: org.id },
        data: { trialReminderSentAt: maintenant },
      })

      await prisma.notification.create({
        data: {
          userId: directeur.id,
          organizationId: org.id,
          type: 'RGPD_AVERTISSEMENT', // réutilisation du type le plus proche
          priority: 'URGENT',
          title: `⏰ Essai PRO : ${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}`,
          body: `Votre période d'essai se termine le ${trialEndDate}. Souscrivez pour continuer.`,
          link: '/settings/organisation#facturation',
        },
      })

      avertissements++
    }

    // ── ÉTAPE 2 — Trial expiré ─────────────────────────────
    const orgsExpirees = await prisma.organization.findMany({
      where: {
        plan: 'PRO',
        stripeCustomerId: null,
        trialEndsAt: { lt: maintenant },
      },
      include: {
        memberships: {
          where: { role: 'DIRECTEUR' },
          include: { user: { select: { id: true, email: true, firstName: true } } },
          take: 1,
        },
      },
    })

    for (const org of orgsExpirees) {
      const directeur = org.memberships[0]?.user
      if (!directeur) continue

      // Compter les collaborateurs (sans requête sur champ inexistant)
      const nbCollabs = await prisma.organizationMembership.count({
        where: { organizationId: org.id, role: 'COLLABORATEUR' },
      })

      const casB = nbCollabs > 3
      const featuresLost = casB
        ? ['Création de nouvelles affectations', 'Relances de confirmation', 'DPAE avancée', 'Templates de projets']
        : ['Fonctionnalités avancées PRO désactivées']

      await prisma.organization.update({
        where: { id: org.id },
        data: {
          plan: 'FREE',
          isReadOnly: casB, // CAS B : lecture seule si quota FREE dépassé
        },
      })

      await sendEmail({
        to: directeur.email,
        subject: `❌ Votre essai PRO a expiré — ${org.name}`,
        html: trialExpiredEmail({
          directeurPrenom: directeur.firstName,
          organizationName: org.name,
          upgradeUrl,
          featuresLost,
        }),
      })

      await prisma.notification.create({
        data: {
          userId: directeur.id,
          organizationId: org.id,
          type: 'RGPD_AVERTISSEMENT',
          priority: 'CRITIQUE',
          title: `❌ Essai PRO expiré${casB ? ' — Mode lecture seule activé' : ''}`,
          body: casB
            ? 'Quota FREE dépassé. Votre compte est en lecture seule. Souscrivez ou réduisez le nombre de collaborateurs.'
            : 'Votre essai PRO a expiré. Vous êtes passé au plan Découverte.',
          link: '/settings/organisation#facturation',
          actionLabel: 'Choisir un plan',
        },
      })

      await prisma.activityLog.create({
        data: {
          userId: null,
          action: 'TRIAL_EXPIRED',
          entityType: 'Organization',
          entityId: org.id,
          metadata: { nbCollabs, casB, nouveauPlan: 'FREE', isReadOnly: casB },
        },
      })

      expirations++
    }

    console.log(`[cron/expiration-trial] ${avertissements} avertissements J-3, ${expirations} expirations`)
    return NextResponse.json({ avertissements, expirations })
  } catch (err) {
    void logger.error('cron/expiration-trial', err, { route: 'cron/expiration-trial' })
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
