// ─────────────────────────────────────────────────────────
// POST /api/onboarding/premier-projet — Étape 2 du wizard
// Création du premier projet (spectacle)
// doc/14-onboarding.md §14.2 Étape 2
// doc/06-regles-decisions.md Règle #34 (colorCode palette fixe)
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrgSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validationError, internalError } from '@/lib/api-response'

// Palette fixe de 12 couleurs — Règle #34
const PALETTE_COULEURS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444',
  '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#06B6D4', '#3B82F6', '#A855F7', '#F43F5E',
]

const Schema = z.object({
  titre: z.string().min(1).max(100),
  type: z.enum([
    'THEATRE', 'COMEDIE_MUSICALE', 'CONCERT', 'OPERA',
    'DANSE', 'CIRQUE', 'MAINTENANCE', 'EVENEMENT', 'AUTRE',
  ]),
  dateDebut: z.string().nullable().optional(),
  dateFin: z.string().nullable().optional(),
})

export async function POST(req: Request) {
  try {
    const { session, error } = await requireOrgSession({ write: true })
    if (error) return error

    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { titre, type, dateDebut, dateFin } = parsed.data

    // Couleur aléatoire depuis la palette
    const colorCode = PALETTE_COULEURS[Math.floor(Math.random() * PALETTE_COULEURS.length)]

    const projet = await prisma.projet.create({
      data: {
        title: titre,           // schema : Projet.title (pas titre)
        type,
        status: 'EN_PREPARATION',
        colorCode,
        organizationId: session.user.organizationId!,
        startDate: dateDebut ? new Date(dateDebut) : null,  // schema : startDate
        endDate: dateFin ? new Date(dateFin) : null,         // schema : endDate
        // Régisseur principal = le Directeur créateur
        regisseurId: session.user.id,
      },
      select: { id: true, title: true },
    })

    return NextResponse.json({ success: true, projet })
  } catch (err) {
    console.error('[POST /api/onboarding/premier-projet]', err)
    return internalError()
  }
}
