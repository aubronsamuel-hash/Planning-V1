// ─────────────────────────────────────────────────────────
// GET /api/cron/relance-confirmation
// Relance les intermittents EN_ATTENTE depuis > 48h sans réponse
// Fréquence : toutes les heures — idempotent (relanceSentAt guard)
// doc §21.1
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronSecret } from '@/lib/cron'
import { sendEmail, affectationConfirmationEmail } from '@/lib/email'

const SEUIL_48H = 48 * 60 * 60 * 1000

export async function GET(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  try {
    const cutoff = new Date(Date.now() - SEUIL_48H)

    // Affectations intermittentes EN_ATTENTE depuis > 48h, pas encore relancées
    const affectations = await prisma.affectation.findMany({
      where: {
        confirmationStatus: 'EN_ATTENTE',
        contractTypeUsed: 'INTERMITTENT',
        createdAt: { lt: cutoff },
        relanceSentAt: null,
        deletedAt: null,
        representation: {
          date: { gt: new Date() }, // pas encore passée
          status: { notIn: ['ANNULEE', 'REPORTEE'] },
        },
      },
      include: {
        collaborateur: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
        representation: {
          include: {
            projet: {
              select: { id: true, organizationId: true, title: true },
            },
          },
        },
        posteRequis: { select: { name: true } },
      },
      take: 100, // sécurité — max 100 par run
    })

    if (affectations.length === 0) {
      return NextResponse.json({ processed: 0, message: 'Aucune relance à envoyer' })
    }

    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    let processed = 0
    let errors = 0

    for (const aff of affectations) {
      try {
        const user = aff.collaborateur.user

        // Invalider les anciens tokens CONFIRMATION valides pour cette affectation
        await prisma.magicLinkToken.updateMany({
          where: {
            userId: user.id,
            purpose: 'CONFIRMATION',
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { usedAt: new Date() },
        })

        // Créer un nouveau token CONFIRMATION (7 jours)
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        const token = await prisma.magicLinkToken.create({
          data: {
            userId: user.id,
            purpose: 'CONFIRMATION',
            expiresAt,
          },
        })

        const confirmUrl = `${baseUrl}/affectation/${token.token}/confirmer`
        const refuseUrl = `${baseUrl}/affectation/${token.token}/refuser`

        const dateStr = new Date(aff.representation.date).toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })

        // Envoyer email de relance
        await sendEmail({
          to: user.email,
          subject: `⏳ Rappel — Confirmez votre présence : ${aff.representation.projet.title} · ${dateStr}`,
          html: affectationConfirmationEmail({
            collaborateurPrenom: user.firstName,
            projetTitre: aff.representation.projet.title,
            representationTitre: aff.representation.projet.title,
            representationDate: dateStr,
            representationLieu: [aff.representation.venueName, aff.representation.venueCity].filter(Boolean).join(', ') || 'À confirmer',
            posteLabel: aff.posteRequis.name,
            confirmUrl,
            refuserUrl: refuseUrl,
          }),
        })

        // Marquer la relance envoyée
        await prisma.affectation.update({
          where: { id: aff.id },
          data: { relanceSentAt: new Date() },
        })

        // Notification in-app au régisseur
        const regisseurs = await prisma.user.findMany({
          where: {
            memberships: {
              some: {
                organizationId: aff.representation.projet.organizationId,
                role: 'REGISSEUR',
              },
            },
          },
          select: { id: true },
        })

        if (regisseurs.length > 0) {
          await prisma.notification.createMany({
            data: regisseurs.map((r) => ({
              userId: r.id,
              organizationId: aff.representation.projet.organizationId,
              type: 'CONFIRMATION_REQUISE' as const,
              priority: 'INFO' as const,
              title: `⏳ Relance envoyée à ${user.firstName} ${user.lastName}`,
              body: `${user.firstName} ${user.lastName} n'a toujours pas répondu à ${aff.representation.projet.title} · ${dateStr}`,
              link: `/projets/${aff.representation.projet.id}`,
              relatedId: aff.id,
              relatedType: 'affectation',
            })),
          })
        }

        await prisma.activityLog.create({
          data: {
            userId: null,
            action: 'RELANCE_CONFIRMATION_ENVOYEE',
            entityType: 'Affectation',
            entityId: aff.id,
            metadata: {
              collaborateurEmail: user.email,
              projetId: aff.representation.projet.id,
            },
          },
        })

        processed++
      } catch (err) {
        console.error(`[cron/relance-confirmation] Erreur affectation ${aff.id}:`, err)
        errors++
      }
    }

    console.log(`[cron/relance-confirmation] ${processed} relances envoyées, ${errors} erreurs`)
    return NextResponse.json({ processed, errors })
  } catch (err) {
    console.error('[cron/relance-confirmation]', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
