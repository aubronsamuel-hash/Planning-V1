'use client'
// ─────────────────────────────────────────────────────────
// Providers globaux — SessionProvider NextAuth
// ─────────────────────────────────────────────────────────
import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'

type ProvidersProps = {
  children: React.ReactNode
  session?: Session | null
}

export function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  )
}
