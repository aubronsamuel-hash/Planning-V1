// ─────────────────────────────────────────────────────────
// PATCH  /api/vehicule-assignments/[id] — Modifier un trajet
// DELETE /api/vehicule-assignments/[id] — Supprimer un trajet
// doc/19-module-tournee.md §19.2
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { conflict, internalError, notFound, validationError } from '@/lib/api-response'

const PassagerSchema = z.object({
  collaborateurId: z.string(),
  role: z.enum(['CONDUCTEUR', 'PASSAGER']),
})

const PatchAssignmentSchema = z.object({
  departLieu: z.string().max(200).nullable().optional(),
  departTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  arriveeEstimeeTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  // Si fourni, remplace tous les passagers existants
  passagers: z.array(PassagerSchema).optional(),
})

async function loadAssignment(id: string, organizationId: string) {
  return prisma.vehiculeAssignment.findFirst({
    where: { id },
    include: {
      vehicule: { select: { organizationId: true } },
    },
  }).then((a) => {
    if (!a) return null
    if (a.vehicule.organizationId !== organizationId) return null
    return a
  })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const assignment = await loadAssignment(params.id, session.user.organizationId!)
    if (!assignment) return notFound('Assignation transport')

    const body = await req.json()
    const parsed = PatchAssignmentSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { passagers, ...rest } = parsed.data

    // Contrainte conducteur unique si passagers fournis
    if (passagers !== undefined) {
      const conducteurs = passagers.filter((p) => p.role === 'CONDUCTEUR')
      if (conducteurs.length > 1) {
        return conflict('Un seul conducteur autorisé par véhicule et représentation')
      }
    }

    if (passagers !== undefined) {
      await prisma.$transaction([
        prisma.vehiculeAssignment.update({ where: { id: params.id }, data: rest }),
        prisma.vehiculePassager.deleteMany({ where: { vehiculeAssignmentId: params.id } }),
        ...(passagers.length > 0
          ? [prisma.vehiculePassager.createMany({
              data: passagers.map((p) => ({
                vehiculeAssignmentId: params.id,
                collaborateurId: p.collaborateurId,
                role: p.role,
              })),
            })]
          : []
        ),
      ])
    } else {
      await prisma.vehiculeAssignment.update({ where: { id: params.id }, data: rest })
    }

    const updated = await prisma.vehiculeAssignment.findUnique({
      where: { id: params.id },
      include: {
        vehicule: { select: { id: true, label: true, type: true, capacitePersonnes: true } },
        passagers: {
          include: {
            collaborateur: {
              include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } },
            },
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/vehicule-assignments/[id]]', err)
    return internalError()
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const assignment = await loadAssignment(params.id, session.user.organizationId!)
    if (!assignment) return notFound('Assignation transport')

    await prisma.vehiculeAssignment.delete({ where: { id: params.id } })

    return new Response(null, { status: 204 })
  } catch (err) {
    console.error('[DELETE /api/vehicule-assignments/[id]]', err)
    return internalError()
  }
}
