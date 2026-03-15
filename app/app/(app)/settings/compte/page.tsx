// ─────────────────────────────────────────────────────────
// /settings/compte — Paramètres compte utilisateur (tous les rôles)
// doc/04-pages-interfaces-ux.md · doc/23-architecture-technique.md
// ─────────────────────────────────────────────────────────
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import CompteSettingsClient from './CompteSettingsClient'

export default async function CompteSettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      timezone: true,
      emailPreferences: true,
      icalToken: true,
    },
  })

  if (!user) redirect('/login')

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const icalUrl = user.icalToken ? `${baseUrl}/api/ical/${user.icalToken}` : null

  return (
    <CompteSettingsClient
      user={{
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        timezone: user.timezone ?? 'Europe/Paris',
        emailPreferences: (user.emailPreferences as Record<string, boolean>) ?? {},
      }}
      icalUrl={icalUrl}
    />
  )
}
