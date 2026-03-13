// ─────────────────────────────────────────────────────────
// Helpers upload S3 — doc/23-architecture-technique.md §23.7
// Règle #10 : signed URLs 1h max, jamais d'URLs publiques
// ─────────────────────────────────────────────────────────
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.AWS_S3_BUCKET_NAME!

// Types MIME autorisés par type de document
export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  CONTRAT: ['application/pdf'],
  FICHE_RH: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  PHOTO: ['image/jpeg', 'image/png', 'image/webp'],
  AVATAR: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  LOGO: ['image/jpeg', 'image/png', 'image/svg+xml'],
  AUTRE: ['application/pdf', 'image/jpeg', 'image/png', 'text/plain'],
}

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20 Mo
export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024 // 2 Mo

// Validation côté serveur — avant de générer la presigned URL
export function validateUpload(
  mimeType: string,
  sizeBytes: number,
  documentType: string
): string | null {
  const allowed = ALLOWED_MIME_TYPES[documentType] ?? ALLOWED_MIME_TYPES['AUTRE']
  if (!allowed.includes(mimeType)) return `Type de fichier non autorisé : ${mimeType}`
  const maxSize = ['AVATAR', 'LOGO'].includes(documentType)
    ? MAX_AVATAR_SIZE_BYTES
    : MAX_FILE_SIZE_BYTES
  if (sizeBytes > maxSize) return `Fichier trop volumineux (max ${maxSize / 1024 / 1024} Mo)`
  return null
}

// Génère la clé S3 — structure : org_id/entity_type/entity_id/filename
export function buildS3Key(
  orgId: string,
  entityType: string,
  entityId: string,
  filename: string
): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const timestamp = Date.now()
  return `${orgId}/${entityType.toLowerCase()}/${entityId}/${timestamp}_${sanitized}`
}

// Presigned URL upload (PUT) — expire 10 min (upload doit être rapide)
export async function getUploadPresignedUrl(s3Key: string, mimeType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ContentType: mimeType,
  })
  return getSignedUrl(s3, command, { expiresIn: 600 }) // 10 min
}

// Presigned URL lecture (GET) — expire 1h (Règle #10)
export async function getDownloadPresignedUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key })
  return getSignedUrl(s3, command, { expiresIn: 3600 }) // 1h
}
