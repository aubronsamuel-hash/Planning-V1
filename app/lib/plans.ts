// ─────────────────────────────────────────────────────────
// Plans tarifaires — source de vérité des quotas et features
// doc/23-architecture-technique.md §23.4
// doc/20-plans-tarifaires.md
// ─────────────────────────────────────────────────────────
import { OrganizationPlan } from '@prisma/client'

export type PlanLimits = {
  maxCollaborateurs: number   // -1 = illimité
  maxProjetsActifs: number    // -1 = illimité
  maxStorageBytes: number     // stockage total documents S3
  features: {
    dpae: boolean               // accès module DPAE
    remplacementUrgent: boolean // workflow remplacement urgent J-48h
    templates: boolean          // templates de projets
    feuilleDeRoute: boolean     // compagnon logistique terrain
    moduleTournee: boolean      // hébergement + flotte (ENTERPRISE uniquement)
    exportCsv: boolean          // export paie CSV (SAGE/Cegid)
    multiRegisseur: boolean     // plusieurs régisseurs par projet
  }
}

export const PLAN_LIMITS: Record<OrganizationPlan, PlanLimits> = {
  FREE: {
    maxCollaborateurs: 3,
    maxProjetsActifs: 1,
    maxStorageBytes: 500 * 1024 * 1024, // 500 Mo
    features: {
      dpae: false,
      remplacementUrgent: false,
      templates: false,
      feuilleDeRoute: false,
      moduleTournee: false,
      exportCsv: false,
      multiRegisseur: false,
    },
  },
  PRO: {
    maxCollaborateurs: 20,
    maxProjetsActifs: -1,
    maxStorageBytes: 5 * 1024 * 1024 * 1024, // 5 Go
    features: {
      dpae: true,
      remplacementUrgent: true,
      templates: true,
      feuilleDeRoute: true,
      moduleTournee: false,
      exportCsv: true,
      multiRegisseur: true,
    },
  },
  ENTERPRISE: {
    maxCollaborateurs: -1,
    maxProjetsActifs: -1,
    maxStorageBytes: 50 * 1024 * 1024 * 1024, // 50 Go
    features: {
      dpae: true,
      remplacementUrgent: true,
      templates: true,
      feuilleDeRoute: true,
      moduleTournee: true,
      exportCsv: true,
      multiRegisseur: true,
    },
  },
}

export function getPlanLimits(plan: OrganizationPlan): PlanLimits {
  return PLAN_LIMITS[plan]
}

// activeCount = projets avec status EN_PREPARATION | EN_COURS uniquement
export function canAddProjet(plan: OrganizationPlan, activeCount: number): boolean {
  const { maxProjetsActifs } = PLAN_LIMITS[plan]
  if (maxProjetsActifs === -1) return true
  return activeCount < maxProjetsActifs
}

export function canAddCollaborateur(plan: OrganizationPlan, currentCount: number): boolean {
  const { maxCollaborateurs } = PLAN_LIMITS[plan]
  if (maxCollaborateurs === -1) return true
  return currentCount < maxCollaborateurs
}

export function hasFeature(plan: OrganizationPlan, feature: keyof PlanLimits['features']): boolean {
  return PLAN_LIMITS[plan].features[feature]
}

// currentStorageBytes = SUM(sizeBytes) WHERE deletedAt IS NULL uniquement
export function canUploadDocument(
  plan: OrganizationPlan,
  currentStorageBytes: number,
  fileSizeBytes: number
): boolean {
  return currentStorageBytes + fileSizeBytes <= PLAN_LIMITS[plan].maxStorageBytes
}

// Message d'erreur quota — lien vers facturation
export function quotaMessage(plan: OrganizationPlan, type: 'collaborateur' | 'projet'): string {
  const limits = PLAN_LIMITS[plan]
  if (type === 'collaborateur') {
    return `Limite de ${limits.maxCollaborateurs} collaborateurs atteinte sur le plan ${plan}. Passez au plan supérieur sur /settings/organisation#facturation`
  }
  return `Limite de ${limits.maxProjetsActifs} projet(s) actif(s) atteinte sur le plan ${plan}. Passez au plan supérieur sur /settings/organisation#facturation`
}
