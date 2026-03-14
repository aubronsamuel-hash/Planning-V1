// ─────────────────────────────────────────────────────────
// GET  /api/admin/admins — Liste des Super Admins
// POST /api/admin/admins — Promouvoir un User en SUPER_ADMIN
// doc/17-back-office-super-admin.md §17.6
// Accès : SUPER_ADMIN uniquement
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth'
import { internalError, validationError } from '@/lib/api-response'

export async function GET() {
  try {
    const { session, error } = await requireSuperAdmin()
    if (error) return error

    const admins = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN', anonymizedAt: null },
      select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ admins, me: { id: session.user.id } })
  } catch (err) {
    console.error('[GET /api/admin/admins]', err)
    return internalError()
  }
}

const AddAdminSchema = z.object({
  email: z.string().email(),
})

export async function POST(req: Request) {
  try {
    const { session, error } = await requireSuperAdmin()
    if (error) return error

    const body   = await req.json()
    const parsed = AddAdminSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { email } = parsed.data

    const user = await prisma.user.findFirst({
      where: { email, anonymizedAt: null },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Aucun compte trouvé avec cet email.' },
        { status: 404 }
      )
    }

    if (user.role === 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Cet utilisateur est déjà Super Admin.' },
        { status: 409 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { role: 'SUPER_ADMIN' },
      })

      await tx.activityLog.create({
        data: {
          userId:     session.user.id,
          action:     'MEMBER_ROLE_CHANGED',
          entityType: 'User',
          entityId:   user.id,
          metadata:   { email: user.email, newRole: 'SUPER_ADMIN', addedBy: session.user.email },
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/admin/admins]', err)
    return internalError()
  }
}
