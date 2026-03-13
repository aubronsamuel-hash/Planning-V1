// ─────────────────────────────────────────────────────────
// Types API unifiés — doc/23-architecture-technique.md §23.3
// ─────────────────────────────────────────────────────────

export type ApiError = {
  error: string     // message lisible (affiché à l'utilisateur)
  code?: string     // code machine (pour le front)
  details?: unknown // données supplémentaires (validation Zod, etc.)
}

export type ApiResponse<T> = T | ApiError

// Codes d'erreur standards
export type ErrorCode =
  | 'UNAUTHORIZED'    // 401 — session manquante ou expirée
  | 'FORBIDDEN'       // 403 — rôle trop bas, mauvaise org
  | 'NOT_FOUND'       // 404 — ressource introuvable ou soft-deleted
  | 'VALIDATION_ERROR'// 422 — erreur Zod / contrainte métier
  | 'QUOTA_EXCEEDED'  // 403 — limite FREE, PRO atteinte
  | 'CONFLICT'        // 409 — conflit planning, double affectation
  | 'ORG_SUSPENDED'   // 403 — organisation suspendue par SUPER_ADMIN
  | 'ORG_READ_ONLY'   // 403 — trial expiré ou paiement échoué
  | 'STRIPE_ERROR'    // 502 — erreur Stripe upstream
  | 'INTERNAL_ERROR'  // 500 — erreur serveur non anticipée
