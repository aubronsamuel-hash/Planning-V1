import { UserRole, OrganizationRole, OrganizationPlan } from '@prisma/client'
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      // Niveau 1 — Plateforme
      role: UserRole                          // SUPER_ADMIN | MEMBER
      // Niveau 2 — Organisation active
      organizationId: string | null           // null pour SUPER_ADMIN ou avant sélection
      organizationRole: OrganizationRole | null // DIRECTEUR | REGISSEUR | RH | COLLABORATEUR
      organizationPlan: OrganizationPlan | null // FREE | PRO | ENTERPRISE
      // Niveau 3 — Chef de poste (IDs des équipes où l'user est CHEF)
      chefEquipes: string[]
    }
  }

  interface User {
    id: string
    role: UserRole
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string
    role: UserRole
    organizationId: string | null
    organizationRole: OrganizationRole | null
    organizationPlan: OrganizationPlan | null
    chefEquipes: string[]
  }
}
