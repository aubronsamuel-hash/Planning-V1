// ─────────────────────────────────────────────────────────
// GET   /api/feuille-de-route/[id]  — lecture complète
// PATCH /api/feuille-de-route/[id]  — notesGenerales + transportInfo
// doc/11 §11.4, §11.6
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import { broadcastNotification } from '@/lib/notifications.server'

const PatchFdrSchema = z.object({
  notesGenerales: z.string().max(2000).nullable().optional(),
  transportInfo:  z.string().max(2000).nullable().optional(),
})

// ── Helper : résoudre l'orgId depuis une FDR ───────────────
async function resolveFdr(id: string) {
  return prisma.feuilleDeRoute.findFirst({
    where: { id },
    include: {
      representation: {
        include: {
          projet: { select: { organizationId: true, title: true } },
        },
      },
      phases:   { orderBy: { ordre: 'asc' } },
      contacts: { orderBy: [{ type: 'asc' }, { nom: 'asc' }] },
    },
  })
}

// ── GET ────────────────────────────────────────────────────
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const fdr = await resolveFdr(params.id)
    if (!fdr) return notFound('Feuille de route')
    if (fdr.representation.projet.organizationId !== session.user.organizationId!) {
      return NextResponse.json({ error: 'Accès refusé', code: 'FORBIDDEN' }, { status: 403 })
    }

    return NextResponse.json(fdr)
  } catch (err) {
    console.error('[GET /api/feuille-de-route/[id]]', err)
    return internalError()
  }
}

// ── PATCH ──────────────────────────────────────────────────
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const fdr = await resolveFdr(params.id)
    if (!fdr) return notFound('Feuille de route')
    if (fdr.representation.projet.organizationId !== session.user.organizationId!) {
      return NextResponse.json({ error: 'Accès refusé', code: 'FORBIDDEN' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = PatchFdrSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const updated = await prisma.feuilleDeRoute.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.notesGenerales !== undefined && { notesGenerales: parsed.data.notesGenerales }),
        ...(parsed.data.transportInfo  !== undefined && { transportInfo:  parsed.data.transportInfo  }),
      },
      include: {
        phases:   { orderBy: { ordre: 'asc' } },
        contacts: { orderBy: [{ type: 'asc' }, { nom: 'asc' }] },
      },
    })

    // Si déjà publiée → notifier les collaborateurs de la modification (§11.6)
    if (fdr.statut === 'PUBLIEE') {
      await notifierModification(params.id, fdr.representation, session.user.organizationId!)
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'FEUILLE_DE_ROUTE_MODIFIEE',
          entityType: 'FeuilleDeRoute',
          entityId: params.id,
        },
      })
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/feuille-de-route/[id]]', err)
    return internalError()
  }
}

// ── Helper : notifier tous les collaborateurs affectés ─────
export async function notifierModification(
  fdrId: string,
  representation: { id: string; date: Date; projet: { title: string; organizationId: string } },
  organizationId: string
) {
  const affectations = await prisma.affectation.findMany({
    where: {
      representationId: representation.id,
      confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE'] },
    },
    include: { collaborateur: { select: { userId: true, accountStatus: true } } },
  })

  const userIds = affectations
    .filter((a) => a.collaborateur.accountStatus === 'ACTIVE')
    .map((a) => a.collaborateur.userId)

  if (userIds.length === 0) return

  const dateStr = representation.date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })

  await broadcastNotification(userIds, {
    organizationId,
    type: 'FEUILLE_DE_ROUTE_MODIFIEE',
    body: `La feuille de route pour ${representation.projet.title} · ${dateStr} a été mise à jour.`,
    link: `/mon-planning/${representation.id}/feuille-de-route`,
  })
}
