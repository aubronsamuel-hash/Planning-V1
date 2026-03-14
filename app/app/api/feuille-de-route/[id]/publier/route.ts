// ─────────────────────────────────────────────────────────
// POST /api/feuille-de-route/[id]/publier
// Publie la feuille de route → statut PUBLIEE + notifications (§11.6)
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError, notFound } from '@/lib/api-response'
import { broadcastNotification } from '@/lib/notifications.server'
import logger from '@/lib/logger'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const fdr = await prisma.feuilleDeRoute.findFirst({
      where: { id: params.id },
      include: {
        representation: {
          include: {
            projet: { select: { id: true, title: true, organizationId: true } },
          },
        },
      },
    })
    if (!fdr) return notFound('Feuille de route')
    if (fdr.representation.projet.organizationId !== session.user.organizationId!) {
      return NextResponse.json({ error: 'Accès refusé', code: 'FORBIDDEN' }, { status: 403 })
    }
    if (fdr.statut === 'ARCHIVEE') {
      return NextResponse.json(
        { error: 'Une feuille archivée ne peut pas être republiée', code: 'INVALID_STATE' },
        { status: 422 }
      )
    }

    const estDejaPubliee = fdr.statut === 'PUBLIEE'

    // Publier
    const updated = await prisma.feuilleDeRoute.update({
      where: { id: params.id },
      data: {
        statut: 'PUBLIEE',
        publishedAt: fdr.publishedAt ?? new Date(), // conserver la date initiale si re-publiée
      },
    })

    // Récupérer tous les collaborateurs actifs affectés
    const affectations = await prisma.affectation.findMany({
      where: {
        representationId: fdr.representationId,
        confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE'] },
      },
      include: {
        collaborateur: { select: { userId: true, accountStatus: true } },
      },
    })

    const userIds = affectations
      .filter((a) => a.collaborateur.accountStatus === 'ACTIVE')
      .map((a) => a.collaborateur.userId)

    const dateStr = fdr.representation.date.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    })
    const projetTitle = fdr.representation.projet.title
    const organizationId = session.user.organizationId!
    const link = `/mon-planning/${fdr.representationId}/feuille-de-route`

    if (userIds.length > 0) {
      if (estDejaPubliee) {
        // Re-publication après modification → FEUILLE_DE_ROUTE_MODIFIEE
        await broadcastNotification(userIds, {
          organizationId,
          type: 'FEUILLE_DE_ROUTE_MODIFIEE',
          body: `La feuille de route pour ${projetTitle} · ${dateStr} a été mise à jour.`,
          link,
        })
      } else {
        // Première publication → FEUILLE_DE_ROUTE_PUBLIEE
        await broadcastNotification(userIds, {
          organizationId,
          type: 'FEUILLE_DE_ROUTE_PUBLIEE',
          body: `📋 La feuille de route pour ${projetTitle} · ${dateStr} est disponible.`,
          link,
          actionLabel: 'Voir',
        })
      }
    }

    // Activity log
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: estDejaPubliee ? 'FEUILLE_DE_ROUTE_MODIFIEE' : 'FEUILLE_DE_ROUTE_PUBLIEE',
        entityType: 'FeuilleDeRoute',
        entityId: params.id,
        metadata: {
          representationId: fdr.representationId,
          projetId: fdr.representation.projet.id,
          collaborateursNotifies: userIds.length,
        },
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    void logger.error('POST /api/feuille-de-route/[id]/publier', err, { route: 'POST /api/feuille-de-route/[id]/publier' })
    return internalError()
  }
}
