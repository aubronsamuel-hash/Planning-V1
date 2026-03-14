// ─────────────────────────────────────────────────────────
// GET  /api/projets/[id]/representations — Liste des représentations
// POST /api/projets/[id]/representations — Ajouter (unitaire ou série)
// doc/03-workflows.md §5.3
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { validationError, internalError, notFound } from '@/lib/api-response'
import logger from '@/lib/logger'

// Schéma représentation unitaire
const RepresentationUnitaireSchema = z.object({
  mode: z.literal('unique'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date: YYYY-MM-DD'),
  type: z.enum(['REPRESENTATION', 'REPETITION', 'FILAGE', 'GENERALE', 'AVANT_PREMIERE', 'INTERVENTION', 'EVENEMENT']),
  getInTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  warmupTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  showStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  showEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  getOutTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  venueName: z.string().max(100).optional(),
  venueCity: z.string().max(100).optional(),
  venueAddress: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
})

// Schéma série de représentations
const RepresentationSerieSchema = z.object({
  mode: z.literal('serie'),
  dateDebut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date: YYYY-MM-DD'),
  dateFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date: YYYY-MM-DD'),
  joursActifs: z.array(z.number().min(0).max(6)).min(1), // 0=Dim, 1=Lun, ..., 6=Sam
  type: z.enum(['REPRESENTATION', 'REPETITION', 'FILAGE', 'GENERALE', 'AVANT_PREMIERE', 'INTERVENTION', 'EVENEMENT']),
  showStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  showEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  getInTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  warmupTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  getOutTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  venueName: z.string().max(100).optional(),
  venueCity: z.string().max(100).optional(),
  venueAddress: z.string().max(200).optional(),
  exclusions: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(), // dates exclues
})

const CreateRepresentationSchema = z.discriminatedUnion('mode', [
  RepresentationUnitaireSchema,
  RepresentationSerieSchema,
])

// ── GET ────────────────────────────────────────────────────
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession()
    if (error) return error

    const projet = await prisma.projet.findFirst({ where: { id: params.id } })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') // format "2026-03"

    let dateFilter = {}
    if (month) {
      const [y, m] = month.split('-').map(Number)
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m, 0)
      dateFilter = { date: { gte: start, lte: end } }
    }

    const representations = await prisma.representation.findMany({
      where: { projetId: params.id, ...dateFilter },
      include: {
        _count: { select: { affectations: true } },
        affectations: {
          include: {
            posteRequis: { select: { isCritique: true, requiredCount: true } },
          },
        },
      },
      orderBy: { date: 'asc' },
    })

    // Enrichir avec le statut visuel (🟢🟡🔴) — Règle #33
    const reprsEnrichies = representations.map((rep) => {
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

      for (const [, poste] of postesMap) {
        if (poste.count < poste.requiredCount) {
          hasPosteManquant = true
          if (poste.isCritique) hasPosteCritiqueManquant = true
        }
      }

      const statutVisuel = hasPosteCritiqueManquant ? 'ROUGE'
        : hasPosteManquant ? 'JAUNE'
        : 'VERT'

      return {
        id: rep.id,
        projetId: rep.projetId,
        date: rep.date,
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
        annulationReason: rep.annulationReason,
        annulationAt: rep.annulationAt,
        affectationsCount: rep._count.affectations,
        statutVisuel,
        hasPosteCritiqueManquant,
      }
    })

    return NextResponse.json(reprsEnrichies)
  } catch (err) {
    void logger.error('GET /api/projets/[id]/representations', err, { route: 'GET /api/projets/[id]/representations' })
    return internalError()
  }
}

// ── POST ───────────────────────────────────────────────────
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const projet = await prisma.projet.findFirst({ where: { id: params.id } })
    if (!projet) return notFound('Projet')

    const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    const body = await req.json()
    const parsed = CreateRepresentationSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    if (parsed.data.mode === 'unique') {
      // Création unitaire
      const data = parsed.data
      const rep = await prisma.representation.create({
        data: {
          projetId: params.id,
          date: new Date(data.date),
          type: data.type,
          status: 'PLANIFIEE',
          getInTime: data.getInTime,
          warmupTime: data.warmupTime,
          showStartTime: data.showStartTime,
          showEndTime: data.showEndTime,
          getOutTime: data.getOutTime,
          venueName: data.venueName,
          venueCity: data.venueCity,
          venueAddress: data.venueAddress,
          notes: data.notes,
        },
      })
      return NextResponse.json(rep, { status: 201 })
    }

    // Création en série
    const data = parsed.data
    const dateDebut = new Date(data.dateDebut)
    const dateFin = new Date(data.dateFin)
    const exclusionsSet = new Set(data.exclusions ?? [])

    if (dateDebut > dateFin) {
      return validationError({ dateDebut: ['La date de début doit être avant la date de fin'] })
    }

    const dates: Date[] = []
    const current = new Date(dateDebut)

    while (current <= dateFin) {
      const dayOfWeek = current.getDay() // 0=Dim, 1=Lun, ..., 6=Sam
      const dateStr = current.toISOString().split('T')[0]

      if (data.joursActifs.includes(dayOfWeek) && !exclusionsSet.has(dateStr)) {
        dates.push(new Date(current))
      }
      current.setDate(current.getDate() + 1)
    }

    if (dates.length === 0) {
      return validationError({ joursActifs: ['Aucune date générée avec ces paramètres'] })
    }

    if (dates.length > 365) {
      return validationError({ dateFin: ['Trop de représentations (max 365 par série)'] })
    }

    // Créer toutes les représentations en batch
    await prisma.representation.createMany({
      data: dates.map((date) => ({
        projetId: params.id,
        date,
        type: data.type,
        status: 'PLANIFIEE' as const,
        getInTime: data.getInTime,
        warmupTime: data.warmupTime,
        showStartTime: data.showStartTime,
        showEndTime: data.showEndTime,
        getOutTime: data.getOutTime,
        venueName: data.venueName,
        venueCity: data.venueCity,
        venueAddress: data.venueAddress,
      })),
    })

    return NextResponse.json({ created: dates.length }, { status: 201 })
  } catch (err) {
    void logger.error('POST /api/projets/[id]/representations', err, { route: 'POST /api/projets/[id]/representations' })
    return internalError()
  }
}
