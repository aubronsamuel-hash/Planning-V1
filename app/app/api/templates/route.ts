// ─────────────────────────────────────────────────────────
// GET  /api/templates — Liste des templates de l'org
// POST /api/templates — Créer un template depuis un projet
// doc/08 §8.1-§8.2
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError, validationError } from '@/lib/api-response'
import logger from '@/lib/logger'

export async function GET() {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const organizationId = session.user.organizationId!

    const templates = await prisma.projetTemplate.findMany({
      where: { organizationId },
      include: {
        equipes: {
          include: { postes: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      projetType: t.projetType,
      icon: t.icon,
      nbEquipes: t.equipes.length,
      nbPostes: t.equipes.reduce((s, e) => s + e.postes.length, 0),
      createdAt: t.createdAt.toISOString(),
    }))

    return NextResponse.json(result)
  } catch (err) {
    void logger.error('GET /api/templates', err, { route: 'GET /api/templates' })
    return internalError()
  }
}

const CreateTemplateSchema = z.object({
  projetId:       z.string().cuid(),
  name:           z.string().min(1).max(100),
  description:    z.string().max(300).optional(),
  inclureCollabs: z.boolean().default(false),
  inclureHoraires: z.boolean().default(true),
})

export async function POST(req: Request) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const organizationId = session.user.organizationId!

    const body = await req.json()
    const parsed = CreateTemplateSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { projetId, name, description, inclureCollabs, inclureHoraires } = parsed.data

    // Charger le projet source avec ses équipes et postes
    const projet = await prisma.projet.findFirst({
      where: { id: projetId, organizationId, deletedAt: null },
      include: {
        equipes: {
          include: {
            postesRequis: true,
            membres: {
              include: {
                user: { select: { id: true } },
              },
            },
          },
        },
      },
    })
    if (!projet) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })

    // Créer le template en transaction
    const template = await prisma.$transaction(async (tx) => {
      const tpl = await tx.projetTemplate.create({
        data: {
          organizationId,
          name,
          description,
          projetType: projet.type,
          sourceProjetId: projetId,
          createdById: session.user.id,
        },
      })

      for (const equipe of projet.equipes) {
        const equipeTemplate = await tx.equipeTemplate.create({
          data: {
            projetTemplateId: tpl.id,
            name: equipe.name,
            icon: equipe.icon,
          },
        })

        for (const poste of equipe.postesRequis) {
          const posteData: Record<string, unknown> = {
            equipeTemplateId: equipeTemplate.id,
            name:              poste.name,
            requiredCount:     poste.requiredCount,
            isCritique:        poste.isCritique,
            contractTypePreference: poste.contractTypePreference,
          }
          if (inclureHoraires) {
            posteData.defaultStartTime = poste.defaultStartTime
            posteData.defaultEndTime   = poste.defaultEndTime
          }

          await tx.posteRequisTemplate.create({ data: posteData })
        }
      }

      return tpl
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'TEMPLATE_CREATED' as never, // cast car hors enum standard
        entityType: 'ProjetTemplate',
        entityId: template.id,
        metadata: { name, projetId },
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (err) {
    void logger.error('POST /api/templates', err, { route: 'POST /api/templates' })
    return internalError()
  }
}
