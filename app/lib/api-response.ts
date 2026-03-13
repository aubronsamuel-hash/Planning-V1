// ─────────────────────────────────────────────────────────
// Helpers de réponse API unifiés
// doc/23-architecture-technique.md §23.3
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import type { ApiError } from '@/types/api'

export const apiError = (
  code: string,
  message: string,
  status: number,
  details?: unknown
) => NextResponse.json<ApiError>({ error: message, code, details }, { status })

// Raccourcis
export const unauthorized = () =>
  apiError('UNAUTHORIZED', 'Non authentifié', 401)

export const forbidden = (msg = 'Droits insuffisants') =>
  apiError('FORBIDDEN', msg, 403)

export const notFound = (entity = 'Ressource') =>
  apiError('NOT_FOUND', `${entity} introuvable`, 404)

export const validationError = (details: unknown) =>
  apiError('VALIDATION_ERROR', 'Données invalides', 422, details)

export const quotaExceeded = (msg: string) =>
  apiError('QUOTA_EXCEEDED', msg, 403)

export const conflict = (msg: string) =>
  apiError('CONFLICT', msg, 409)

export const orgSuspended = () =>
  apiError('ORG_SUSPENDED', 'Organisation suspendue — contactez le support', 403)

export const orgReadOnly = () =>
  apiError('ORG_READ_ONLY', 'Organisation en lecture seule — abonnement requis sur /settings/organisation#facturation', 403)

export const internalError = () =>
  apiError('INTERNAL_ERROR', 'Erreur serveur', 500)
