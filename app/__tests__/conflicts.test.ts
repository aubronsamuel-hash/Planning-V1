// ─────────────────────────────────────────────────────────
// Tests unitaires — lib/conflicts.ts
// Règles #2, #20, #22 : détection de conflits horaires
// ─────────────────────────────────────────────────────────
import { describe, it, expect, vi } from 'vitest'

// Mock prisma — detectConflict fait des requêtes DB
vi.mock('@/lib/prisma', () => ({
  prisma: {
    affectation: {
      findMany: vi.fn(),
    },
  },
}))

import { affectationsOverlap, detectConflict } from '@/lib/conflicts'
import { prisma } from '@/lib/prisma'

const DATE_A = new Date('2026-03-15T00:00:00.000Z')
const DATE_B = new Date('2026-03-16T00:00:00.000Z')

describe('affectationsOverlap — même jour', () => {
  it('chevauche si les créneaux se superposent', () => {
    const a = { representationDate: DATE_A, startTime: '09:00', endTime: '12:00' }
    const b = { representationDate: DATE_A, startTime: '11:00', endTime: '14:00' }
    expect(affectationsOverlap(a, b)).toBe(true)
    expect(affectationsOverlap(b, a)).toBe(true)
  })

  it('ne chevauche pas si consécutifs (fin A = début B)', () => {
    const a = { representationDate: DATE_A, startTime: '09:00', endTime: '12:00' }
    const b = { representationDate: DATE_A, startTime: '12:00', endTime: '15:00' }
    expect(affectationsOverlap(a, b)).toBe(false)
  })

  it('ne chevauche pas si créneaux distincts', () => {
    const a = { representationDate: DATE_A, startTime: '09:00', endTime: '12:00' }
    const b = { representationDate: DATE_A, startTime: '13:00', endTime: '17:00' }
    expect(affectationsOverlap(a, b)).toBe(false)
  })

  it('chevauche si un créneau est inclus dans l\'autre', () => {
    const outer = { representationDate: DATE_A, startTime: '08:00', endTime: '20:00' }
    const inner = { representationDate: DATE_A, startTime: '10:00', endTime: '12:00' }
    expect(affectationsOverlap(outer, inner)).toBe(true)
  })

  it('créneaux identiques = conflit', () => {
    const a = { representationDate: DATE_A, startTime: '14:00', endTime: '18:00' }
    const b = { representationDate: DATE_A, startTime: '14:00', endTime: '18:00' }
    expect(affectationsOverlap(a, b)).toBe(true)
  })
})

describe('affectationsOverlap — cross-minuit (Règle #22)', () => {
  it('créneau cross-minuit (22:00 → 02:00) sur le même jour se détecte correctement', () => {
    // Deux affectations sur le même jour — A finit après minuit, B commence avant 02:00
    const lateNight = { representationDate: DATE_A, startTime: '22:00', endTime: '02:00' }
    const sameDay   = { representationDate: DATE_A, startTime: '23:00', endTime: '01:00' }
    expect(affectationsOverlap(lateNight, sameDay)).toBe(true)
  })

  it('créneau cross-minuit ne chevauche pas un créneau standard du lendemain', () => {
    const lateNight = { representationDate: DATE_A, startTime: '22:00', endTime: '02:00' }
    const afternoon = { representationDate: DATE_B, startTime: '14:00', endTime: '18:00' }
    expect(affectationsOverlap(lateNight, afternoon)).toBe(false)
  })
})

describe('affectationsOverlap — jours différents', () => {
  it('créneaux identiques sur jours différents = pas de conflit', () => {
    const a = { representationDate: DATE_A, startTime: '10:00', endTime: '18:00' }
    const b = { representationDate: DATE_B, startTime: '10:00', endTime: '18:00' }
    expect(affectationsOverlap(a, b)).toBe(false)
  })
})

describe('detectConflict', () => {
  const collab = 'collab-id-123'

  it('retourne hasConflict=false si aucune affectation existante', async () => {
    vi.mocked(prisma.affectation.findMany).mockResolvedValueOnce([])
    const result = await detectConflict(collab, DATE_A, '10:00', '12:00')
    expect(result.hasConflict).toBe(false)
    expect(result.conflictDetails).toBeUndefined()
  })

  it('retourne hasConflict=true si conflit détecté', async () => {
    vi.mocked(prisma.affectation.findMany).mockResolvedValueOnce([
      {
        id: 'aff-1',
        collaborateurId: collab,
        startTime: '11:00',
        endTime: '14:00',
        representation: {
          date: DATE_A,
          projet: { title: 'Peter Pan' },
        },
      } as any,
    ])

    const result = await detectConflict(collab, DATE_A, '09:00', '12:00')
    expect(result.hasConflict).toBe(true)
    expect(result.conflictDetails?.projetTitle).toBe('Peter Pan')
  })

  it('retourne hasConflict=false si affectations sur un autre jour sans cross-minuit', async () => {
    const OTHER_DAY = new Date('2026-03-20T00:00:00.000Z')
    vi.mocked(prisma.affectation.findMany).mockResolvedValueOnce([
      {
        id: 'aff-2',
        collaborateurId: collab,
        startTime: '10:00',
        endTime: '18:00',
        representation: {
          date: OTHER_DAY,
          projet: { title: 'Garou Tournée' },
        },
      } as any,
    ])

    const result = await detectConflict(collab, DATE_A, '10:00', '18:00')
    expect(result.hasConflict).toBe(false)
  })

  it('exclut l\'affectation avec excludeAffectationId (mode PATCH)', async () => {
    vi.mocked(prisma.affectation.findMany).mockResolvedValueOnce([])
    await detectConflict(collab, DATE_A, '10:00', '12:00', 'exclude-id')

    const calls = vi.mocked(prisma.affectation.findMany).mock.calls
    const lastCall = calls[calls.length - 1][0]
    expect(lastCall?.where?.id).toEqual({ not: 'exclude-id' })
  })
})
