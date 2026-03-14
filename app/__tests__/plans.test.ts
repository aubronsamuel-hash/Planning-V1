// ─────────────────────────────────────────────────────────
// Tests unitaires — lib/plans.ts
// Vérifie les quotas et feature gates par plan tarifaire
// ─────────────────────────────────────────────────────────
import { describe, it, expect, vi } from 'vitest'

// Mock @prisma/client pour éviter la connexion DB en tests
vi.mock('@prisma/client', () => ({
  OrganizationPlan: {
    FREE: 'FREE',
    PRO: 'PRO',
    ENTERPRISE: 'ENTERPRISE',
  },
}))

import {
  canAddProjet,
  canAddCollaborateur,
  hasFeature,
  canUploadDocument,
  quotaMessage,
  PLAN_LIMITS,
} from '@/lib/plans'

describe('PLAN_LIMITS', () => {
  it('FREE : 3 collaborateurs max, 1 projet actif', () => {
    expect(PLAN_LIMITS.FREE.maxCollaborateurs).toBe(3)
    expect(PLAN_LIMITS.FREE.maxProjetsActifs).toBe(1)
  })

  it('PRO : 20 collaborateurs, projets illimités (-1)', () => {
    expect(PLAN_LIMITS.PRO.maxCollaborateurs).toBe(20)
    expect(PLAN_LIMITS.PRO.maxProjetsActifs).toBe(-1)
  })

  it('ENTERPRISE : tout illimité (-1)', () => {
    expect(PLAN_LIMITS.ENTERPRISE.maxCollaborateurs).toBe(-1)
    expect(PLAN_LIMITS.ENTERPRISE.maxProjetsActifs).toBe(-1)
  })
})

describe('canAddProjet', () => {
  it('FREE bloque si 1 projet actif déjà présent', () => {
    expect(canAddProjet('FREE', 1)).toBe(false)
  })

  it('FREE autorise si 0 projet actif', () => {
    expect(canAddProjet('FREE', 0)).toBe(true)
  })

  it('PRO : toujours autorisé (illimité)', () => {
    expect(canAddProjet('PRO', 999)).toBe(true)
  })

  it('ENTERPRISE : toujours autorisé', () => {
    expect(canAddProjet('ENTERPRISE', 9999)).toBe(true)
  })
})

describe('canAddCollaborateur', () => {
  it('FREE bloque au 3ème (index 0..2)', () => {
    expect(canAddCollaborateur('FREE', 2)).toBe(true)
    expect(canAddCollaborateur('FREE', 3)).toBe(false)
  })

  it('PRO bloque au 20ème', () => {
    expect(canAddCollaborateur('PRO', 19)).toBe(true)
    expect(canAddCollaborateur('PRO', 20)).toBe(false)
  })

  it('ENTERPRISE toujours autorisé', () => {
    expect(canAddCollaborateur('ENTERPRISE', 10000)).toBe(true)
  })
})

describe('hasFeature', () => {
  it('FREE : aucune feature avancée', () => {
    expect(hasFeature('FREE', 'dpae')).toBe(false)
    expect(hasFeature('FREE', 'templates')).toBe(false)
    expect(hasFeature('FREE', 'moduleTournee')).toBe(false)
    expect(hasFeature('FREE', 'remplacementUrgent')).toBe(false)
    expect(hasFeature('FREE', 'exportCsv')).toBe(false)
    expect(hasFeature('FREE', 'feuilleDeRoute')).toBe(false)
    expect(hasFeature('FREE', 'multiRegisseur')).toBe(false)
  })

  it('PRO : toutes les features sauf moduleTournee', () => {
    expect(hasFeature('PRO', 'dpae')).toBe(true)
    expect(hasFeature('PRO', 'templates')).toBe(true)
    expect(hasFeature('PRO', 'moduleTournee')).toBe(false)
    expect(hasFeature('PRO', 'exportCsv')).toBe(true)
    expect(hasFeature('PRO', 'feuilleDeRoute')).toBe(true)
  })

  it('ENTERPRISE : toutes les features', () => {
    expect(hasFeature('ENTERPRISE', 'moduleTournee')).toBe(true)
    expect(hasFeature('ENTERPRISE', 'dpae')).toBe(true)
  })
})

describe('canUploadDocument', () => {
  const FREE_MAX = 500 * 1024 * 1024 // 500 Mo

  it('FREE : accepte si en dessous du quota', () => {
    expect(canUploadDocument('FREE', 0, 1024)).toBe(true)
    expect(canUploadDocument('FREE', FREE_MAX - 1, 0)).toBe(true)
  })

  it('FREE : refuse si dépasse le quota', () => {
    expect(canUploadDocument('FREE', FREE_MAX - 100, 200)).toBe(false)
    expect(canUploadDocument('FREE', FREE_MAX, 1)).toBe(false)
  })

  it('PRO : limite à 5 Go', () => {
    const PRO_MAX = 5 * 1024 * 1024 * 1024
    expect(canUploadDocument('PRO', PRO_MAX - 1, 0)).toBe(true)
    expect(canUploadDocument('PRO', PRO_MAX, 1)).toBe(false)
  })
})

describe('quotaMessage', () => {
  it('inclut le lien facturation', () => {
    const msg = quotaMessage('FREE', 'collaborateur')
    expect(msg).toContain('/settings/organisation#facturation')
    expect(msg).toContain('FREE')
  })

  it('inclut le lien facturation pour projet', () => {
    const msg = quotaMessage('FREE', 'projet')
    expect(msg).toContain('/settings/organisation#facturation')
  })
})
