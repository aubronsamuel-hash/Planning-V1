// ─────────────────────────────────────────────────────────
// GET  /api/affectations/confirmer?token=xxx — Lecture de l'affectation
// POST /api/affectations/confirmer?token=xxx — Confirmation / Refus
// Route publique (pas d'auth session) — utilise le magic link CONFIRMATION
// doc/06-regles-decisions.md Règles #14, #15
// Confirmation atomique : chaque action = effet immédiat
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { validationError, internalError } from '@/lib/api-response'
import logger from '@/lib/logger'

function getToken(req: Request): string | null {
  const { searchParams } = new URL(req.url)
  return searchParams.get('token')
}

async function resolveAffectationFromToken(token: string) {
  const magicToken = await prisma.magicLinkToken.findUnique({
    where: { token },
    select: {
      usedAt: true,
      expiresAt: true,
      purpose: true,
      metadata: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          collaborateur: {
            select: { id: true },
          },
        },
      },
    },
  })

  if (!magicToken) return { error: 'Lien invalide.', status: 404 }
  if (magicToken.purpose !== 'CONFIRMATION') return { error: 'Lien invalide pour cette action.', status: 400 }
  if (magicToken.expiresAt < new Date()) return { error: 'Ce lien a expiré. Contactez votre régisseur.', status: 410 }

  const metadata = magicToken.metadata as { affectationId?: string } | null
  if (!metadata?.affectationId) return { error: 'Lien invalide (métadonnées manquantes).', status: 400 }

  const affectation = await prisma.affectation.findFirst({
    where: { id: metadata.affectationId },
    include: {
      representation: {
        select: {
          date: true,
          venueName: true,
          venueCity: true,
          showStartTime: true,
          showEndTime: true,
          projet: {
            select: { title: true, colorCode: true },  // schema : title
          },
        },
      },
      posteRequis: {
        select: { name: true },   // schema : PosteRequis.name (pas intitule)
      },
    },
  })

  if (!affectation) return { error: 'Affectation introuvable.', status: 404 }

  return { magicToken, affectation }
}

// ── GET — Lire l'affectation ──────────────────────────────

export async function GET(req: Request) {
  try {
    const token = getToken(req)
    if (!token) {
      return NextResponse.json({ error: 'Token manquant.' }, { status: 400 })
    }

    const result = await resolveAffectationFromToken(token)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { magicToken, affectation } = result
    const rep = affectation.representation

    return NextResponse.json({
      collaborateurPrenom: magicToken.user.firstName || 'Collaborateur',
      projetTitre: rep.projet.title,    // schema : Projet.title (pas titre)
      representationDate: rep.date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      representationLieu: [rep.venueName, rep.venueCity].filter(Boolean).join(' · '),
      poste: affectation.posteRequis?.name ?? 'Poste non défini',  // schema : name
      heureDebut: affectation.startTime ?? rep.showStartTime ?? '—',
      heureFin: affectation.endTime ?? rep.showEndTime ?? '—',
      cachet: affectation.remuneration,   // schema : remuneration (pas cachetCents)
      confirmationStatus: affectation.confirmationStatus,
    })
  } catch (err) {
    void logger.error('GET /api/affectations/confirmer', err, { route: 'GET /api/affectations/confirmer' })
    return internalError()
  }
}

// ── POST — Confirmer ou Refuser ───────────────────────────

const ActionSchema = z.object({
  action: z.enum(['CONFIRMEE', 'REFUSEE']),
})

export async function POST(req: Request) {
  try {
    const token = getToken(req)
    if (!token) {
      return NextResponse.json({ error: 'Token manquant.' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = ActionSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const result = await resolveAffectationFromToken(token)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { magicToken, affectation } = result

    // Le token CONFIRMATION est multi-usage (Règle #15 — confirmation atomique)
    // On ne l'invalide PAS — l'intermittent peut changer d'avis
    // ⚠️ Seul le token LOGIN est à usage unique

    // Mettre à jour le statut de confirmation — effet immédiat (Règle #15)
    await prisma.affectation.update({
      where: { id: affectation.id },
      data: {
        confirmationStatus: parsed.data.action,
        confirmedAt: parsed.data.action === 'CONFIRMEE' ? new Date() : null,
      },
    })

    // TODO Phase 2 : émettre un événement SSE via eventBus pour la grille régisseur
    // eventBus.emit(`planning:${affectation.representation.projetId}`, { type: 'affectation_updated', ... })

    return NextResponse.json({ success: true, status: parsed.data.action })
  } catch (err) {
    void logger.error('POST /api/affectations/confirmer', err, { route: 'POST /api/affectations/confirmer' })
    return internalError()
  }
}
