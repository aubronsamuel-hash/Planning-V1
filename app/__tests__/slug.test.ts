// ─────────────────────────────────────────────────────────
// Tests unitaires — lib/slug.ts
// Vérifie la génération de slugs URL-safe
// ─────────────────────────────────────────────────────────
import { describe, it, expect, vi } from 'vitest'

// Mock prisma pour ne pas se connecter à la DB
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
    },
  },
}))

import { toSlug, generateUniqueOrgSlug } from '@/lib/slug'
import { prisma } from '@/lib/prisma'

describe('toSlug', () => {
  it('convertit en minuscules', () => {
    expect(toSlug('THEATRE')).toBe('theatre')
  })

  it('supprime les accents', () => {
    expect(toSlug('Théâtre du Nord')).toBe('theatre-du-nord')
    expect(toSlug('Compagnie Éclat')).toBe('compagnie-eclat')
    expect(toSlug('Opéra de Paris')).toBe('opera-de-paris')
  })

  it('remplace les espaces par des tirets', () => {
    expect(toSlug('ma structure')).toBe('ma-structure')
    expect(toSlug('  espaces   multiples  ')).toBe('espaces-multiples')
  })

  it('supprime les caractères spéciaux', () => {
    expect(toSlug('L\'Atelier & Cie')).toBe('latelier-cie')
    expect(toSlug('Studio! Show.')).toBe('studio-show')
  })

  it('fusionne les tirets multiples', () => {
    expect(toSlug('a--b---c')).toBe('a-b-c')
  })

  it('tronque à 60 caractères', () => {
    const long = 'a'.repeat(80)
    expect(toSlug(long).length).toBeLessThanOrEqual(60)
  })

  it('gère une chaîne vide', () => {
    expect(toSlug('')).toBe('')
  })
})

describe('generateUniqueOrgSlug', () => {
  it('retourne le slug de base si disponible', async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce(null)
    const slug = await generateUniqueOrgSlug('Mon Théâtre')
    expect(slug).toBe('mon-theatre')
  })

  it('ajoute un suffixe numérique si le slug est déjà pris', async () => {
    vi.mocked(prisma.organization.findUnique)
      .mockResolvedValueOnce({ id: 'existing' } as any)  // 'mon-theatre' pris
      .mockResolvedValueOnce(null)                         // 'mon-theatre-1' libre
    const slug = await generateUniqueOrgSlug('Mon Théâtre')
    expect(slug).toBe('mon-theatre-1')
  })

  it('continue à incrémenter si plusieurs slugs sont pris', async () => {
    vi.mocked(prisma.organization.findUnique)
      .mockResolvedValueOnce({ id: 'a' } as any)   // base pris
      .mockResolvedValueOnce({ id: 'b' } as any)   // base-1 pris
      .mockResolvedValueOnce({ id: 'c' } as any)   // base-2 pris
      .mockResolvedValueOnce(null)                  // base-3 libre
    const slug = await generateUniqueOrgSlug('Test Org')
    expect(slug).toBe('test-org-3')
  })

  it('utilise "organisation" si le nom produit un slug vide', async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce(null)
    const slug = await generateUniqueOrgSlug('!@#$%')
    expect(slug).toBe('organisation')
  })
})
