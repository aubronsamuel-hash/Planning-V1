// ─────────────────────────────────────────────────────────
// Notifications — catalogue des types + canaux
// doc/13-notifications.md
// ─────────────────────────────────────────────────────────
import type { NotificationType, NotificationPriority } from '@prisma/client'

// ── Canaux de diffusion ───────────────────────────────────

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'IN_APP_AND_EMAIL'

// Catalogue : pour chaque type, quel canal utiliser
// EMAIL uniquement = collaborateur probablement GHOST (pas de compte actif)
// IN_APP = persistant dans le centre de notifications
export const NOTIFICATION_CHANNELS: Record<NotificationType, NotificationChannel> = {
  // Affectations
  AFFECTATION_CREEE:        'IN_APP',
  AFFECTATION_MODIFIEE:     'IN_APP',
  AFFECTATION_ANNULEE:      'IN_APP_AND_EMAIL',
  // Confirmation
  CONFIRMATION_REQUISE:     'EMAIL',             // invitation intermittent → GHOST, lien dans email
  CONFIRMATION_RECUE:       'IN_APP',            // régisseur + chef de poste
  CONFIRMATION_REFUSEE:     'IN_APP_AND_EMAIL',  // régisseur + chef de poste
  RAPPEL_CONFIRMATION:      'EMAIL',             // 48h EN_ATTENTE → GHOST possible
  // Planning
  POSTE_NON_POURVU:         'IN_APP_AND_EMAIL',  // J-7 poste encore vide
  REMPLACEMENT_URGENT:      'IN_APP_AND_EMAIL',  // annulation tardive ≤48h
  // RH
  DPAE_A_FAIRE:             'IN_APP_AND_EMAIL',  // RH — nouvelle affectation intermittent/CDD ou J-1
  // Événements
  REPRESENTATION_ANNULEE:   'IN_APP_AND_EMAIL',  // tous les collaborateurs affectés
  REPRESENTATION_REPORTEE:  'IN_APP_AND_EMAIL',  // tous les collaborateurs affectés
  PROJET_ANNULE:            'IN_APP_AND_EMAIL',  // régisseurs + chefs + collaborateurs affectés
  // Feuille de route
  FEUILLE_DE_ROUTE_PUBLIEE: 'IN_APP_AND_EMAIL',  // tous les collaborateurs affectés
  FEUILLE_DE_ROUTE_MODIFIEE:'IN_APP',            // tous les collaborateurs affectés
  // RGPD
  RGPD_AVERTISSEMENT:       'EMAIL',             // 30j avant anonymisation → GHOST possible
}

// ── Labels d'affichage ────────────────────────────────────

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  AFFECTATION_CREEE:        'Affectation créée',
  AFFECTATION_MODIFIEE:     'Affectation modifiée',
  AFFECTATION_ANNULEE:      'Affectation annulée',
  CONFIRMATION_REQUISE:     'Confirmation requise',
  CONFIRMATION_RECUE:       'Confirmation reçue',
  CONFIRMATION_REFUSEE:     'Confirmation refusée',
  RAPPEL_CONFIRMATION:      'Rappel de confirmation',
  POSTE_NON_POURVU:         'Poste non pourvu',
  REMPLACEMENT_URGENT:      'Remplacement urgent',
  DPAE_A_FAIRE:             'DPAE à soumettre',
  REPRESENTATION_ANNULEE:   'Représentation annulée',
  REPRESENTATION_REPORTEE:  'Représentation reportée',
  PROJET_ANNULE:            'Projet annulé',
  FEUILLE_DE_ROUTE_PUBLIEE: 'Feuille de route publiée',
  FEUILLE_DE_ROUTE_MODIFIEE:'Feuille de route modifiée',
  RGPD_AVERTISSEMENT:       'Avertissement RGPD',
}

// ── Priorités par défaut ──────────────────────────────────
// Utilisé comme fallback si la priorité n'est pas forcée à la création
// ⚠️ NotificationPriority : CRITIQUE | URGENT | INFO (pas NORMAL — voir schema.prisma)
export const NOTIFICATION_DEFAULT_PRIORITY: Record<NotificationType, NotificationPriority> = {
  AFFECTATION_CREEE:        'INFO',
  AFFECTATION_MODIFIEE:     'INFO',
  AFFECTATION_ANNULEE:      'URGENT',
  CONFIRMATION_REQUISE:     'INFO',
  CONFIRMATION_RECUE:       'INFO',
  CONFIRMATION_REFUSEE:     'URGENT',
  RAPPEL_CONFIRMATION:      'INFO',
  POSTE_NON_POURVU:         'URGENT',
  REMPLACEMENT_URGENT:      'CRITIQUE',
  DPAE_A_FAIRE:             'CRITIQUE',
  REPRESENTATION_ANNULEE:   'URGENT',
  REPRESENTATION_REPORTEE:  'URGENT',
  PROJET_ANNULE:            'URGENT',
  FEUILLE_DE_ROUTE_PUBLIEE: 'INFO',
  FEUILLE_DE_ROUTE_MODIFIEE:'INFO',
  RGPD_AVERTISSEMENT:       'INFO',
}

// ── Labels d'action (CTA dans le dropdown) ───────────────

export const NOTIFICATION_ACTION_LABELS: Partial<Record<NotificationType, string>> = {
  CONFIRMATION_RECUE:      'Voir la grille',
  CONFIRMATION_REFUSEE:    'Trouver un remplaçant',
  POSTE_NON_POURVU:        'Affecter',
  REMPLACEMENT_URGENT:     'Voir les candidats',
  DPAE_A_FAIRE:            'Soumettre la DPAE',
  REPRESENTATION_REPORTEE: 'Reconfirmer',
  FEUILLE_DE_ROUTE_PUBLIEE:'Voir',
  FEUILLE_DE_ROUTE_MODIFIEE:'Voir les changements',
}

// ── Fonctions serveur ─────────────────────────────────────
// createInAppNotification et broadcastNotification sont dans
// @/lib/notifications.server (server only — utilise Prisma)
