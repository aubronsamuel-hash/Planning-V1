// ─────────────────────────────────────────────────────────
// GET /api/notifications/unread-count — Badge cloche navbar
// doc/13 §13.8 — polling 30s
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError } from '@/lib/api-response'

export async function GET() {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const count = await prisma.notification.count({
      where: {
        userId:         session.user.id,
        organizationId: session.user.organizationId!,
        read:           false,
        archivedAt:     null,
      },
    })

    return NextResponse.json({ count })
  } catch (err) {
    console.error('[GET /api/notifications/unread-count]', err)
    return internalError()
  }
}
