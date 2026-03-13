// ─────────────────────────────────────────────────────────
// GET /api/rh — Dashboard RH : liste des DPAE par statut
// doc/06 Règles #3, #9 — DPAE obligatoire CDD/INTERMITTENT
// Auth : minRole RH (DIRECTEUR ou RH)
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError, validationError } from '@/lib/api-response'
import type { DpaeStatus } from '@prisma/client'

// Item DPAE normalisé renvoyé au client
export type DpaeItem = {
  id: string
  collaborateurId: string
  collaborateurNom: string
  email: string
  contractType: string
  dpaeStatus: DpaeStatus
  representationDate: string         // ISO string
  representationTitre: string        // type de représentation
  venueName: string | null
  projetId: string
  projetTitre: string
  posteLabel: string
  cachetHT: number | null            // en centimes (remuneration)
}

type DpaeGrouped = {
  aFaire: DpaeItem[]
  envoyee: DpaeItem[]
  confirmee: DpaeItem[]
}

export async function GET(req: Request) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'RH' })
    if (error) return error

    const organizationId = session.user.organizationId!

    // Lire les paramètres de filtre optionnels
    const { searchParams } = new URL(req.url)
    const statusParam = searchParams.get('status') as DpaeStatus | null
    const projetIdParam = searchParams.get('projetId')

    // Valider le statut si fourni
    const VALID_STATUSES: DpaeStatus[] = ['A_FAIRE', 'ENVOYEE', 'CONFIRMEE']
    if (statusParam && !VALID_STATUSES.includes(statusParam)) {
      return validationError({ status: `Valeur invalide. Valeurs acceptées : ${VALID_STATUSES.join(', ')}` })
    }

    // Construire le filtre Prisma
    const where: Record<string, unknown> = {
      contractTypeUsed: { in: ['CDD', 'INTERMITTENT'] },
      dpaeStatus: statusParam
        ? statusParam
        : { in: VALID_STATUSES },   // exclure NON_REQUISE automatiquement
      representation: {
        projet: {
          organizationId,
        },
        ...(projetIdParam ? { projetId: projetIdParam } : {}),
      },
    }

    const affectations = await prisma.affectation.findMany({
      where,
      include: {
        collaborateur: {
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
        },
        representation: {
          select: {
            date: true,
            type: true,
            venueName: true,
            projetId: true,
            projet: {
              select: { id: true, title: true },
            },
          },
        },
        posteRequis: {
          select: { name: true },
        },
      },
      orderBy: [
        { representation: { date: 'asc' } },
        { createdAt: 'asc' },
      ],
    })

    // Mapper vers le format DpaeItem
    const items: DpaeItem[] = affectations.map((a) => ({
      id: a.id,
      collaborateurId: a.collaborateurId,
      collaborateurNom: `${a.collaborateur.user.firstName} ${a.collaborateur.user.lastName}`,
      email: a.collaborateur.user.email,
      contractType: a.contractTypeUsed,
      dpaeStatus: a.dpaeStatus,
      representationDate: a.representation.date.toISOString(),
      representationTitre: a.representation.type,
      venueName: a.representation.venueName,
      projetId: a.representation.projet.id,
      projetTitre: a.representation.projet.title,
      posteLabel: a.posteRequis.name,
      cachetHT: a.remuneration,
    }))

    // Grouper par statut
    const grouped: DpaeGrouped = {
      aFaire:   items.filter((i) => i.dpaeStatus === 'A_FAIRE'),
      envoyee:  items.filter((i) => i.dpaeStatus === 'ENVOYEE'),
      confirmee: items.filter((i) => i.dpaeStatus === 'CONFIRMEE'),
    }

    return NextResponse.json(grouped)
  } catch (err) {
    console.error('[GET /api/rh]', err)
    return internalError()
  }
}
