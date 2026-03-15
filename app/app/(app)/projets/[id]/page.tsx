// ─────────────────────────────────────────────────────────
// Détail d'un projet — /projets/[id]
// doc/04-pages-interfaces-ux.md §6.3
// Onglets : Résumé | Représentations | Équipe & Postes | Planning
// ─────────────────────────────────────────────────────────
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { ProjetDetailClient } from './ProjetDetailClient'

type Params = { params: { id: string } }

export default async function ProjetDetailPage({ params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user.organizationId) redirect('/login')

  const orgId = session.user.organizationId
  const orgRole = session.user.organizationRole
  const canEdit = orgRole === 'DIRECTEUR' || orgRole === 'REGISSEUR'
  const canSeeRH = orgRole === 'DIRECTEUR' || orgRole === 'RH'

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } })

  const projet = await prisma.projet.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: {
      regisseur: { select: { firstName: true, lastName: true } },
      equipes: {
        include: {
          membres: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            },
          },
          postesRequis: {
            include: {
              _count: { select: { affectations: true } },
            },
          },
        },
        orderBy: { id: 'asc' },
      },
      representations: {
        where: { status: { notIn: ['ANNULEE', 'REPORTEE'] } },
        include: {
          affectations: {
            where: { confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE', 'REFUSEE'] } },
            include: {
              posteRequis: { select: { isCritique: true, requiredCount: true } },
            },
          },
          _count: { select: { affectations: true } },
        },
        orderBy: { date: 'asc' },
      },
      _count: { select: { representations: true } },
    },
  })

  if (!projet) notFound()

  // Membres de l'org pour les selects (assigner chef, collaborateurs)
  const membresOrg = await prisma.organizationMembership.findMany({
    where: { organizationId: orgId, joinedAt: { not: null } },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { user: { firstName: 'asc' } },
  })

  // Collaborateurs avec leur record Collaborateur (pour affectations)
  const collaborateurs = await prisma.collaborateur.findMany({
    where: {
      user: {
        memberships: { some: { organizationId: orgId, joinedAt: { not: null } } },
      },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { user: { firstName: 'asc' } },
  })

  // Calculer le statut visuel de chaque représentation (Règle #33)
  const representations = projet.representations.map((rep) => {
    const postesMap = new Map<string, { isCritique: boolean; requiredCount: number; count: number }>()
    for (const aff of rep.affectations) {
      const key = aff.posteRequisId
      const existing = postesMap.get(key)
      if (existing) {
        existing.count++
      } else {
        postesMap.set(key, {
          isCritique: aff.posteRequis.isCritique,
          requiredCount: aff.posteRequis.requiredCount,
          count: 1,
        })
      }
    }
    let hasPosteCritiqueManquant = false
    let hasPosteManquant = false
    for (const [, p] of postesMap) {
      if (p.count < p.requiredCount) {
        hasPosteManquant = true
        if (p.isCritique) hasPosteCritiqueManquant = true
      }
    }
    return {
      id: rep.id,
      projetId: rep.projetId,
      date: rep.date.toISOString(),
      type: rep.type,
      status: rep.status,
      getInTime: rep.getInTime,
      warmupTime: rep.warmupTime,
      showStartTime: rep.showStartTime,
      showEndTime: rep.showEndTime,
      getOutTime: rep.getOutTime,
      venueName: rep.venueName,
      venueCity: rep.venueCity,
      venueAddress: rep.venueAddress,
      notes: rep.notes,
      affectationsCount: rep._count.affectations,
      statutVisuel: (hasPosteCritiqueManquant ? 'ROUGE' : hasPosteManquant ? 'JAUNE' : 'VERT') as 'VERT' | 'JAUNE' | 'ROUGE',
    }
  })

  // Compter les collaborateurs distincts
  const collaborateursDistincts = new Set(
    projet.equipes.flatMap((e) => e.membres.map((m) => m.userId))
  ).size

  const projetJson = {
    id: projet.id,
    title: projet.title,
    subtitle: projet.subtitle,
    type: projet.type,
    status: projet.status,
    colorCode: projet.colorCode,
    startDate: projet.startDate?.toISOString() ?? null,
    endDate: projet.endDate?.toISOString() ?? null,
    posterUrl: projet.posterUrl,
    regisseurId: projet.regisseurId,
    regisseurNom: projet.regisseur
      ? `${projet.regisseur.firstName} ${projet.regisseur.lastName}`
      : null,
    organizationId: projet.organizationId,
    representationsCount: projet._count.representations,
    collaborateursCount: collaborateursDistincts,
    createdAt: projet.createdAt.toISOString(),
  }

  const equipesJson = projet.equipes.map((e) => ({
    id: e.id,
    name: e.name,
    icon: e.icon,
    color: e.color,
    projetId: e.projetId,
    chef: e.membres.find((m) => m.role === 'CHEF')?.user ?? null,
    membres: e.membres.map((m) => ({
      userId: m.userId,
      role: m.role,
      user: m.user,
    })),
    postesRequis: e.postesRequis.map((p) => ({
      id: p.id,
      name: p.name,
      requiredCount: p.requiredCount,
      isCritique: p.isCritique,
      contractTypePreference: p.contractTypePreference,
      defaultStartTime: p.defaultStartTime,
      defaultEndTime: p.defaultEndTime,
      equipeId: p.equipeId,
      projetId: p.projetId,
      affectationsCount: p._count.affectations,
    })),
  }))

  return (
    <ProjetDetailClient
      projet={projetJson}
      representations={representations}
      equipes={equipesJson}
      membresOrg={membresOrg.map((m) => ({
        userId: m.userId,
        role: m.role,
        nom: `${m.user.firstName} ${m.user.lastName}`,
      }))}
      collaborateurs={collaborateurs.map((c) => ({
        id: c.id,
        userId: c.userId,
        accountStatus: c.accountStatus,
        contractType: c.contractType,
        nom: `${c.user.firstName} ${c.user.lastName}`,
      }))}
      canEdit={canEdit}
      canSeeRH={canSeeRH}
      organisationPlan={org?.plan ?? 'FREE'}
    />
  )
}
