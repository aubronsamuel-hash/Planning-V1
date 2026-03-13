// ─────────────────────────────────────────────────────────
// Génération de slug — utilisé pour Organization.slug
// ─────────────────────────────────────────────────────────
import { prisma } from '@/lib/prisma'

/**
 * Transforme un nom en slug URL-safe : minuscules, tirets, sans accents.
 * Ex: "Théâtre du Nord" → "theatre-du-nord"
 */
export function toSlug(name: string): string {
  return name
    .normalize('NFD')                        // décompose les accents
    .replace(/[\u0300-\u036f]/g, '')         // supprime les diacritiques
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')           // supprime les caractères spéciaux
    .replace(/\s+/g, '-')                    // espaces → tirets
    .replace(/-+/g, '-')                     // tirets multiples → un seul
    .slice(0, 60)                            // limite à 60 caractères
}

/**
 * Génère un slug unique pour une organisation.
 * Si le slug de base est déjà pris, ajoute un suffixe numérique.
 */
export async function generateUniqueOrgSlug(name: string): Promise<string> {
  const base = toSlug(name) || 'organisation'
  let slug = base
  let counter = 1

  while (true) {
    const existing = await prisma.organization.findUnique({ where: { slug } })
    if (!existing) return slug
    slug = `${base}-${counter}`
    counter++
  }
}
