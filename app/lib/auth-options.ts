// ─────────────────────────────────────────────────────────
// authOptions — configuration NextAuth extraite du route handler
// Séparé pour éviter l'export non-standard dans une route Next.js 14
// doc/23-architecture-technique.md §23.1
// ─────────────────────────────────────────────────────────
import type { AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import type { UserRole } from '@prisma/client'
import logger from '@/lib/logger'

export const authOptions: AuthOptions = {
  session: { strategy: 'jwt' },

  providers: [
    // Connexion par mot de passe (comptes ACTIVE uniquement)
    CredentialsProvider({
      id: 'credentials',
      name: 'Email & Mot de passe',
      credentials: {
        email:    { label: 'Email',       type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        })
        if (!user?.passwordHash) return null

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValid) return null

        return { id: user.id, email: user.email, role: user.role as UserRole }
      },
    }),

    // Magic Link (connexion sans mot de passe — comptes GHOST et ACTIVE)
    CredentialsProvider({
      id: 'magic-link',
      name: 'Magic Link',
      credentials: {
        token: { label: 'Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.token) return null

        const magicToken = await prisma.magicLinkToken.findUnique({
          where: { token: credentials.token },
          include: { user: true },
        })

        if (!magicToken) return null
        if (magicToken.usedAt) return null
        if (magicToken.expiresAt < new Date()) return null

        await prisma.magicLinkToken.update({
          where: { id: magicToken.id },
          data: { usedAt: new Date() },
        })

        await prisma.user.update({
          where: { id: magicToken.userId },
          data: { lastActiveAt: new Date() },
        })

        return {
          id: magicToken.user.id,
          email: magicToken.user.email,
          role: magicToken.user.role as UserRole,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.userId = user.id
        token.role = user.role as UserRole

        const membership = await prisma.organizationMembership.findFirst({
          where: { userId: user.id },
          orderBy: { joinedAt: 'asc' },
          include: { organization: { select: { plan: true } } },
        })

        const chefEquipes = await prisma.equipeMembre.findMany({
          where: { userId: user.id, role: 'CHEF' },
          select: { equipeId: true },
        })

        token.organizationId   = membership?.organizationId ?? null
        token.organizationRole = membership?.role ?? null
        token.organizationPlan = membership?.organization.plan ?? null
        token.chefEquipes      = chefEquipes.map((e) => e.equipeId)
      }

      if (trigger === 'update' && session?.organizationId) {
        token.organizationId = session.organizationId

        const membership = await prisma.organizationMembership.findUnique({
          where: {
            userId_organizationId: {
              userId: token.userId,
              organizationId: session.organizationId,
            },
          },
          include: { organization: { select: { plan: true } } },
        })

        const chefEquipes = await prisma.equipeMembre.findMany({
          where: {
            userId: token.userId,
            role: 'CHEF',
            equipe: { projetId: { not: undefined } },
          },
          select: { equipeId: true },
        })

        token.organizationRole = membership?.role ?? null
        token.organizationPlan = membership?.organization.plan ?? null
        token.chefEquipes      = chefEquipes.map((e) => e.equipeId)
      }

      return token
    },

    async session({ session, token }) {
      session.user.id                = token.userId
      session.user.role              = token.role
      session.user.organizationId    = token.organizationId
      session.user.organizationRole  = token.organizationRole
      session.user.organizationPlan  = token.organizationPlan
      session.user.chefEquipes       = token.chefEquipes ?? []
      return session
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },
}
