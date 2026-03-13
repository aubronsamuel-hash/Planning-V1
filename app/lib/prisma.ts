// ─────────────────────────────────────────────────────────
// Prisma Client — avec extension soft delete automatique
// doc/23-architecture-technique.md §23.2
// ─────────────────────────────────────────────────────────
import 'server-only'
import { PrismaClient } from '@prisma/client'

// Modèles avec soft delete — filtrage automatique deletedAt: null
const SOFT_DELETE_MODELS = ['Projet', 'Representation', 'Affectation', 'Document'] as const

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined
}

// prismaBase : accès direct sans filtre soft delete
// → usage réservé au back-office SUPER_ADMIN et à l'historique RH
export const prismaBase =
  globalForPrisma.prismaBase ?? new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaBase = prismaBase

// prisma : client standard avec soft delete injecté automatiquement
// ⚠️ Ne jamais utiliser prisma.projet.findUnique() sur les modèles soft-deletable
//    → utiliser findFirst({ where: { id } }) à la place (deletedAt injecté par l'extension)
export const prisma = prismaBase.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        if (SOFT_DELETE_MODELS.includes(model as any)) {
          args.where = { ...args.where, deletedAt: null }
        }
        return query(args)
      },
      async findFirst({ model, args, query }) {
        if (SOFT_DELETE_MODELS.includes(model as any)) {
          args.where = { ...args.where, deletedAt: null }
        }
        return query(args)
      },
      async count({ model, args, query }) {
        if (SOFT_DELETE_MODELS.includes(model as any)) {
          args.where = { ...args.where, deletedAt: null }
        }
        return query(args)
      },
    },
  },
})
