// ─────────────────────────────────────────────────────────
// NextAuth.js — Route handler (GET + POST uniquement)
// authOptions est dans lib/auth-options.ts pour éviter
// l'export non-standard dans un route handler Next.js 14
// ─────────────────────────────────────────────────────────
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth-options'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
