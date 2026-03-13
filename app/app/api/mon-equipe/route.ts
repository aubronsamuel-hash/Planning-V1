// ─────────────────────────────────────────────────────────
// GET /api/mon-equipe?projetId= — Dashboard Chef de poste
// doc/09 §9.1-§9.4
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError } from '@/lib/api-response'

export async function GET(req: Request) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const organizationId = session.user.organizationId!
    const { searchParams } = new URL(req.url)
    const projetId = searchParams.get('projetId')

    // Équipes dont le user est CHEF
    const chefEquipes = await prisma.equipeMembre.findMany({
      where: {
        userId: session.user.id,
        role: 'CHEF',
        equipe: {
          projet: {
            organizationId,
            status: { in: ['EN_PREPARATION', 'EN_COURS'] },
            deletedAt: null,
          },
        },
      },
      include: {
        equipe: {
          include: {
            projet: { select: { id: true, title: true, colorCode: true } },
            membres: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true } },
              },
            },
            postes: {
              include: {
                affectations: {
                  where: {
                    deletedAt: null,
                    confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE'] },
                  },
                  include: {
                    representation: { select: { id: true, date: true, showStartTime: true, venueName: true } },
                    collaborateur: {
                      include: { user: { select: { firstName: true, lastName: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (chefEquipes.length === 0) {
      return NextResponse.json({ equipes: [], projets: [] })
    }

    // Projets distincts
    const projetsMap = new Map<string, { id: string; title: string; colorCode: string }>()
    for (const ce of chefEquipes) {
      const p = ce.equipe.projet
      projetsMap.set(p.id, p)
    }
    const projets = Array.from(projetsMap.values())

    // Filtrer par projetId si fourni
    const equipes = chefEquipes
      .filter((ce) => !projetId || ce.equipe.projet.id === projetId)
      .map((ce) => {
        const equipe = ce.equipe
        const now    = new Date()
        const J7     = new Date(now.getTime() + 7  * 24 * 60 * 60 * 1000)
        const J14    = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

        // Alertes : postes non pourvus + confirmations en attente
        const alertes: {
          type: 'POSTE_MANQUANT' | 'EN_ATTENTE'
          urgence: 'CRITIQUE' | 'URGENT' | 'PLANIFIER'
          representationDate: string
          showStartTime: string | null
          venueName: string | null
          posteNom: string
          representationId: string
          collaborateurNom?: string
          affectationId?: string
        }[] = []

        // Planning 14 jours
        const planning14j: {
          representationId: string
          date: string
          showStartTime: string | null
          venueName: string | null
          postes: {
            nom: string
            requis: number
            affectations: {
              id: string
              collaborateurNom: string
              confirmationStatus: string
              contractType: string
            }[]
          }[]
        }[] = []

        // Représentations futures des 14 prochains jours (via affectations)
        const reprsMap = new Map<string, typeof planning14j[0]>()

        for (const poste of equipe.postes) {
          for (const aff of poste.affectations) {
            const reprDate = new Date(aff.representation.date)
            if (reprDate < now || reprDate > J14) continue

            if (!reprsMap.has(aff.representation.id)) {
              reprsMap.set(aff.representation.id, {
                representationId: aff.representation.id,
                date: aff.representation.date.toISOString(),
                showStartTime: aff.representation.showStartTime,
                venueName: aff.representation.venueName,
                postes: [],
              })
            }
          }

          // Calcul postes non pourvus (representations distinctes à venir)
          const affReprIds = new Set(
            poste.affectations
              .filter((a) => new Date(a.representation.date) >= now)
              .map((a) => a.representation.id)
          )

          // Pour chaque poste, vérifier si requis > pourvus sur les prochaines dates
          for (const aff of poste.affectations) {
            const reprDate = new Date(aff.representation.date)
            if (reprDate < now) continue

            // Alertes confirmations en attente
            if (aff.confirmationStatus === 'EN_ATTENTE') {
              const urgence = reprDate <= new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
                ? 'CRITIQUE'
                : reprDate <= J7 ? 'URGENT' : 'PLANIFIER'
              alertes.push({
                type: 'EN_ATTENTE',
                urgence,
                representationDate: aff.representation.date.toISOString(),
                showStartTime: aff.representation.showStartTime,
                venueName: aff.representation.venueName,
                posteNom: poste.name,
                representationId: aff.representation.id,
                collaborateurNom: `${aff.collaborateur.user.firstName} ${aff.collaborateur.user.lastName}`,
                affectationId: aff.id,
              })
            }
          }
        }

        return {
          equipeId: equipe.id,
          equipeNom: equipe.name,
          equipeIcon: equipe.icon,
          projet: equipe.projet,
          membres: equipe.membres.map((m) => ({
            userId: m.userId,
            firstName: m.user.firstName,
            lastName: m.user.lastName,
            role: m.role,
          })),
          alertes: alertes.sort((a, b) => {
            const order = { CRITIQUE: 0, URGENT: 1, PLANIFIER: 2 }
            return order[a.urgence] - order[b.urgence]
          }),
          planning14j: Array.from(reprsMap.values()).sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          ),
        }
      })

    return NextResponse.json({ equipes, projets })
  } catch (err) {
    console.error('[GET /api/mon-equipe]', err)
    return internalError()
  }
}
