// ─────────────────────────────────────────────────────────
// GET /api/cron/archivage-projets
// Archive les projets TERMINE dont la dernière représentation est passée depuis > 30 jours
// Fréquence : hebdomadaire, lundi à 4h00 — idempotent
// doc §21.6
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronSecret } from '@/lib/cron'
import logger from '@/lib/logger'

export async function GET(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  try {
    const il_y_a_30_jours = new Date()
    il_y_a_30_jours.setDate(il_y_a_30_jours.getDate() - 30)

    // Projets TERMINE dont toutes les représentations sont passées depuis > 30 jours
    const projetsAArchiver = await prisma.projet.findMany({
      where: {
        status: 'TERMINE',
        deletedAt: null,
      },
      include: {
        representations: {
          where: { deletedAt: null },
          select: { date: true },
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    })

    const eligibles = projetsAArchiver.filter((p) => {
      if (p.representations.length === 0) return true // pas de représentation → archivable
      const derniereDate = new Date(p.representations[0].date)
      return derniereDate < il_y_a_30_jours
    })

    if (eligibles.length === 0) {
      return NextResponse.json({ archived: 0, message: 'Aucun projet à archiver' })
    }

    const ids = eligibles.map((p) => p.id)

    await prisma.projet.updateMany({
      where: { id: { in: ids } },
      data: { status: 'ARCHIVE' },
    })

    await prisma.activityLog.createMany({
      data: ids.map((id) => ({
        userId: null,
        action: 'PROJET_ARCHIVE' as const,
        entityType: 'Projet',
        entityId: id,
        metadata: { source: 'cron', motif: 'Archivage automatique après 30 jours' },
      })),
    })

    console.log(`[cron/archivage-projets] ${eligibles.length} projets archivés`)
    return NextResponse.json({ archived: eligibles.length })
  } catch (err) {
    void logger.error('cron/archivage-projets', err, { route: 'cron/archivage-projets' })
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
