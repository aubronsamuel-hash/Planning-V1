// ─────────────────────────────────────────────────────────
// Helpers d'autorisation — doc/23-architecture-technique.md §23.1
// ─────────────────────────────────────────────────────────
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { OrganizationRole } from '@prisma/client'

// ── requireSession ─────────────────────────────────────────
export async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Non authentifié', code: 'UNAUTHORIZED' }, { status: 401 }),
    }
  }
  return { session, error: null }
}

// ── requireOrgSession ──────────────────────────────────────
type OrgSessionOptions = {
  minRole?: OrganizationRole
  write?: boolean // true = écriture → bloque si org.isReadOnly
}

// Hiérarchie des rôles org : DIRECTEUR > REGISSEUR > RH > COLLABORATEUR
const ROLE_HIERARCHY: OrganizationRole[] = ['DIRECTEUR', 'REGISSEUR', 'RH', 'COLLABORATEUR']

function hasMinRole(actual: OrganizationRole | null, min: OrganizationRole): boolean {
  if (!actual) return false
  return ROLE_HIERARCHY.indexOf(actual) <= ROLE_HIERARCHY.indexOf(min)
}

export async function requireOrgSession(options?: OrganizationRole | OrgSessionOptions) {
  const opts: OrgSessionOptions =
    typeof options === 'string' ? { minRole: options } : (options ?? {})

  const { session, error } = await requireSession()
  if (error) return { session: null, error }

  if (!session!.user.organizationId) {
    return {
      session: null,
      error: NextResponse.json(
        { error: 'Contexte organisation manquant', code: 'FORBIDDEN' },
        { status: 403 }
      ),
    }
  }

  if (opts.minRole && !hasMinRole(session!.user.organizationRole, opts.minRole)) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Droits insuffisants', code: 'FORBIDDEN' }, { status: 403 }),
    }
  }

  // Vérification statut de l'organisation (suspension + isReadOnly)
  const org = await prisma.organization.findUnique({
    where: { id: session!.user.organizationId },
    select: { suspendedAt: true, isReadOnly: true },
  })

  if (!org) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Organisation introuvable', code: 'FORBIDDEN' }, { status: 403 }),
    }
  }

  if (org.suspendedAt) {
    return {
      session: null,
      error: NextResponse.json(
        { error: 'Organisation suspendue — contactez le support', code: 'ORG_SUSPENDED' },
        { status: 403 }
      ),
    }
  }

  if (opts.write && org.isReadOnly) {
    return {
      session: null,
      error: NextResponse.json(
        { error: 'Organisation en lecture seule — abonnement requis', code: 'ORG_READ_ONLY' },
        { status: 403 }
      ),
    }
  }

  return { session: session!, error: null }
}

// ── requireSuperAdmin ──────────────────────────────────────
export async function requireSuperAdmin() {
  const { session, error } = await requireSession()
  if (error) return { session: null, error }

  if (session!.user.role !== 'SUPER_ADMIN') {
    return {
      session: null,
      error: NextResponse.json({ error: 'Accès réservé au SUPER_ADMIN', code: 'FORBIDDEN' }, { status: 403 }),
    }
  }

  return { session: session!, error: null }
}

// ── verifyOwnership — garde anti-IDOR ─────────────────────
// Vérifie que la ressource appartient bien à l'org de la session
export function verifyOwnership(entityOrgId: string, sessionOrgId: string): NextResponse | null {
  if (entityOrgId !== sessionOrgId) {
    return NextResponse.json({ error: 'Accès refusé', code: 'FORBIDDEN' }, { status: 403 })
  }
  return null
}

// ── getUserContext — helpers chef de poste ─────────────────
export function canAffecter(session: { user: { organizationRole: string | null; chefEquipes: string[] } }, equipeId?: string): boolean {
  const { organizationRole, chefEquipes } = session.user
  if (['DIRECTEUR', 'REGISSEUR'].includes(organizationRole ?? '')) return true
  if (equipeId && chefEquipes.includes(equipeId)) return true
  return false
}

export function canVoirRH(session: { user: { organizationRole: string | null } }): boolean {
  return ['DIRECTEUR', 'RH'].includes(session.user.organizationRole ?? '')
}

export function canVoirTousLesProjets(session: { user: { organizationRole: string | null } }): boolean {
  return ['DIRECTEUR', 'RH'].includes(session.user.organizationRole ?? '')
}

export function isChefOn(session: { user: { chefEquipes: string[] } }, equipeId: string): boolean {
  return session.user.chefEquipes.includes(equipeId)
}
