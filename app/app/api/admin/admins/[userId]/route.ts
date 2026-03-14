// ─────────────────────────────────────────────────────────
// DELETE /api/admin/admins/[userId] — Retirer un Super Admin
// doc/17-back-office-super-admin.md §17.6
// Accès : SUPER_ADMIN uniquement
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth'
import { internalError, notFound } from '@/lib/api-response'

export async function DELETE(
  _req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const { session, error } = await requireSuperAdmin()
    if (error) return error

    const { userId } = params

    if (userId === session.user.id) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas retirer votre propre accès Super Admin.' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, role: 'SUPER_ADMIN', anonymizedAt: null },
    })

    if (!user) return notFound('Administrateur')

    // Vérifier qu'il reste au moins 1 SUPER_ADMIN après suppression
    const count = await prisma.user.count({ where: { role: 'SUPER_ADMIN', anonymizedAt: null } })
    if (count <= 1) {
      return NextResponse.json(
        { error: 'Impossible de retirer le dernier Super Admin.' },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { role: 'MEMBER' },
      })

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          action:     'MEMBER_ROLE_CHANGED',
          entityType: 'User',
          entityId:   userId,
          metadata:   { email: user.email, newRole: 'MEMBER', removedBy: session.user.email },
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/admin/admins/[userId]]', err)
    return internalError()
  }
}
