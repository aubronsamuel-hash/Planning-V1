// ─────────────────────────────────────────────────────────
// GET /api/collaborateurs — Liste des membres de l'organisation
// doc/07 §7.1 · Annuaire de l'organisation
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError } from '@/lib/api-response'
import logger from '@/lib/logger'

export async function GET(req: Request) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const organizationId = session.user.organizationId!
    const { searchParams } = new URL(req.url)
    const q        = searchParams.get('q') ?? ''
    const contrat  = searchParams.get('contrat') ?? ''
    const projetId = searchParams.get('projetId') ?? ''

    // Récupérer tous les membres de l'org avec leur profil
    const memberships = await prisma.organizationMembership.findMany({
      where: {
        organizationId,
        joinedAt: { not: null },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    })

    // Récupérer les collaborateurs (données RH org-specific)
    // Collaborateur n'a pas de organizationId — on filtre par les userId des membres de l'org
    const memberUserIds = memberships.map((m) => m.userId)
    const collaborateurs = await prisma.collaborateur.findMany({
      where: { userId: { in: memberUserIds } },
      include: {
        affectations: {
          where: { deletedAt: null },
          include: {
            representation: {
              include: {
                projet: { select: { id: true, title: true, colorCode: true, status: true } },
              },
            },
            posteRequis: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    // Indexer collaborateurs par userId
    const collabByUserId = new Map(collaborateurs.map((c) => [c.userId, c]))

    // Assembler la liste
    let liste = memberships
      .map((m) => {
        const collab = collabByUserId.get(m.userId)

        // Projets actifs de ce collaborateur
        const projetsActifs = collab
          ? Array.from(
              new Map(
                collab.affectations
                  .filter((a) =>
                    ['EN_PREPARATION', 'EN_COURS'].includes(a.representation.projet.status)
                  )
                  .map((a) => [a.representation.projet.id, a.representation.projet])
              ).values()
            )
          : []

        // Statut DPAE : cherche si une affectation a dpaeStatus = A_FAIRE
        const hasDpaeAFaire = collab
          ? collab.affectations.some((a) => a.dpaeStatus === 'A_FAIRE')
          : false

        return {
          userId: m.userId,
          collaborateurId: collab?.id ?? null,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl ?? null,
          orgRole: m.role,
          accountStatus: collab?.accountStatus ?? null,
          contractType: collab?.contractType ?? null,
          projetsActifs,
          hasDpaeAFaire,
          joinedAt: m.joinedAt?.toISOString() ?? null,
        }
      })
      // Filtres
      .filter((m) => {
        if (q) {
          const search = q.toLowerCase()
          if (
            !m.firstName.toLowerCase().includes(search) &&
            !m.lastName.toLowerCase().includes(search) &&
            !m.email.toLowerCase().includes(search)
          ) return false
        }
        if (contrat && m.contractType !== contrat) return false
        if (projetId) {
          if (!m.projetsActifs.some((p) => p.id === projetId)) return false
        }
        return true
      })
      .sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`))

    return NextResponse.json(liste)
  } catch (err) {
    void logger.error('GET /api/collaborateurs', err, { route: 'GET /api/collaborateurs' })
    return internalError()
  }
}
