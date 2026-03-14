// ─────────────────────────────────────────────────────────
// POST /api/feuille-de-route/[id]/copier-depuis
// Copie phases, contacts, transportInfo et notesGenerales d'une FDR source
// doc/11 §11.9.3 — seules sources PUBLIEE ou ARCHIVEE acceptées
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import logger from '@/lib/logger'

const CopierDepuisSchema = z.object({
  sourceFeuilleDeRouteId: z.string().cuid(),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const orgId = session.user.organizationId!

    // Charger la FDR de destination
    const fdrDest = await prisma.feuilleDeRoute.findFirst({
      where: { id: params.id },
      include: {
        representation: {
          include: { projet: { select: { id: true, organizationId: true } } },
        },
      },
    })
    if (!fdrDest) return notFound('Feuille de route destination')
    if (fdrDest.representation.projet.organizationId !== orgId) {
      return NextResponse.json({ error: 'Accès refusé', code: 'FORBIDDEN' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = CopierDepuisSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    // Charger la FDR source — doit appartenir au même projet et être PUBLIEE ou ARCHIVEE (§11.9.3)
    const fdrSource = await prisma.feuilleDeRoute.findFirst({
      where: {
        id: parsed.data.sourceFeuilleDeRouteId,
        statut: { in: ['PUBLIEE', 'ARCHIVEE'] },
        representation: { projetId: fdrDest.representation.projet.id },
      },
      include: {
        phases:   { orderBy: { ordre: 'asc' } },
        contacts: true,
      },
    })
    if (!fdrSource) {
      return NextResponse.json(
        { error: 'Source introuvable ou non éligible (doit être PUBLIEE ou ARCHIVEE)', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Supprimer les phases et contacts existants de la destination puis recréer
    await prisma.$transaction([
      prisma.phaseJournee.deleteMany({ where: { feuilleDeRouteId: params.id } }),
      prisma.contactLocal.deleteMany({ where: { feuilleDeRouteId: params.id } }),
      prisma.feuilleDeRoute.update({
        where: { id: params.id },
        data: {
          transportInfo:  fdrSource.transportInfo,
          notesGenerales: fdrSource.notesGenerales,
          // Statut repart en BROUILLON — publishedAt réinitialisé (§11.9.3)
          statut:      'BROUILLON',
          publishedAt: null,
          phases: {
            create: fdrSource.phases.map((p) => ({
              ordre:       p.ordre,
              type:        p.type,
              labelCustom: p.labelCustom,
              startTime:   p.startTime,
              endTime:     p.endTime,
              lieu:        p.lieu,
              notes:       p.notes,
            })),
          },
          contacts: {
            create: fdrSource.contacts.map((c) => ({
              nom:       c.nom,
              role:      c.role,
              type:      c.type,
              telephone: c.telephone,
              email:     c.email,
              notes:     c.notes,
            })),
          },
        },
      }),
    ])

    // Retourner la FDR mise à jour
    const updated = await prisma.feuilleDeRoute.findUnique({
      where: { id: params.id },
      include: {
        phases:   { orderBy: { ordre: 'asc' } },
        contacts: { orderBy: [{ type: 'asc' }, { nom: 'asc' }] },
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    void logger.error('POST /api/feuille-de-route/[id]/copier-depuis', err, { route: 'POST /api/feuille-de-route/[id]/copier-depuis' })
    return internalError()
  }
}
