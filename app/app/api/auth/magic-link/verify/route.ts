// ─────────────────────────────────────────────────────────
// GET /api/auth/magic-link/verify?token=xxx
// Vérifie un magic link et initie la session NextAuth
// doc/06-regles-decisions.md Règle #17
// Note : la validation du token (usage unique, expiration) est gérée
//        dans le CredentialsProvider 'magic-link' de NextAuth.
//        Cette route sert uniquement de redirection pour les tokens
//        arrivant par email (ex : /login/verify?token=xxx).
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=missing-token', req.url))
  }

  // Vérification rapide avant de passer au flow NextAuth
  const magicToken = await prisma.magicLinkToken.findUnique({
    where: { token },
    select: { usedAt: true, expiresAt: true, purpose: true, metadata: true },
  })

  if (!magicToken) {
    return NextResponse.redirect(new URL('/login?error=invalid-token', req.url))
  }

  if (magicToken.usedAt) {
    return NextResponse.redirect(new URL('/login?error=token-used', req.url))
  }

  if (magicToken.expiresAt < new Date()) {
    return NextResponse.redirect(new URL('/login?error=token-expired', req.url))
  }

  // Token valide → redirige vers la page de verification côté client
  // qui appellera signIn('magic-link', { token }) pour créer la session NextAuth
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const redirectUrl = new URL('/login/verify', baseUrl)
  redirectUrl.searchParams.set('token', token)

  return NextResponse.redirect(redirectUrl)
}
