// ─────────────────────────────────────────────────────────
// Tests unitaires — lib/scoring-remplacements.ts
// Algorithme de scoring des candidats remplaçants
// doc/10-remplacements-urgents.md §10.2
// ─────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { scorerCandidat, bonusContrat, type AffectationHistorique, type ContexteRemplacement } from '@/lib/scoring-remplacements'

// ─── Fixtures ────────────────────────────────────────────

const DATE_REP = new Date('2026-04-10T00:00:00.000Z')
const DATE_AUTRE = new Date('2026-04-20T00:00:00.000Z')

const CONTEXTE: ContexteRemplacement = {
  projetId: 'projet-abc',
  projetType: 'THEATRE',
  projetTitle: 'Peter Pan',
  posteNom: 'Régisseur son',
  repDate: DATE_REP,
  startTime: '19:00',
  endTime: '22:00',
  contractTypePreference: 'INTERMITTENT',
}

function makeAffectation(overrides: Partial<AffectationHistorique> = {}): AffectationHistorique {
  return {
    confirmationStatus: 'CONFIRMEE',
    confirmedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    representation: {
      date: DATE_AUTRE,
      projet: { id: 'autre-projet', type: 'THEATRE' },
    },
    posteRequis: { name: 'Technicien lumière' },
    startTime: '14:00',
    endTime: '18:00',
    ...overrides,
  }
}

// ─── Tests scorerCandidat ─────────────────────────────────

describe('scorerCandidat — candidat sans historique', () => {
  it('retourne score 0 pour un candidat sans aucune affectation', () => {
    const result = scorerCandidat([], CONTEXTE)
    expect(result.score).toBe(0)
    expect(result.raisons).toHaveLength(0)
    expect(result.aConflit).toBe(false)
    expect(result.disponible).toBe(true)
    expect(result.tempsReponse).toBeNull()
  })
})

describe('scorerCandidat — bonus +4 : même projet', () => {
  it('ajoute +4 si le candidat a déjà travaillé sur CE projet', () => {
    const affectations = [
      makeAffectation({
        representation: { date: DATE_AUTRE, projet: { id: 'projet-abc', type: 'THEATRE' } },
      }),
    ]
    const result = scorerCandidat(affectations, CONTEXTE)
    expect(result.score).toBeGreaterThanOrEqual(4)
    expect(result.raisons).toContain('A déjà travaillé sur Peter Pan')
  })

  it('N\'ajoute pas simultanément +4 et +3 (même projet exclut même type)', () => {
    const affectations = [
      makeAffectation({
        representation: { date: DATE_AUTRE, projet: { id: 'projet-abc', type: 'THEATRE' } },
      }),
    ]
    const result = scorerCandidat(affectations, CONTEXTE)
    // Si +4 déclenché, pas de +3
    const hasPlusQuatre = result.raisons.some((r) => r.includes('Peter Pan'))
    const hasPlusTrois = result.raisons.some((r) => r.includes('Expérience en'))
    expect(hasPlusQuatre).toBe(true)
    expect(hasPlusTrois).toBe(false)
  })
})

describe('scorerCandidat — bonus +3 : même type de projet', () => {
  it('ajoute +3 si le candidat a travaillé sur un projet du même type (mais pas ce projet)', () => {
    const affectations = [
      makeAffectation({
        representation: { date: DATE_AUTRE, projet: { id: 'autre-projet', type: 'THEATRE' } },
      }),
    ]
    const result = scorerCandidat(affectations, CONTEXTE)
    expect(result.score).toBeGreaterThanOrEqual(3)
    expect(result.raisons).toContain('Expérience en theatre')
  })

  it('n\'ajoute pas +3 si le type de projet est différent', () => {
    const affectations = [
      makeAffectation({
        representation: { date: DATE_AUTRE, projet: { id: 'autre-projet', type: 'CONCERT' } },
      }),
    ]
    const result = scorerCandidat(affectations, CONTEXTE)
    const hasTypebonus = result.raisons.some((r) => r.includes('Expérience en'))
    expect(hasTypebonus).toBe(false)
  })
})

describe('scorerCandidat — bonus +2 : même poste', () => {
  it('ajoute +2 si le candidat a déjà tenu CE poste (même nom)', () => {
    const affectations = [
      makeAffectation({
        posteRequis: { name: 'Régisseur son' },
      }),
    ]
    const result = scorerCandidat(affectations, CONTEXTE)
    expect(result.score).toBeGreaterThanOrEqual(2)
    expect(result.raisons).toContain('Poste Régisseur son déjà tenu')
  })

  it('vérifie le poste de manière insensible à la casse', () => {
    const affectations = [
      makeAffectation({
        posteRequis: { name: 'RÉGISSEUR SON' },
      }),
    ]
    const result = scorerCandidat(affectations, CONTEXTE)
    expect(result.raisons).toContain('Poste Régisseur son déjà tenu')
  })

  it('n\'ajoute pas +2 si le poste est différent', () => {
    const affectations = [
      makeAffectation({
        posteRequis: { name: 'Machiniste' },
      }),
    ]
    const result = scorerCandidat(affectations, CONTEXTE)
    const hasPosteBonus = result.raisons.some((r) => r.includes('déjà tenu'))
    expect(hasPosteBonus).toBe(false)
  })
})

describe('scorerCandidat — malus -10 : conflit horaire (éliminatoire)', () => {
  it('applique -10 si conflit horaire le même jour', () => {
    const affectations = [
      makeAffectation({
        representation: { date: DATE_REP, projet: { id: 'autre-projet', type: 'CONCERT' } },
        startTime: '20:00',
        endTime: '23:00',
        confirmationStatus: 'CONFIRMEE',
      }),
    ]
    const result = scorerCandidat(affectations, CONTEXTE)
    expect(result.score).toBeLessThanOrEqual(-10)
    expect(result.aConflit).toBe(true)
    expect(result.disponible).toBe(false)
    expect(result.raisons).toContain('Conflit horaire sur cette date')
  })

  it('ne pénalise pas si la date est différente', () => {
    const affectations = [
      makeAffectation({
        representation: { date: DATE_AUTRE, projet: { id: 'autre-projet', type: 'CONCERT' } },
        startTime: '19:00',
        endTime: '22:00',
      }),
    ]
    const result = scorerCandidat(affectations, CONTEXTE)
    expect(result.aConflit).toBe(false)
    expect(result.disponible).toBe(true)
  })

  it('ne pénalise pas si les créneaux sont consécutifs (fin = début)', () => {
    const affectations = [
      makeAffectation({
        representation: { date: DATE_REP, projet: { id: 'autre-projet', type: 'CONCERT' } },
        startTime: '22:00',
        endTime: '23:59',
      }),
    ]
    // Le créneau du contexte se termine à 22:00, cette affectation commence à 22:00 → pas de chevauchement
    const result = scorerCandidat(affectations, CONTEXTE)
    expect(result.aConflit).toBe(false)
  })

  it('n\'applique pas -10 sur les affectations annulées', () => {
    const affectations = [
      makeAffectation({
        confirmationStatus: 'ANNULEE',
        representation: { date: DATE_REP, projet: { id: 'autre-projet', type: 'CONCERT' } },
        startTime: '20:00',
        endTime: '23:00',
      }),
    ]
    const result = scorerCandidat(affectations, CONTEXTE)
    expect(result.aConflit).toBe(false)
    expect(result.disponible).toBe(true)
  })

  it('n\'applique pas -10 sur les affectations ANNULEE_TARDIVE', () => {
    const affectations = [
      makeAffectation({
        confirmationStatus: 'ANNULEE_TARDIVE',
        representation: { date: DATE_REP, projet: { id: 'autre-projet', type: 'CONCERT' } },
        startTime: '20:00',
        endTime: '23:00',
      }),
    ]
    const result = scorerCandidat(affectations, CONTEXTE)
    expect(result.aConflit).toBe(false)
  })
})

describe('scorerCandidat — malus -5 : jamais répondu (peu fiable)', () => {
  it('applique -5 si le candidat a des affectations mais n\'a jamais répondu', () => {
    // Affectations sur un projet d'un type différent pour éviter tout bonus +3
    const affectations = [
      makeAffectation({
        confirmationStatus: 'EN_ATTENTE',
        representation: { date: DATE_AUTRE, projet: { id: 'autre-projet', type: 'CONCERT' } },
      }),
      makeAffectation({
        confirmationStatus: 'EN_ATTENTE',
        representation: { date: DATE_AUTRE, projet: { id: 'autre-projet-2', type: 'CONCERT' } },
      }),
    ]
    const result = scorerCandidat(affectations, CONTEXTE)
    expect(result.raisons).toContain('Peu fiable (jamais répondu)')
    expect(result.score).toBe(-5)
  })

  it('n\'applique pas -5 si le candidat a confirmé au moins une affectation', () => {
    const affectations = [
      makeAffectation({ confirmationStatus: 'EN_ATTENTE' }),
      makeAffectation({ confirmationStatus: 'CONFIRMEE' }),
    ]
    const result = scorerCandidat(affectations, CONTEXTE)
    const hasPenalty = result.raisons.some((r) => r.includes('Peu fiable'))
    expect(hasPenalty).toBe(false)
  })

  it('n\'applique pas -5 si le candidat a refusé au moins une affectation', () => {
    const affectations = [
      makeAffectation({ confirmationStatus: 'EN_ATTENTE' }),
      makeAffectation({ confirmationStatus: 'REFUSEE' }),
    ]
    const result = scorerCandidat(affectations, CONTEXTE)
    const hasPenalty = result.raisons.some((r) => r.includes('Peu fiable'))
    expect(hasPenalty).toBe(false)
  })

  it('n\'applique pas -5 si le candidat n\'a aucune affectation (nouveau)', () => {
    const result = scorerCandidat([], CONTEXTE)
    const hasPenalty = result.raisons.some((r) => r.includes('Peu fiable'))
    expect(hasPenalty).toBe(false)
  })
})

describe('scorerCandidat — calcul temps de réponse', () => {
  it('retourne null si aucune affectation confirmée avec date', () => {
    const affectations = [makeAffectation({ confirmedAt: null })]
    const result = scorerCandidat(affectations, CONTEXTE)
    expect(result.tempsReponse).toBeNull()
  })

  it('retourne "< 2h" si réponse en moins de 2h', () => {
    const createdAt = new Date('2026-01-01T10:00:00.000Z')
    const confirmedAt = new Date('2026-01-01T11:00:00.000Z') // 1h après
    const affectations = [makeAffectation({ createdAt, confirmedAt })]
    const result = scorerCandidat(affectations, CONTEXTE)
    expect(result.tempsReponse).toBe('< 2h')
  })

  it('retourne "~Xh" si réponse entre 2h et 24h', () => {
    const createdAt = new Date('2026-01-01T10:00:00.000Z')
    const confirmedAt = new Date('2026-01-01T16:00:00.000Z') // 6h après
    const affectations = [makeAffectation({ createdAt, confirmedAt })]
    const result = scorerCandidat(affectations, CONTEXTE)
    expect(result.tempsReponse).toBe('~6h')
  })

  it('retourne "> 24h" si réponse après 24h', () => {
    const createdAt = new Date('2026-01-01T10:00:00.000Z')
    const confirmedAt = new Date('2026-01-03T10:00:00.000Z') // 48h après
    const affectations = [makeAffectation({ createdAt, confirmedAt })]
    const result = scorerCandidat(affectations, CONTEXTE)
    expect(result.tempsReponse).toBe('> 24h')
  })

  it('calcule la moyenne de réponse sur plusieurs affectations', () => {
    const base = new Date('2026-01-01T10:00:00.000Z')
    const a1 = makeAffectation({
      createdAt: base,
      confirmedAt: new Date(base.getTime() + 4 * 60 * 60 * 1000), // +4h
    })
    const a2 = makeAffectation({
      createdAt: base,
      confirmedAt: new Date(base.getTime() + 8 * 60 * 60 * 1000), // +8h
    })
    // Moyenne = 6h → "~6h"
    const result = scorerCandidat([a1, a2], CONTEXTE)
    expect(result.tempsReponse).toBe('~6h')
  })
})

describe('scorerCandidat — cumul des scores', () => {
  it('cumule correctement les bonus (+4, +2) sans conflit', () => {
    const affectations = [
      makeAffectation({
        representation: { date: DATE_AUTRE, projet: { id: 'projet-abc', type: 'THEATRE' } },
        posteRequis: { name: 'Régisseur son' },
      }),
    ]
    const result = scorerCandidat(affectations, CONTEXTE)
    // +4 (même projet) + 2 (même poste) = 6
    expect(result.score).toBe(6)
  })

  it('cumule correctement les bonus (+3, +2) sans conflit', () => {
    const affectations = [
      makeAffectation({
        representation: { date: DATE_AUTRE, projet: { id: 'autre-projet', type: 'THEATRE' } },
        posteRequis: { name: 'Régisseur son' },
      }),
    ]
    const result = scorerCandidat(affectations, CONTEXTE)
    // +3 (même type) + 2 (même poste) = 5
    expect(result.score).toBe(5)
  })

  it('un candidat avec conflit reste négatif malgré les bonus', () => {
    const affectations = [
      makeAffectation({
        representation: { date: DATE_REP, projet: { id: 'projet-abc', type: 'THEATRE' } },
        posteRequis: { name: 'Régisseur son' },
        startTime: '20:00',
        endTime: '23:00',
      }),
    ]
    const result = scorerCandidat(affectations, CONTEXTE)
    // +4 (même projet) + 2 (même poste) - 10 (conflit) = -4
    expect(result.score).toBe(-4)
    expect(result.aConflit).toBe(true)
  })
})

// ─── Tests bonusContrat ───────────────────────────────────

describe('bonusContrat', () => {
  it('retourne +1 si contractType est INTERMITTENT', () => {
    expect(bonusContrat('INTERMITTENT', 'INTERMITTENT')).toBe(1)
  })

  it('retourne +1 si contractTypePreference est INDIFFERENT (peu importe le contrat)', () => {
    expect(bonusContrat('CDI', 'INDIFFERENT')).toBe(1)
    expect(bonusContrat('CDD', 'INDIFFERENT')).toBe(1)
  })

  it('retourne +1 si INTERMITTENT + INDIFFERENT (pas de double bonus)', () => {
    expect(bonusContrat('INTERMITTENT', 'INDIFFERENT')).toBe(1)
  })

  it('retourne 0 si contrat CDI et préférence INTERMITTENT', () => {
    expect(bonusContrat('CDI', 'INTERMITTENT')).toBe(0)
  })

  it('retourne 0 si contrat CDD et préférence INTERMITTENT', () => {
    expect(bonusContrat('CDD', 'INTERMITTENT')).toBe(0)
  })
})
