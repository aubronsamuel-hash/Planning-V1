// ─────────────────────────────────────────────────────────
// Détection de conflits horaires — doc/06 Règles #2, #20, #22
// Cross-projets, cross-équipes, calcul cross-minuit
// ─────────────────────────────────────────────────────────

/**
 * Convertit une date + heure "HH:MM" en timestamp (minutes depuis epoch jour).
 * Si endTime < startTime → cross-minuit : on ajoute 24h à endTime.
 */
function toMinutes(date: Date, time: string): number {
  const [h, m] = time.split(':').map(Number)
  const dayStart = Math.floor(date.getTime() / (60 * 1000)) - (date.getHours() * 60 + date.getMinutes())
  return dayStart + h * 60 + m
}

function intervalsOverlap(
  startA: number, endA: number,
  startB: number, endB: number
): boolean {
  return startA < endB && endA > startB
}

interface AffectationConflictCheck {
  representationDate: Date
  startTime: string  // "HH:MM"
  endTime: string    // "HH:MM"
}

/**
 * Vérifie si deux affectations se chevauchent (Règle #22 cross-minuit).
 */
export function affectationsOverlap(a: AffectationConflictCheck, b: AffectationConflictCheck): boolean {
  let startA = toMinutes(a.representationDate, a.startTime)
  let endA   = toMinutes(a.representationDate, a.endTime)
  let startB = toMinutes(b.representationDate, b.startTime)
  let endB   = toMinutes(b.representationDate, b.endTime)

  // Cross-minuit : si end < start → ajouter 24h à end
  if (endA <= startA) endA += 24 * 60
  if (endB <= startB) endB += 24 * 60

  // Si les représentations sont des jours différents, ne peuvent se chevaucher
  // que si l'une est cross-minuit et déborde sur le lendemain
  const dateA = new Date(a.representationDate)
  const dateB = new Date(b.representationDate)
  dateA.setHours(0, 0, 0, 0)
  dateB.setHours(0, 0, 0, 0)

  const dayDiffMinutes = (dateB.getTime() - dateA.getTime()) / (60 * 1000)

  // Décaler l'affectation B en fonction de la différence de jours
  startB += dayDiffMinutes
  endB   += dayDiffMinutes

  return intervalsOverlap(startA, endA, startB, endB)
}

import { prisma } from '@/lib/prisma'

interface ConflictResult {
  hasConflict: boolean
  conflictDetails?: {
    projetTitle: string
    representationDate: Date
    startTime: string
    endTime: string
  }
}

/**
 * Vérifie si un collaborateur a un conflit horaire pour une affectation donnée.
 * Règle #20 : cross-projets et cross-équipes.
 *
 * @param collaborateurId ID du collaborateur
 * @param representationDate Date de la représentation cible
 * @param startTime Heure de début "HH:MM"
 * @param endTime Heure de fin "HH:MM"
 * @param excludeAffectationId ID à exclure (pour les PATCH)
 */
export async function detectConflict(
  collaborateurId: string,
  representationDate: Date,
  startTime: string,
  endTime: string,
  excludeAffectationId?: string
): Promise<ConflictResult> {
  // Chercher toutes les affectations actives du collaborateur
  // sur des représentations le même jour (±1 jour pour couvrir le cross-minuit)
  const targetDate = new Date(representationDate)
  targetDate.setHours(0, 0, 0, 0)

  const dayBefore = new Date(targetDate)
  dayBefore.setDate(dayBefore.getDate() - 1)
  const dayAfter = new Date(targetDate)
  dayAfter.setDate(dayAfter.getDate() + 1)

  const existingAffectations = await prisma.affectation.findMany({
    where: {
      collaborateurId,
      id: excludeAffectationId ? { not: excludeAffectationId } : undefined,
      confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE', 'REFUSEE'] },
      representation: {
        date: { gte: dayBefore, lte: dayAfter },
        status: { notIn: ['ANNULEE', 'REPORTEE'] },
      },
    },
    include: {
      representation: {
        include: { projet: { select: { title: true } } },
      },
    },
  })

  const newAffectation: AffectationConflictCheck = {
    representationDate,
    startTime,
    endTime,
  }

  for (const aff of existingAffectations) {
    const existing: AffectationConflictCheck = {
      representationDate: aff.representation.date,
      startTime: aff.startTime,
      endTime: aff.endTime,
    }

    if (affectationsOverlap(newAffectation, existing)) {
      return {
        hasConflict: true,
        conflictDetails: {
          projetTitle: aff.representation.projet.title,
          representationDate: aff.representation.date,
          startTime: aff.startTime,
          endTime: aff.endTime,
        },
      }
    }
  }

  return { hasConflict: false }
}
