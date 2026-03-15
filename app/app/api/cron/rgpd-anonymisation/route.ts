// ─────────────────────────────────────────────────────────
// GET /api/cron/rgpd-anonymisation
// Anonymise les comptes inactifs depuis 3 ans (RGPD)
// Fréquence : mensuel, 1er du mois à 2h00 — idempotent
// doc §21.5
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronSecret } from '@/lib/cron'
import { sendEmail, rgpdWarningEmail } from '@/lib/email'
import { randomUUID } from 'crypto'
import logger from '@/lib/logger'

const SEUIL_3ANS_MS = 3 * 365 * 24 * 60 * 60 * 1000
const SEUIL_2ANS11MOIS_MS = (3 * 365 - 30) * 24 * 60 * 60 * 1000

export async function GET(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  try {
    const maintenant = new Date()
    const seuil3Ans = new Date(maintenant.getTime() - SEUIL_3ANS_MS)
    const seuil2Ans11Mois = new Date(maintenant.getTime() - SEUIL_2ANS11MOIS_MS)
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const dateAnonymisation = new Date(maintenant.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

    let avertissements = 0
    let anonymisations = 0

    // ── ÉTAPE 1 — Avertissement 30 jours avant ────────────
    const usersAvertir = await prisma.user.findMany({
      where: {
        anonymizedAt: null,
        rgpdWarningAt: null,
        OR: [
          { lastActiveAt: { lt: seuil2Ans11Mois, not: null } },
          { lastActiveAt: null, createdAt: { lt: seuil2Ans11Mois } },
        ],
      },
      select: { id: true, email: true, firstName: true },
      take: 200,
    })

    for (const user of usersAvertir) {
      try {
        await sendEmail({
          to: user.email,
          subject: '⚠️ Votre compte Planning sera anonymisé dans 30 jours',
          html: rgpdWarningEmail({
            userPrenom: user.firstName,
            anonymizeDate: dateAnonymisation,
            reactivationUrl: `${baseUrl}/login`,
          }),
        })

        await prisma.user.update({
          where: { id: user.id },
          data: { rgpdWarningAt: maintenant },
        })

        await prisma.activityLog.create({
          data: {
            userId: null,
            action: 'RGPD_WARNING_SENT',
            entityType: 'User',
            entityId: user.id,
            metadata: { email: user.email },
          },
        })

        avertissements++
      } catch (err) {
        void logger.error('cron/rgpd Erreur avertissement user ${user.id}', err, { route: 'cron/rgpd' })
      }
    }

    // ── ÉTAPE 2 — Anonymisation effective ─────────────────
    const usersAAnonymiser = await prisma.user.findMany({
      where: {
        anonymizedAt: null,
        OR: [
          { lastActiveAt: { lt: seuil3Ans, not: null } },
          { lastActiveAt: null, createdAt: { lt: seuil3Ans } },
        ],
      },
      include: {
        collaborateur: { select: { id: true } },
      },
      take: 100,
    })

    for (const user of usersAAnonymiser) {
      try {
        const uuid = randomUUID()

        await prisma.$transaction(async (tx) => {
          // Anonymiser le compte User
          await tx.user.update({
            where: { id: user.id },
            data: {
              firstName: 'Collaborateur',
              lastName: 'Anonymisé',
              email: `anonyme_${uuid}@supprime.invalid`,
              phone: null,
              anonymizedAt: maintenant,
            },
          })

          // Effacer les données sensibles du Collaborateur (NSS, IBAN)
          if (user.collaborateur) {
            await tx.collaborateur.update({
              where: { id: user.collaborateur.id },
              data: {
                socialSecurityNumber: null,
                iban: null,
                anonymizedAt: maintenant,
              },
            })
          }

          await tx.activityLog.create({
            data: {
              userId: null,
              action: 'USER_ANONYMIZED',
              entityType: 'User',
              entityId: user.id,
              metadata: { uuid, nbCollaborateurs: user.collaborateur ? 1 : 0 },
            },
          })
        })

        anonymisations++
      } catch (err) {
        void logger.error('cron/rgpd Erreur anonymisation user ${user.id}', err, { route: 'cron/rgpd' })
      }
    }

    console.log(`[cron/rgpd-anonymisation] ${avertissements} avertissements · ${anonymisations} anonymisations`)
    return NextResponse.json({ avertissements, anonymisations })
  } catch (err) {
    void logger.error('cron/rgpd-anonymisation', err, { route: 'cron/rgpd-anonymisation' })
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
