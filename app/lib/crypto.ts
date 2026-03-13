// ─────────────────────────────────────────────────────────
// Chiffrement AES-256 — données sensibles (N°SS, IBAN)
// doc/06 Règle #9 — déchiffrement RH uniquement
// Clé : ENCRYPTION_KEY (32 octets hex dans .env)
// ─────────────────────────────────────────────────────────
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16    // bytes
const TAG_LENGTH = 16   // bytes (GCM auth tag)

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY manquante dans les variables d\'environnement')
  const buf = Buffer.from(key, 'hex')
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY doit faire 32 octets (64 hex chars)')
  return buf
}

// Retourne "iv:ciphertext:tag" en base64, séparés par ":"
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    iv.toString('base64'),
    encrypted.toString('base64'),
    tag.toString('base64'),
  ].join(':')
}

export function decrypt(ciphertext: string): string {
  const key = getKey()
  const [ivB64, encB64, tagB64] = ciphertext.split(':')
  if (!ivB64 || !encB64 || !tagB64) throw new Error('Format de données chiffrées invalide')
  const iv = Buffer.from(ivB64, 'base64')
  const encrypted = Buffer.from(encB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
}

// Masquage partiel pour affichage non-RH (ex: "2 •• ••• ••• ••• ••")
export function maskSocialSecurityNumber(noss: string): string {
  const clean = noss.replace(/\s/g, '')
  if (clean.length < 4) return '•••••••••••••••'
  return clean.slice(0, 1) + ' •• ••• ••• ••• ' + clean.slice(-2)
}

// Masquage partiel IBAN (ex: "FR76 •••• •••• ••••")
export function maskIban(iban: string): string {
  const clean = iban.replace(/\s/g, '')
  if (clean.length < 6) return '•••••••••••••••••••••'
  return clean.slice(0, 4) + ' •••• •••• •••• ' + clean.slice(-4)
}
