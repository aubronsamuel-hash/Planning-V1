// ─────────────────────────────────────────────────────────
// Notifications — fonctions serveur (Prisma)
// ⚠️ Ce fichier est SERVER ONLY — ne jamais importer côté client
// doc/13-notifications.md
// ─────────────────────────────────────────────────────────
import type { NotificationType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DEFAULT_PRIORITY,
  NOTIFICATION_ACTION_LABELS,
  NOTIFICATION_LABELS,
} from '@/lib/notifications'

type CreateNotificationInput = {
  userId: string
  organizationId: string
  type: NotificationType
  title?: string   // optionnel — fallback sur NOTIFICATION_LABELS[type]
  body: string
  link?: string    // URL de la page concernée (champ 'link' dans le schema)
  actionLabel?: string
  groupId?: string
}

// ── Helper : créer une notification in-app ────────────────
export async function createInAppNotification(input: CreateNotificationInput): Promise<void> {
  const channel = NOTIFICATION_CHANNELS[input.type]
  if (channel === 'EMAIL') return // ce type ne produit pas de notif in-app

  await prisma.notification.create({
    data: {
      userId:         input.userId,
      organizationId: input.organizationId,
      type:           input.type,
      title:          input.title ?? NOTIFICATION_LABELS[input.type],
      body:           input.body,
      priority:       NOTIFICATION_DEFAULT_PRIORITY[input.type],
      link:           input.link,
      actionLabel:    input.actionLabel ?? NOTIFICATION_ACTION_LABELS[input.type],
      groupId:        input.groupId,
    },
  })
}

// ── Helper : créer des notifications en masse (broadcast) ─
export async function broadcastNotification(
  userIds: string[],
  input: Omit<CreateNotificationInput, 'userId'>
): Promise<void> {
  const channel = NOTIFICATION_CHANNELS[input.type]
  if (channel === 'EMAIL') return

  if (userIds.length === 0) return

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      organizationId: input.organizationId,
      type:           input.type,
      title:          input.title ?? NOTIFICATION_LABELS[input.type],
      body:           input.body,
      priority:       NOTIFICATION_DEFAULT_PRIORITY[input.type],
      link:           input.link,
      actionLabel:    input.actionLabel ?? NOTIFICATION_ACTION_LABELS[input.type],
      groupId:        input.groupId,
    })),
  })
}
