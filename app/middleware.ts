// ─────────────────────────────────────────────────────────
// Middleware Next.js — protection des routes authentifiées
// doc/23-architecture-technique.md §23.1
// ─────────────────────────────────────────────────────────
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default withAuth(
  function middleware(req: NextRequest & { nextauth: { token: any } }) {
    const { token } = req.nextauth
    const { pathname } = req.nextUrl

    // Transmettre le pathname au layout via un header custom
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-pathname', pathname)

    // SUPER_ADMIN → uniquement /admin/*
    if (token?.role === 'SUPER_ADMIN' && !pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/admin', req.url))
    }

    // Routes /admin → réservées SUPER_ADMIN uniquement
    if (pathname.startsWith('/admin') && token?.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Wizard onboarding — forcer si non terminé (sauf /onboarding lui-même)
    if (
      token?.organizationId &&
      !pathname.startsWith('/onboarding') &&
      !pathname.startsWith('/api') &&
      !pathname.startsWith('/admin')
    ) {
      // La vérification onboardingCompletedAt est faite dans le layout (côté serveur)
      // pour éviter une requête DB dans le middleware Edge
    }

    return NextResponse.next({ request: { headers: requestHeaders } })
  },
  {
    callbacks: {
      // Laisse passer si le token existe (authentifié)
      authorized: ({ token }) => !!token,
    },
  }
)

// Protéger toutes les routes sauf les pages publiques et les assets
export const config = {
  matcher: [
    // Exclure :
    // - assets Next.js
    // - pages publiques : login, signup, affectation/[token]/confirmer, mon-planning/view, documents/view
    // - API publiques : auth (magic-link, signup), affectations/confirmer, planning/view, documents/view
    '/((?!_next/static|_next/image|favicon.ico|login|signup|affectation|mon-planning/view|documents/view|api/auth/signup|api/auth/magic-link|api/affectations/confirmer|api/planning/view|api/documents/view).*)',
  ],
}
