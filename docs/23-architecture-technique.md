# 🏗️ Architecture Technique
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale
>
> Décisions transverses qui s'appliquent à toute la codebase — à lire avant de commencer à coder n'importe quel module.

---

## 23.1 Contexte de session multi-organisation

### Le problème

Un `User` peut appartenir à plusieurs organisations (un régisseur freelance qui travaille pour deux théâtres). Chaque appel API doit savoir dans quel contexte organisationnel il opère.

### Décision : `organizationId` dans le token JWT

Le token de session NextAuth contient l'`organizationId` actif en plus du `userId` :

```typescript
// types/next-auth.d.ts
import { OrganizationPlan } from '@prisma/client'

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole               // SUPER_ADMIN | MEMBER (plateforme)
      organizationId: string | null  // null pour les SUPER_ADMIN ou avant sélection org
      organizationRole: OrganizationRole | null // DIRECTEUR | REGISSEUR | RH | COLLABORATEUR
      organizationPlan: OrganizationPlan | null // FREE | PRO | ENTERPRISE — null hors contexte org
    }
  }
  interface JWT {
    userId: string
    role: UserRole
    organizationId: string | null
    organizationRole: OrganizationRole | null
    organizationPlan: OrganizationPlan | null
  }
}
```

### Enrichissement du token (callbacks NextAuth)

```typescript
// app/api/auth/[...nextauth]/route.ts — callbacks
callbacks: {
  async jwt({ token, user, trigger, session }) {
    // À la connexion — charger le contexte org par défaut
    if (user) {
      token.userId = user.id
      token.role = user.role
      // Chercher la première org active de l'utilisateur + plan en une seule requête
      const membership = await prisma.organizationMembership.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
        include: { organization: { select: { plan: true } } }
      })
      token.organizationId = membership?.organizationId ?? null
      token.organizationRole = membership?.role ?? null
      token.organizationPlan = membership?.organization.plan ?? null
    }
    // Changement d'org volontaire via /api/auth/switch-org
    if (trigger === 'update' && session?.organizationId) {
      token.organizationId = session.organizationId
      const membership = await prisma.organizationMembership.findUnique({
        where: { userId_organizationId: { userId: token.userId, organizationId: session.organizationId } },
        include: { organization: { select: { plan: true } } }
      })
      token.organizationRole = membership?.role ?? null
      token.organizationPlan = membership?.organization.plan ?? null
    }
    return token
  },
  async session({ session, token }) {
    session.user.id = token.userId
    session.user.role = token.role
    session.user.organizationId = token.organizationId
    session.user.organizationRole = token.organizationRole
    session.user.organizationPlan = token.organizationPlan
    return session
  }
}
```

### Changement d'organisation (multi-org)

```
POST /api/auth/switch-org
  body: { organizationId: string }

  → Vérifier que l'userId courant a bien un OrganizationMembership sur cet organizationId
  → Si oui : update({ trigger: 'update', session: { organizationId } })
  → Redirection vers /dashboard (nouveau contexte org)
  → Si non : 403 Forbidden
```

Le sélecteur d'organisation est affiché dans la sidebar si `user.memberships.length > 1`.

### Accès SUPER_ADMIN

Les SUPER_ADMIN (`User.role = SUPER_ADMIN`) ont `organizationId = null` en session. Ils accèdent à `/admin/*` uniquement. Toute tentative d'accès à une route `/api/projets`, `/api/affectations` etc. avec `organizationId = null` retourne `403`.

### Helper serveur — à utiliser dans chaque route

```typescript
// lib/auth.ts
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import type { OrganizationRole } from "@prisma/client"

export async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session) return { session: null, error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) }
  return { session, error: null }
}

type OrgSessionOptions = {
  minRole?: OrganizationRole
  write?: boolean  // true = opération en écriture → bloque si org.isReadOnly
}

// ⚠️ Signature : accepte OrganizationRole (string) ou OrgSessionOptions (objet)
// La forme string est dépréciée — préférer toujours l'objet : requireOrgSession({ minRole: 'REGISSEUR' })
export async function requireOrgSession(options?: OrganizationRole | OrgSessionOptions) {
  const opts: OrgSessionOptions = typeof options === 'string' ? { minRole: options } : (options ?? {})

  const { session, error } = await requireSession()
  if (error) return { session: null, error }

  if (!session!.user.organizationId) {
    return { session: null, error: NextResponse.json({ error: "Contexte organisation manquant" }, { status: 403 }) }
  }

  // Vérification de rôle minimum si précisé
  if (opts.minRole && !hasMinRole(session!.user.organizationRole, opts.minRole)) {
    return { session: null, error: NextResponse.json({ error: "Droits insuffisants" }, { status: 403 }) }
  }

  // Vérification statut de l'organisation — fetch léger (2 champs)
  const org = await prisma.organization.findUnique({
    where: { id: session!.user.organizationId },
    select: { suspendedAt: true, isReadOnly: true }
  })
  if (!org) {
    return { session: null, error: NextResponse.json({ error: "Organisation introuvable" }, { status: 403 }) }
  }
  if (org.suspendedAt) {
    return { session: null, error: NextResponse.json(
      { error: "Organisation suspendue — contactez le support", code: "ORG_SUSPENDED" },
      { status: 403 }
    )}
  }
  if (opts.write && org.isReadOnly) {
    return { session: null, error: NextResponse.json(
      { error: "Organisation en lecture seule — abonnement requis", code: "ORG_READ_ONLY" },
      { status: 403 }
    )}
  }

  return { session, error: null }
}

// Hiérarchie des rôles : DIRECTEUR > REGISSEUR > RH > COLLABORATEUR
const ROLE_HIERARCHY: OrganizationRole[] = ['DIRECTEUR', 'REGISSEUR', 'RH', 'COLLABORATEUR']
function hasMinRole(actual: OrganizationRole | null, min: OrganizationRole): boolean {
  if (!actual) return false
  return ROLE_HIERARCHY.indexOf(actual) <= ROLE_HIERARCHY.indexOf(min)
}

/**
 * Protection anti-IDOR — vérifie que la ressource appartient à l'organisation
 * de la session courante. Empêche un utilisateur de l'org A d'accéder aux
 * données de l'org B en devinant un ID.
 *
 * @param entityOrgId  organizationId stocké sur la ressource en base
 * @param sessionOrgId session.user.organizationId de l'appelant
 * @returns NextResponse 403 si cross-tenant, null si accès autorisé
 *
 * Usage :
 *   const projet = await prisma.projet.findFirst({ where: { id } })
 *   if (!projet) return notFound('Projet')
 *   const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
 *   if (ownershipError) return ownershipError
 */
export function verifyOwnership(entityOrgId: string, sessionOrgId: string): NextResponse | null {
  if (entityOrgId !== sessionOrgId) {
    return NextResponse.json(
      { error: "Accès refusé", code: "FORBIDDEN" },
      { status: 403 }
    )
  }
  return null
}
```

**Usage dans une route :**

```typescript
// app/api/projets/route.ts — GET (lecture seule)
export async function GET(req: Request) {
  const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR' })
  if (error) return error

  const projets = await prisma.projet.findMany({
    where: { organizationId: session.user.organizationId! }
    // deletedAt: null → injecté automatiquement par la Prisma Extension (§23.2)
  })
  return NextResponse.json(projets)
}

// app/api/projets/route.ts — POST (écriture) : ajouter write: true
export async function POST(req: Request) {
  const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
  if (error) return error  // retourne 403 ORG_SUSPENDED ou ORG_READ_ONLY si nécessaire
  // ...
}

// app/api/projets/[id]/route.ts — PATCH : vérifier aussi l'ownership anti-IDOR
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
  if (error) return error

  const projet = await prisma.projet.findFirst({ where: { id: params.id } })
  if (!projet) return notFound('Projet')

  // Anti-IDOR : s'assurer que le projet appartient bien à l'org de la session
  const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
  if (ownershipError) return ownershipError

  // ...traitement métier...
}
```

---

## 23.2 Soft delete — stratégie et middleware Prisma

### Le problème

Toutes les requêtes sur `Projet`, `Representation`, `Affectation` et `Document` doivent filtrer `WHERE deletedAt IS NULL`. Un oubli = fuite de données supprimées vers le client.

### Décision : Prisma Client Extension (pas de middleware legacy)

On utilise une **Prisma Client Extension** (API moderne, Prisma 5+) qui injecte automatiquement `deletedAt: null` sur les opérations `findMany`, `findFirst`, `findUnique`, `count` des modèles concernés.

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const SOFT_DELETE_MODELS = ['Projet', 'Representation', 'Affectation', 'Document'] as const

const prismaBase = new PrismaClient()

export const prisma = prismaBase.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        if (SOFT_DELETE_MODELS.includes(model as any)) {
          args.where = { ...args.where, deletedAt: null }
        }
        return query(args)
      },
      async findFirst({ model, args, query }) {
        if (SOFT_DELETE_MODELS.includes(model as any)) {
          args.where = { ...args.where, deletedAt: null }
        }
        return query(args)
      },
      // ⚠️ findUnique intentionnellement NON intercepté :
      // Ajouter deletedAt: null à un where { id } plante Prisma en runtime car
      // deletedAt ne fait pas partie de la contrainte unique.
      // RÈGLE : ne jamais utiliser findUnique sur les modèles soft-deletables.
      // Toujours utiliser findFirst({ where: { id, deletedAt: null } }) à la place.
      //
      // Mauvais :  prisma.projet.findUnique({ where: { id } })
      // Correct :  prisma.projet.findFirst({ where: { id } })  ← deletedAt injecté par l'extension
      async count({ model, args, query }) {
        if (SOFT_DELETE_MODELS.includes(model as any)) {
          args.where = { ...args.where, deletedAt: null }
        }
        return query(args)
      }
    }
  }
})
```

### Contournement intentionnel

Pour accéder aux entités supprimées (ex: historique admin, audit), utiliser `prismaBase` directement :

```typescript
import { prismaBase } from '@/lib/prisma'  // ← expose aussi prismaBase pour ces cas

// Uniquement pour le back-office SUPER_ADMIN ou l'historique RH
const toutesAffectations = await prismaBase.affectation.findMany({
  where: { collaborateurId: id }  // inclut les soft-deleted
})
```

### Suppression logique (soft delete)

```typescript
// Jamais prisma.projet.delete() pour les entités soft-deletable
// Toujours :
await prisma.projet.update({
  where: { id: projetId },
  data: { deletedAt: new Date() }
})
```

⚠️ `prisma.projet.delete()` ne doit pas être utilisé sur les modèles soft-deletable. Ajouter une règle ESLint custom si possible (plugin `eslint-plugin-prisma`).

---

## 23.3 Format d'erreur API unifié

### Convention de réponse

Toutes les routes API retournent les erreurs dans le même format :

```typescript
// types/api.ts
export type ApiError = {
  error: string        // message lisible (affiché à l'utilisateur)
  code?: string        // code machine (pour le front)
  details?: unknown    // données supplémentaires (validation Zod, etc.)
}

export type ApiResponse<T> = T | ApiError
```

### Codes d'erreur standards

| Code | HTTP | Description | Usage |
|------|------|-------------|-------|
| `UNAUTHORIZED` | 401 | Non authentifié | Session manquante ou expirée |
| `FORBIDDEN` | 403 | Droits insuffisants | Rôle trop bas, mauvaise org |
| `NOT_FOUND` | 404 | Ressource introuvable | ID inexistant ou soft-deleted |
| `VALIDATION_ERROR` | 422 | Données invalides | Erreur Zod / contrainte métier |
| `QUOTA_EXCEEDED` | 403 | Quota plan dépassé | Limite FREE, PRO atteinte |
| `CONFLICT` | 409 | Conflit planning | Double affectation, créneau occupé |
| `STRIPE_ERROR` | 502 | Erreur Stripe upstream | Paiement, customer creation |
| `INTERNAL_ERROR` | 500 | Erreur serveur | Non anticipée |

### Helper de réponse

```typescript
// lib/api-response.ts
import { NextResponse } from 'next/server'
import { ApiError } from '@/types/api'

export const apiError = (
  code: ApiError['code'],
  message: string,
  status: number,
  details?: unknown
) => NextResponse.json<ApiError>({ error: message, code, details }, { status })

// Raccourcis
export const unauthorized = () => apiError('UNAUTHORIZED', 'Non authentifié', 401)
export const forbidden = (msg = 'Droits insuffisants') => apiError('FORBIDDEN', msg, 403)
export const notFound = (entity = 'Ressource') => apiError('NOT_FOUND', `${entity} introuvable`, 404)
export const validationError = (details: unknown) => apiError('VALIDATION_ERROR', 'Données invalides', 422, details)
export const quotaExceeded = (msg: string) => apiError('QUOTA_EXCEEDED', msg, 403)
export const conflict = (msg: string) => apiError('CONFLICT', msg, 409)
export const internalError = () => apiError('INTERNAL_ERROR', 'Erreur serveur', 500)
```

### Validation des inputs — Zod obligatoire

```typescript
// Chaque route qui reçoit un body valide avec Zod avant tout traitement
import { z } from 'zod'
import { validationError } from '@/lib/api-response'

const CreateProjetSchema = z.object({
  titre: z.string().min(1).max(100),
  type: z.enum(['THEATRE', 'CONCERT', ...]),
  dateDebut: z.string().datetime().optional(),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = CreateProjetSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())
  // ...
}
```

### Gestion des erreurs inattendues

```typescript
// app/api/[...]/route.ts — pattern standard
export async function POST(req: Request) {
  try {
    // ... logique métier
  } catch (err) {
    console.error('[POST /api/projets]', err)
    return internalError()
    // Ne jamais exposer le stack trace en production
  }
}
```

---

## 23.4 lib/plans.ts — Source de vérité des quotas

### Le problème

Les limites de plan (3 collabs FREE, 20 PRO, illimité ENTERPRISE) étaient définies "en config serveur" sans préciser où. Chaque route qui doit vérifier les quotas doit les trouver au même endroit.

### Structure du fichier

```typescript
// lib/plans.ts

import { OrganizationPlan } from '@prisma/client'

export type PlanLimits = {
  maxCollaborateurs: number  // -1 = illimité
  maxProjetsActifs: number   // -1 = illimité
  maxStorageBytes: number    // stockage total documents S3
  features: {
    dpae: boolean                // accès module DPAE
    remplacementUrgent: boolean  // workflow remplacement urgent
    templates: boolean           // templates de projets
    feuilleDeRoute: boolean      // compagnon logistique
    moduleTournee: boolean       // hébergement + flotte
    exportCsv: boolean           // export paie CSV
    multiRegisseur: boolean      // plusieurs régisseurs par projet
  }
}

export const PLAN_LIMITS: Record<OrganizationPlan, PlanLimits> = {
  FREE: {
    maxCollaborateurs: 3,
    maxProjetsActifs: 1,
    maxStorageBytes: 500 * 1024 * 1024,  // 500 Mo
    features: {
      dpae: false,
      remplacementUrgent: false,
      templates: false,
      feuilleDeRoute: false,
      moduleTournee: false,
      exportCsv: false,
      multiRegisseur: false,
    }
  },
  PRO: {
    maxCollaborateurs: 20,
    maxProjetsActifs: -1,
    maxStorageBytes: 5 * 1024 * 1024 * 1024,  // 5 Go
    features: {
      dpae: true,
      remplacementUrgent: true,
      templates: true,
      feuilleDeRoute: true,
      moduleTournee: false,
      exportCsv: true,
      multiRegisseur: true,
    }
  },
  ENTERPRISE: {
    maxCollaborateurs: -1,
    maxProjetsActifs: -1,
    maxStorageBytes: 50 * 1024 * 1024 * 1024,  // 50 Go
    features: {
      dpae: true,
      remplacementUrgent: true,
      templates: true,
      feuilleDeRoute: true,
      moduleTournee: true,
      exportCsv: true,
      multiRegisseur: true,
    }
  }
}

// Helpers

export function getPlanLimits(plan: OrganizationPlan): PlanLimits {
  return PLAN_LIMITS[plan]
}

export function canAddCollaborateur(plan: OrganizationPlan, currentCount: number): boolean {
  const limits = PLAN_LIMITS[plan]
  if (limits.maxCollaborateurs === -1) return true
  return currentCount < limits.maxCollaborateurs
}

// activeCount = projets avec status EN_PREPARATION | EN_COURS uniquement
// Ne pas inclure TERMINE | ARCHIVE | ANNULE dans le comptage
export function canAddProjet(plan: OrganizationPlan, activeCount: number): boolean {
  const limits = PLAN_LIMITS[plan]
  if (limits.maxProjetsActifs === -1) return true
  return activeCount < limits.maxProjetsActifs
}

export function hasFeature(plan: OrganizationPlan, feature: keyof PlanLimits['features']): boolean {
  return PLAN_LIMITS[plan].features[feature]
}

// currentStorageBytes = SUM(sizeBytes) WHERE deletedAt IS NULL uniquement
// Les documents soft-deleted ne comptent pas dans le quota (cohérence UX)
export function canUploadDocument(plan: OrganizationPlan, currentStorageBytes: number, fileSizeBytes: number): boolean {
  const limits = PLAN_LIMITS[plan]
  return currentStorageBytes + fileSizeBytes <= limits.maxStorageBytes
}
```

### Usage dans les routes

```typescript
// Exemple : POST /api/membres — ajouter un collaborateur
import { canAddCollaborateur } from '@/lib/plans'
import { quotaExceeded } from '@/lib/api-response'

const org = await prisma.organization.findUnique({ where: { id: organizationId } })
const currentCount = await prisma.organizationMembership.count({
  where: { organizationId, role: 'COLLABORATEUR' }
})

if (!canAddCollaborateur(org.plan, currentCount)) {
  return quotaExceeded(
    `Limite de ${PLAN_LIMITS[org.plan].maxCollaborateurs} collaborateurs atteinte pour le plan ${org.plan}.`
  )
}
```

### Features gates côté UI

```typescript
// hooks/useFeature.ts (client)
import { PLAN_LIMITS } from '@/lib/plans'
import { useSession } from 'next-auth/react'

export function useFeature(feature: keyof PlanLimits['features']): boolean {
  const { data: session } = useSession()
  const plan = session?.user?.organizationPlan  // ← ajouter organizationPlan au JWT
  if (!plan) return false
  return PLAN_LIMITS[plan].features[feature]
}

// Usage dans un composant
const canUseTournee = useFeature('moduleTournee')
// <button disabled={!canUseTournee}>Module Tournée</button>
```

✅ `organizationPlan` est inclus dans le JWT NextAuth (§23.1) — `useFeature` fonctionne côté client sans appel API supplémentaire.

⚠️ **Plan stale dans le JWT :** `organizationPlan` n'est mis à jour dans le JWT qu'à la connexion ou lors d'un `switch-org`. Si le plan change entre deux sessions (upgrade Stripe, intervention SUPER_ADMIN), le JWT peut afficher des features incorrectes jusqu'au prochain refresh.

**Règle :** `useFeature` = cache UI uniquement. Toutes les vérifications de quotas **côté serveur** utilisent toujours `org.plan` récupéré depuis la DB — jamais `session.user.organizationPlan`.

```typescript
// ✅ Correct côté serveur — toujours depuis la DB
const org = await prisma.organization.findFirst({ where: { id: session.user.organizationId! } })
if (!hasFeature(org.plan, 'dpae')) return forbidden('Feature non disponible sur ce plan')

// ❌ Ne jamais faire côté serveur
if (!hasFeature(session.user.organizationPlan!, 'dpae')) ...  // plan potentiellement stale
```

---

## 23.5 Conventions de nommage et structure des routes

### Structure des dossiers API

```
app/
├── api/
│   ├── auth/
│   │   └── [...nextauth]/route.ts       ← NextAuth
│   ├── webhooks/
│   │   └── stripe/route.ts              ← Stripe (RAW body, pas de auth session)
│   ├── projets/
│   │   ├── route.ts                     ← GET (liste) + POST (créer)
│   │   └── [id]/
│   │       ├── route.ts                 ← GET + PATCH + DELETE (soft)
│   │       ├── representations/
│   │       │   ├── route.ts
│   │       │   └── [repId]/route.ts
│   │       └── annulations/route.ts
│   ├── affectations/
│   │   └── [id]/
│   │       ├── confirmer/route.ts       ← POST (magic link handler)
│   │       └── annuler/route.ts         ← POST
│   ├── feuille-de-route/
│   │   └── [id]/
│   │       ├── route.ts
│   │       ├── publier/route.ts
│   │       └── copier-depuis/route.ts
│   ├── notifications/route.ts
│   ├── planning/
│   │   └── [projetId]/stream/route.ts   ← SSE
│   └── admin/                           ← SUPER_ADMIN uniquement
│       ├── organisations/route.ts
│       └── stats/route.ts
```

### Convention des méthodes HTTP

| Action | Méthode | Exemple |
|--------|---------|---------|
| Lister | GET | `GET /api/projets` |
| Créer | POST | `POST /api/projets` |
| Lire un | GET | `GET /api/projets/[id]` |
| Modifier (partiel) | PATCH | `PATCH /api/projets/[id]` |
| Supprimer (soft) | DELETE | `DELETE /api/projets/[id]` |
| Action métier | POST | `POST /api/affectations/[id]/confirmer` |

---

## 23.6 SSE — Format des événements temps réel

Le stream SSE `/api/planning/[projetId]/stream` envoie des événements structurés.

### Format de l'événement

```
event: affectation_updated
data: {"type":"affectation_updated","payload":{"affectationId":"clx...","confirmationStatus":"CONFIRMEE","representationId":"clx...","posteRequisId":"clx..."}}

event: poste_alert
data: {"type":"poste_alert","payload":{"representationId":"clx...","severity":"CRITIQUE","message":"Poste Éclairagiste non pourvu J-2"}}

event: ping
data: {"type":"ping"}
```

### Types d'événements SSE

| Type | Déclencheur | Payload |
|------|-------------|---------|
| `affectation_updated` | Confirmation / refus / annulation | `affectationId`, `confirmationStatus` |
| `affectation_created` | Nouvelle affectation ajoutée | `affectationId`, `representationId` |
| `poste_alert` | Poste non pourvu détecté | `representationId`, `severity`, `message` |
| `representation_updated` | Annulation / report d'une représentation | `representationId`, `status` |
| `fdr_published` | Feuille de route publiée | `feuilleDeRouteId`, `representationId` |
| `ping` | Keepalive toutes les 25s | — |

### Implémentation serveur

```typescript
// app/api/planning/[projetId]/stream/route.ts
export async function GET(req: Request, { params }: { params: { projetId: string } }) {
  const { session, error } = await requireOrgSession()
  if (error) return error

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      // Ping toutes les 25s pour maintenir la connexion
      const ping = setInterval(() => send('ping', { type: 'ping' }), 25_000)

      // Abonnement au bus d'événements
      // Sur Railway : eventBus = module lib/event-bus.ts (EventEmitter Node.js in-process)
      // Exemple minimal : import { eventBus } from '@/lib/event-bus'
      // → eventBus.emit(`planning:${projetId}`, payload) côté mutation API
      // → eventBus.on(`planning:${projetId}`, handler) côté SSE
      // ⚠️ EventEmitter in-process = pas multi-instance. Si plusieurs pods → migrer vers Redis Pub/Sub.
      const unsubscribe = eventBus.subscribe(`planning:${params.projetId}`, (event) => {
        send(event.type, event)
      })

      req.signal.addEventListener('abort', () => {
        clearInterval(ping)
        unsubscribe()
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}
```

⚠️ **Infrastructure SSE :** sur Vercel (serverless), les SSE nécessitent les **Edge Functions** ou **Vercel KV + polling** — les fonctions Lambda classiques ne maintiennent pas de connexions longues. Railway (notre backend) supporte les connexions longues nativement.

---

## 23.7 Upload S3 — Flux et sécurité

### Flux upload (presigned URL)

```
[Client]                          [Serveur]                    [AWS S3]
   |                                  |                            |
   |── POST /api/documents/upload ──→ |                            |
   |   { filename, mimeType, size,    |                            |
   |     entityType, entityId }       |                            |
   |                                  |── Validation ───────────── |
   |                                  |   • mimeType autorisé ?    |
   |                                  |   • taille ≤ max plan ?    |
   |                                  |   • quota storage dépassé ?|
   |                                  |                            |
   |                                  |── s3.getSignedUrl() ──────→|
   |                                  |←── presignedUrl ──────────  |
   |                                  |   (s3Key pré-calculé mais   |
   |                                  |    Document PAS encore en DB)|
   |←── { presignedUrl, s3Key } ─────|                            |
   |                                  |                            |
   |── PUT presignedUrl ─────────────────────────────────────────→ |
   |←── 200 OK ──────────────────────────────────────────────────  |
   |                                  |                            |
   |── POST /api/documents/confirm ─→ |                            |
   |   { s3Key, filename, mimeType,   |                            |
   |     size, entityType, entityId } |                            |
   |                                  |── CREATE Document ─────────|
   |                                  |   (enregistrement en DB    |
   |                                  |    seulement si S3 OK)     |
   |←── { document } ─────────────── |                            |
```

⚠️ **Pas de champ `confirmed` sur `Document`** — le record est créé dans `/confirm` uniquement si l'upload S3 a réussi. Si le client ne rappelle pas `/confirm` (crash, réseau), aucun record orphelin n'est créé en base. Le bucket S3 peut contenir des objets sans Document associé → nettoyage périodique via cron ou S3 lifecycle policy.

### Types MIME autorisés

```typescript
// lib/upload.ts
export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  CONTRAT:   ['application/pdf'],
  FICHE_RH:  ['application/pdf', 'application/msword',
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  PHOTO:     ['image/jpeg', 'image/png', 'image/webp'],
  AUTRE:     ['application/pdf', 'image/jpeg', 'image/png', 'text/plain']
}

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  // 20 Mo par fichier

// Validation côté serveur (avant de générer la presigned URL)
export function validateUpload(mimeType: string, sizeBytes: number, documentType: string): string | null {
  const allowed = ALLOWED_MIME_TYPES[documentType] ?? ALLOWED_MIME_TYPES['AUTRE']
  if (!allowed.includes(mimeType)) return `Type de fichier non autorisé : ${mimeType}`
  if (sizeBytes > MAX_FILE_SIZE_BYTES) return `Fichier trop volumineux (max 20 Mo)`
  return null  // null = valide
}
```

⚠️ La validation du type MIME **doit être faite côté serveur** — le `Content-Type` envoyé par le client est contrôlable et ne suffit pas. S3 peut aussi être configuré avec une policy qui restreint les types autorisés sur le bucket.


---

## 23.8 Intégrations externes

Ce document couvre les patterns d'architecture interne. Les intégrations avec des services tiers ont chacune leur documentation dédiée :

| Service | Rôle | Documentation |
|---------|------|---------------|
| **Stripe** | Abonnements, webhooks paiement/trial/suspension | [18 — Webhooks Stripe](./18-webhooks-stripe.md) |
| **Resend** | Envoi de tous les emails transactionnels | [24 — Templates Email](./24-emails-templates.md) |
| **AWS S3** | Stockage des documents et pièces jointes | §23.7 (ce fichier) + Règle #10 |
| **Vercel Cron** | Jobs planifiés (DPAE, RGPD, relances…) | [21 — Cron Jobs](./21-cron-jobs.md) |

### Point d'attention — Webhooks Stripe

Les webhooks Stripe (`invoice.payment_failed`, `customer.subscription.updated`, etc.) sont le seul moyen pour l'app d'être informée des changements de plan **en dehors** d'une action utilisateur. Ils déclenchent la mise à jour de `Organization.plan`, `Organization.isReadOnly` et `Organization.trialEndsAt`. **Toute logique de plan doit tenir compte de ces webhooks** — voir [`18-webhooks-stripe.md`](./18-webhooks-stripe.md) pour le catalogue complet des événements et leur impact.
