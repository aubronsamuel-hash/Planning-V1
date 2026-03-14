// ─────────────────────────────────────────────────────────
// POST /api/templates/[id]/apply — Appliquer un template à un projet
// doc/08 §8.3 — Crée les équipes et postes requis
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { internalError, validationError, notFound } from '@/lib/api-response'
import logger from '@/lib/logger'

const ApplySchema = z.object({ projetId: z.string().cuid() })

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const organizationId = session.user.organizationId!

    const body = await req.json()
    const parsed = ApplySchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    // Charger le template
    const template = await prisma.projetTemplate.findFirst({
      where: { id: params.id },
      include: {
        equipes: { include: { postes: true } },
      },
    })
    if (!template) return notFound('Template')

    const ownershipError = verifyOwnership(template.organizationId, organizationId)
    if (ownershipError) return ownershipError

    // Vérifier le projet cible
    const projet = await prisma.projet.findFirst({
      where: { id: parsed.data.projetId, organizationId, deletedAt: null },
    })
    if (!projet) return notFound('Projet')

    // Appliquer le template (transaction)
    await prisma.$transaction(async (tx) => {
      for (const equipeTemplate of template.equipes) {
        const equipe = await tx.equipe.create({
          data: {
            projetId: projet.id,
            name: equipeTemplate.name,
            icon: equipeTemplate.icon,
            // Le chef d'équipe se gère via EquipeMembre.role: CHEF, pas sur Equipe directement
          },
        })

        for (const poste of equipeTemplate.postes) {
          await tx.posteRequis.create({
            data: {
              projetId:             projet.id,
              equipeId:             equipe.id,
              name:                 poste.name,
              requiredCount:        poste.requiredCount,
              isCritique:           poste.isCritique,
              contractTypePreference: poste.contractTypePreference,
              defaultStartTime:     poste.defaultStartTime,
              defaultEndTime:       poste.defaultEndTime,
            },
          })
        }
      }
    })

    return NextResponse.json({ ok: true, message: 'Template appliqué avec succès' })
  } catch (err) {
    void logger.error('POST /api/templates/[id]/apply', err, { route: 'POST /api/templates/[id]/apply' })
    return internalError()
  }
}
