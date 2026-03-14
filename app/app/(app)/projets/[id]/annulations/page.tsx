// ─────────────────────────────────────────────────────────
// /projets/[id]/annulations
// Page RH — Suivi des annulations et décisions cachets
// Accès : RH et Directeur uniquement
// doc §12.6 — Annulations & Reports
// ─────────────────────────────────────────────────────────
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { AnnulationsClient } from './AnnulationsClient'

type Params = { params: { id: string } }

export default async function AnnulationsPage({ params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user.organizationId) redirect('/login')

  const orgRole = session.user.organizationRole
  if (orgRole !== 'RH' && orgRole !== 'DIRECTEUR') {
    redirect(`/projets/${params.id}`)
  }

  const projet = await prisma.projet.findFirst({
    where: { id: params.id, organizationId: session.user.organizationId, deletedAt: null },
    select: { id: true, title: true, status: true, type: true, color: true },
  })

  if (!projet) notFound()

  const affectations = await prisma.affectation.findMany({
    where: {
      representation: { projetId: params.id },
      confirmationStatus: { in: ['ANNULEE', 'ANNULEE_TARDIVE'] },
    },
    include: {
      collaborateur: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
      posteRequis: { select: { name: true } },
      representation: {
        select: {
          id: true,
          date: true,
          venueName: true,
          venueCity: true,
          status: true,
          annulationReason: true,
          annulationAt: true,
        },
      },
      dpae: {
        select: { status: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ representation: { date: 'asc' } }],
  })

  // Grouper par représentation
  const parRepresentationMap = new Map<string, {
    representationId: string
    date: Date
    venueName: string | null
    venueCity: string | null
    annulationReason: string | null
    annulationAt: Date | null
    affectations: typeof affectations
  }>()

  for (const aff of affectations) {
    const repId = aff.representationId
    if (!parRepresentationMap.has(repId)) {
      parRepresentationMap.set(repId, {
        representationId: repId,
        date: aff.representation.date,
        venueName: aff.representation.venueName,
        venueCity: aff.representation.venueCity,
        annulationReason: aff.representation.annulationReason,
        annulationAt: aff.representation.annulationAt,
        affectations: [],
      })
    }
    parRepresentationMap.get(repId)!.affectations.push(aff)
  }

  const groupes = Array.from(parRepresentationMap.values()).map((rep) => ({
    representationId: rep.representationId,
    date: rep.date.toISOString(),
    venueName: rep.venueName,
    venueCity: rep.venueCity,
    annulationReason: rep.annulationReason,
    annulationAt: rep.annulationAt?.toISOString() ?? null,
    affectations: rep.affectations.map((aff) => ({
      id: aff.id,
      collaborateurNom: `${aff.collaborateur.user.lastName} ${aff.collaborateur.user.firstName}`,
      contractType: aff.collaborateur.contractType,
      poste: aff.posteRequis.name,
      cachet: aff.cachet,
      confirmationStatus: aff.confirmationStatus,
      cachetAnnulation: aff.cachetAnnulation,
      annulationRaison: aff.annulationRaison,
      dpaeStatus: aff.dpae[0]?.status ?? null,
    })),
  }))

  const totalCachetsADecider = affectations
    .filter((a) => a.cachetAnnulation === 'A_DECIDER' && a.cachet)
    .reduce((sum, a) => sum + (a.cachet ?? 0), 0)

  return (
    <AnnulationsClient
      projet={projet}
      groupes={groupes}
      totalCachetsADecider={totalCachetsADecider}
    />
  )
}
