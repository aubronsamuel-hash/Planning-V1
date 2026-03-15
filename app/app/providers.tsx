'use client'
// ─────────────────────────────────────────────────────────
// Providers globaux — SessionProvider NextAuth + Toasts
// ─────────────────────────────────────────────────────────
import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'
import { ToastProvider } from '@/components/ui/Toast'

type ProvidersProps = {
  children: React.ReactNode
  session?: Session | null
}

export function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </SessionProvider>
  )
}
