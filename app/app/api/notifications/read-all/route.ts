// ─────────────────────────────────────────────────────────
// POST /api/notifications/read-all — Tout marquer comme lu
// doc/13 §13.8
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError } from '@/lib/api-response'
import logger from '@/lib/logger'

export async function POST() {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const now = new Date()
    await prisma.notification.updateMany({
      where: {
        userId:         session.user.id,
        organizationId: session.user.organizationId!,
        read:           false,
        archivedAt:     null,
      },
      data: { read: true, readAt: now },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    void logger.error('POST /api/notifications/read-all', err, { route: 'POST /api/notifications/read-all' })
    return internalError()
  }
}
