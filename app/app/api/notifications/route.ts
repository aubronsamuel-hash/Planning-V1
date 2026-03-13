// ─────────────────────────────────────────────────────────
// GET  /api/notifications — Liste paginée (10 par page)
// PATCH /api/notifications — Marquer une notif comme lue
// doc/13 §13.8
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError, validationError } from '@/lib/api-response'

export async function GET(req: Request) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const { searchParams } = new URL(req.url)
    const cursor = searchParams.get('cursor') // id de la dernière notif chargée
    const limit  = Math.min(Number(searchParams.get('limit') ?? 20), 50)

    const notifications = await prisma.notification.findMany({
      where: {
        userId:         session.user.id,
        organizationId: session.user.organizationId!,
        archivedAt:     null,
      },
      orderBy: [
        { priority: 'desc' }, // CRITIQUE > URGENT > INFO
        { createdAt: 'desc' },
      ],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = notifications.length > limit
    const items   = hasMore ? notifications.slice(0, limit) : notifications

    return NextResponse.json({ notifications: items, hasMore })
  } catch (err) {
    console.error('[GET /api/notifications]', err)
    return internalError()
  }
}

const PatchSchema = z.object({
  id:   z.string().cuid(),
  read: z.boolean(),
})

export async function PATCH(req: Request) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const body = await req.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const notif = await prisma.notification.findFirst({
      where: {
        id:             parsed.data.id,
        userId:         session.user.id,
        organizationId: session.user.organizationId!,
      },
    })
    if (!notif) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

    const updated = await prisma.notification.update({
      where: { id: parsed.data.id },
      data: {
        read:   parsed.data.read,
        readAt: parsed.data.read ? new Date() : null,
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/notifications]', err)
    return internalError()
  }
}
