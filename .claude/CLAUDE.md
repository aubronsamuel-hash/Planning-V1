# 🤖 Guide Claude — SaaS Gestion du Spectacle Vivant

> **Version :** 2.0 · **Date :** 14/03/2026 · **Statut :** ✅ Actif

Ce fichier est lu automatiquement par Claude (IA) à chaque session de travail sur ce projet. Il donne le contexte, les conventions et les règles de travail à respecter absolument.

---

## 🎯 Contexte du projet

Un SaaS dédié aux structures du **spectacle vivant** (théâtres, compagnies, producteurs) pour planifier leurs spectacles, gérer leurs équipes artistiques et techniques.

**Stack :** Next.js 14 App Router · TypeScript · Prisma · PostgreSQL · NextAuth · Resend · Stripe · AWS S3 · Vercel + Railway

**Documentation complète :** `docs/README.md` → lire en priorité avant tout travail.

---

## 📚 Lecture obligatoire avant de coder

Dans cet ordre :

1. `docs/23-architecture-technique.md` — patterns transverses, session, guards IDOR
2. `docs/06-regles-decisions.md` — 34 règles métier + 22 décisions techniques **validées**
3. `docs/05-data-models.md` + `docs/15-schema-prisma.md` — structure des données
4. `docs/02-roles-permissions.md` — les 3 niveaux d'autorisation et la matrice complète
5. Le doc spécifique au module en cours de développement

---

## ⚠️ Règles absolues — ne jamais déroger

### Sécurité & Auth
- **Vérifier les 3 niveaux d'auth** sur chaque route API : `User.role` (plateforme) → `OrganizationMembership.role` (org) → `EquipeMembre.role` (équipe)
- **Toujours filtrer par `organizationId`** dans chaque requête Prisma — jamais de données cross-org
- **Soft delete uniquement** : utiliser `deletedAt` + filtrer `WHERE deletedAt IS NULL`, jamais de `DELETE` réel
- **Signed URLs S3** (expiration 1h max) — jamais d'URLs publiques pour les fichiers sensibles
- **Chiffrement AES-256** pour les données sensibles (N° SS, IBAN) — uniquement déchiffrées par le rôle RH

### Métier spectacle
- **Ne jamais bloquer une affectation** en cas de conflit horaire — afficher ⚠️ + poser `hasConflict = true`
- **DPAE** : générer un item "à faire" pour tout intermittent/CDD, sans exception
- **Confirmation atomique** : chaque date confirmée/refusée indépendamment, effet immédiat
- **iCal** : exporter uniquement les affectations au statut `CONFIRMEE`
- **Annulation d'une représentation** : notifier TOUS les collaborateurs affectés (y compris EN_ATTENTE et REFUSEE)

### Quotas & Plans
- **Bloquer proprement** (message + lien `/settings/organisation#facturation`) si quota dépassé
- **Ne jamais supprimer de données** pour respecter un quota
- **isReadOnly** : vérifier ce flag avant toute écriture si trial expiré ou paiement échoué

---

## 🏗️ Structure réelle du projet

```
app/                           # Racine Next.js App Router
├── api/                       # Routes API (Route Handlers)
│   ├── admin/                 # Routes back-office super-admin
│   ├── affectations/          # Gestion des affectations
│   ├── auth/[...nextauth]/    # NextAuth + switch-org
│   ├── billing/               # Intégration Stripe
│   ├── collaborateurs/        # Profils collaborateurs
│   ├── documents/             # Upload S3 + signed URLs
│   ├── feuille-de-route/      # Fiches logistiques
│   ├── hebergements/          # Hébergements (module Tournée)
│   ├── ical/                  # Export iCal
│   ├── notifications/         # Fetch + mark-read
│   ├── onboarding/            # Wizard inscription
│   ├── organisations/         # Paramètres organisation
│   ├── planning/              # Grille planning + SSE
│   ├── projets/               # CRUD projets
│   ├── remplacements/         # Remplacements urgents
│   ├── representations/       # Dates de spectacle
│   ├── rh/                    # Paie, DPAE (rôle RH)
│   ├── settings/              # Paramètres utilisateur
│   ├── templates/             # Templates projet (PRO+)
│   ├── vehicules/             # Flotte (module Tournée)
│   └── webhooks/stripe/       # Events Stripe
├── (app)/                     # Pages authentifiées (layout sidebar)
│   ├── dashboard/
│   ├── equipe/[id]/
│   ├── mon-equipe/
│   ├── mon-planning/
│   ├── notifications/
│   ├── onboarding/
│   ├── planning/
│   ├── projets/[id]/
│   ├── rh/
│   ├── settings/              # compte + organisation
│   └── templates/
├── (public)/                  # Pages publiques sans auth
│   ├── affectation/[token]/   # Confirmation magic link (7j)
│   ├── documents/view/        # Téléchargement document (1h)
│   ├── login/                 # Login + verify magic link
│   ├── mon-planning/view/     # Vue planning (7j)
│   ├── remplacement/[token]/  # Proposition remplacement (4h)
│   └── signup/
└── admin/                     # Super-admin (User.role = SUPER_ADMIN)

lib/
├── auth.ts                    # requireSession, requireOrgSession, verifyOwnership, canAffecter…
├── plans.ts                   # Limites FREE/PRO/ENTERPRISE + feature gates
├── email.ts                   # Wrapper Resend + 16 templates HTML
├── notifications.ts           # Constantes NOTIFICATION_CHANNELS (client-safe)
├── notifications.server.ts    # createInAppNotification, broadcastNotification (server-only)
├── conflicts.ts               # Détection conflits horaires (cross-projet, cross-minuit)
├── crypto.ts                  # AES-256 encrypt/decrypt
├── prisma.ts                  # Singleton PrismaClient
├── upload.ts                  # S3 upload + generateSignedUrl
├── api-response.ts            # Helpers d'erreur unifiés (unauthorized, forbidden…)
├── event-bus.ts               # Émission d'événements SSE
└── slug.ts                    # Génération de slugs URL

prisma/
├── schema.prisma              # Source de vérité — 964 lignes, 30+ modèles
├── seed.ts                    # Données de démonstration
└── migrations/                # Migrations Prisma

types/
├── next-auth.d.ts             # Augmentation session NextAuth
└── api.ts                     # Types ApiError, ApiResponse
```

---

## 🔑 Modèle de données — entités clés

### Enums principaux

```typescript
// Rôles plateforme
UserRole: SUPER_ADMIN | MEMBER

// Rôles organisation
OrganizationRole: DIRECTEUR | REGISSEUR | RH | COLLABORATEUR

// Rôle équipe
EquipeRole: CHEF | MEMBRE

// Statut compte collaborateur
AccountStatus: GHOST | ACTIVE | INACTIF

// Statut confirmation affectation
ConfirmationStatus: EN_ATTENTE | CONFIRMEE | REFUSEE | NON_REQUISE | ANNULEE | ANNULEE_TARDIVE

// Statut DPAE
DpaeStatus: A_FAIRE | ENVOYEE | CONFIRMEE | NON_REQUISE

// Type contrat
ContractType: CDI | CDD | INTERMITTENT

// Plans tarifaires
OrganizationPlan: FREE | PRO | ENTERPRISE
```

### Modèles Prisma essentiels

| Modèle | Rôle |
|--------|------|
| `User` | Compte utilisateur (role: SUPER_ADMIN \| MEMBER) |
| `Organization` | Entité multi-tenant (plan, billing, trial, suspension) |
| `OrganizationMembership` | Lien User ↔ Organization avec rôle |
| `Collaborateur` | Profil portable (GHOST/ACTIVE, compétences, contrat) |
| `Projet` | Spectacle ou production |
| `Representation` | Date unique d'un projet (jour + lieu + créneaux) |
| `Equipe` | Équipe attachée à un projet |
| `EquipeMembre` | Lien Collaborateur ↔ Equipe avec rôle (CHEF/MEMBRE) |
| `Affectation` | Assignation collaborateur → représentation + poste |
| `MagicLinkToken` | Token signé pour accès sans mot de passe |
| `Notification` | In-app, lue/non-lue |
| `ActivityLog` | Audit trail des actions |
| `Document` | Fichier S3 avec entité polymorphique |
| `ProjetTemplate` | Template réutilisable (PRO+) |
| `PropositionRemplacement` | Remplacement urgent |
| `FeuilleDeRoute` | Fiche logistique par représentation |
| `Hebergement` / `Vehicule` | Module Tournée (ENTERPRISE) |

---

## 🔐 Authentification & autorisation

### Fonctions helpers — `lib/auth.ts`

```typescript
// Authentification basique (401 si absent)
requireSession(): Promise<{ session, error? }>

// Authentification + contexte org (role minimum optionnel)
requireOrgSession(
  minRole?: OrganizationRole,
  options?: { write?: boolean }  // bloque si org suspendue/read-only
): Promise<{ session, error? }>

// Super-admin uniquement
requireSuperAdmin(): Promise<{ session, error? }>

// Guard IDOR — 403 si cross-org
verifyOwnership(entityOrgId: string, sessionOrgId: string): Response | null

// Helpers de permission
canAffecter(session, equipeId?): boolean
canVoirRH(session): boolean
canVoirTousLesProjets(session): boolean
isChefOn(session, equipeId): boolean
```

### Hiérarchie des rôles

```
User.role (SUPER_ADMIN | MEMBER)
  └─ OrganizationMembership.role (DIRECTEUR > REGISSEUR > RH > COLLABORATEUR)
       └─ EquipeMembre.role (CHEF > MEMBRE)
```

---

## 🏭 Patterns API

### Pattern GET standard

```typescript
export async function GET(req: Request) {
  const { session, error } = await requireOrgSession()
  if (error) return error

  const data = await prisma.projet.findMany({
    where: {
      organizationId: session.user.organizationId!,  // ← TOUJOURS
      deletedAt: null,                                // ← TOUJOURS
    }
  })
  return Response.json(data)
}
```

### Pattern POST avec quota

```typescript
export async function POST(req: Request) {
  const { session, error } = await requireOrgSession('REGISSEUR', { write: true })
  if (error) return error

  // Validation Zod
  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.errors)

  // Vérification quota
  const count = await prisma.projet.count({
    where: { organizationId: session.user.organizationId!, deletedAt: null }
  })
  if (!canAddProjet(session.user.organizationPlan!, count)) {
    return quotaExceeded(quotaMessage(session.user.organizationPlan!, 'projet'))
  }

  const item = await prisma.projet.create({
    data: { ...parsed.data, organizationId: session.user.organizationId! }
  })

  // Audit
  await prisma.activityLog.create({ data: { ... } })
  // Notifications
  await createInAppNotification({ ... })

  return Response.json(item, { status: 201 })
}
```

### Pattern PATCH avec guard IDOR

```typescript
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireOrgSession('REGISSEUR', { write: true })
  if (error) return error

  const existing = await prisma.projet.findUnique({ where: { id: params.id } })
  if (!existing || existing.deletedAt) return notFound('Projet')

  // Guard IDOR
  const ownershipError = verifyOwnership(existing.organizationId, session.user.organizationId!)
  if (ownershipError) return ownershipError

  const updated = await prisma.projet.update({
    where: { id: params.id },
    data: { ...parsed.data }
  })
  return Response.json(updated)
}
```

### Helpers `lib/api-response.ts`

```typescript
// Codes d'erreur typés
type ErrorCode =
  | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND'
  | 'VALIDATION_ERROR' | 'QUOTA_EXCEEDED' | 'CONFLICT'
  | 'ORG_SUSPENDED' | 'ORG_READ_ONLY'
  | 'STRIPE_ERROR' | 'INTERNAL_ERROR'

// Fonctions factory
unauthorized()              // 401
forbidden(msg?)             // 403
notFound(entity)            // 404
validationError(details)    // 422
quotaExceeded(msg)          // 402 — inclure le lien billing
conflict(msg)               // 409
orgSuspended()              // 403
orgReadOnly()               // 403
internalError()             // 500
```

---

## 📋 Magic links — purposes valides

| Purpose | Expiration | Usage |
|---------|-----------|-------|
| `LOGIN` | 15 min | Connexion sans mot de passe |
| `EMAIL_CHANGE` | 24h | Changement d'email |
| `CONFIRMATION` | 7 jours | Confirmation d'affectation |
| `ACTIVATION` | 7 jours | Activation compte GHOST |
| `PLANNING_VIEW` | 7 jours | Vue planning en lecture seule |
| `DOCUMENT_ACCESS` | 1h | Téléchargement document S3 |

---

## 🔔 Système de notifications

### Fichiers concernés
- `lib/notifications.ts` — constantes `NOTIFICATION_CHANNELS` (importable côté client)
- `lib/notifications.server.ts` — fonctions de création (server-only)

### Canaux par type (extrait)

| NotificationType | Canal | Priorité |
|-----------------|-------|---------|
| `AFFECTATION_CREEE` | IN_APP | INFO |
| `CONFIRMATION_REQUISE` | EMAIL | URGENT |
| `AFFECTATION_ANNULEE` | IN_APP_AND_EMAIL | URGENT |
| `REMPLACEMENT_URGENT` | IN_APP_AND_EMAIL | CRITIQUE |
| `DPAE_A_FAIRE` | IN_APP_AND_EMAIL | CRITIQUE |
| `REPRESENTATION_ANNULEE` | IN_APP_AND_EMAIL | URGENT |

### Création d'une notification

```typescript
import { createInAppNotification, broadcastNotification } from '@/lib/notifications.server'
// ⚠️ Server-only — jamais en client component

await createInAppNotification({
  userId,
  organizationId,
  type: 'AFFECTATION_CREEE',
  title: '...',
  body: '...',
  relatedId: affectationId,
  relatedType: 'affectation',
})

// Notification à plusieurs utilisateurs en une fois
await broadcastNotification([userId1, userId2], { ... })
```

---

## 📧 Emails — `lib/email.ts`

```typescript
import { sendEmail, affectationConfirmationEmail } from '@/lib/email'

// Envoi simple
await sendEmail({
  to: 'user@example.com',
  subject: 'Sujet',
  html: affectationConfirmationEmail({ firstName, magicLink, projetNom, ... }),
  replyTo: 'noreply@...',
})
```

16 templates disponibles (voir `docs/24-emails-templates.md`). Tous en français.

---

## 🗂️ Plans & quotas — `lib/plans.ts`

```typescript
// Limites par plan
FREE:        { maxCollaborateurs: 3,  maxProjetsActifs: 1,  ... }
PRO:         { maxCollaborateurs: 20, maxProjetsActifs: -1, ... }  // -1 = illimité
ENTERPRISE:  { maxCollaborateurs: -1, maxProjetsActifs: -1, ... }

// Feature gates (booléens)
features: { dpae, remplacementUrgent, templates, feuilleDeRoute, moduleTournee, exportCsv, multiRegisseur }

// Vérifications
canAddProjet(plan, activeCount): boolean
canAddCollaborateur(plan, currentCount): boolean
hasFeature(plan, feature): boolean
canUploadDocument(plan, currentBytes, fileSizeBytes): boolean
quotaMessage(plan, type): string  // Message + lien /settings/organisation#facturation
```

---

## 🔒 Chiffrement — `lib/crypto.ts`

```typescript
// AES-256 pour N° SS et IBAN uniquement
// Seul le rôle RH peut déchiffrer (vérifier canVoirRH avant d'appeler decrypt)
import { encryptAES256, decryptAES256 } from '@/lib/crypto'

const encrypted = encryptAES256(numeroSS, process.env.CRYPTO_KEY!)
const decrypted = decryptAES256(encrypted, process.env.CRYPTO_KEY!)
```

---

## ☁️ Stockage S3 — `lib/upload.ts`

```typescript
// Upload
await uploadToS3(file, s3Key)

// Signed URL (expiration 1h — jamais d'URL publique)
const url = await generateSignedUrl(s3Key, 3600)
```

---

## ⚡ Conflits horaires — `lib/conflicts.ts`

```typescript
// Non-bloquant : affectation créée malgré le conflit
// hasConflict = true → warning ⚠️ affiché à l'utilisateur

const { hasConflict } = await detectConflict(
  collaborateurId,
  representationDate,
  startTime,
  endTime,
  excludeAffectationId?  // pour les PATCH
)
// Gestion cross-minuit : si endTime < startTime, +24h automatique (Règle #22)
```

---

## 🔄 Flux de données clés

### Créer une affectation
1. `POST /api/affectations` — guard `requireOrgSession('REGISSEUR', { write: true })`
2. Vérifier quota collaborateurs du plan
3. `detectConflict()` → set `hasConflict`
4. Intermittent/CDD → créer DPAE `A_FAIRE`
5. Créer `Affectation` (`confirmationStatus = EN_ATTENTE` si intermittent)
6. Envoyer magic link email `CONFIRMATION` (7 jours)
7. `createInAppNotification` au chef de poste
8. `ActivityLog`
9. Retourner 201

### Annuler une représentation
1. `PATCH /api/representations/[id]` → `status = ANNULEE`
2. Guard `requireOrgSession('REGISSEUR', { write: true })`
3. Mettre toutes les `Affectation` → `ANNULEE` (ou `ANNULEE_TARDIVE` si < 48h)
4. `broadcastNotification` à TOUS les collaborateurs affectés (EN_ATTENTE inclus)
5. Alerte RH si DPAE en cours
6. Retourner la `Representation` mise à jour

### Confirmer via magic link (public)
1. `GET /affectation/[token]/confirmer` — pas d'auth
2. Valider `MagicLinkToken` (purpose=CONFIRMATION, non expiré, non utilisé)
3. `Affectation.confirmationStatus = CONFIRMEE`, set `confirmedAt`
4. Marquer token utilisé
5. Notifier régisseur + chef de poste
6. Broadcast SSE → grille planning
7. Redirect `/mon-planning`

---

## 🔧 Commandes de développement

```bash
# Développement
npm run dev

# Base de données
npm run db:generate    # Régénérer le client Prisma après changement de schema
npm run db:migrate     # Créer et appliquer une migration (dev)
npm run db:migrate:prod  # Appliquer les migrations (production)
npm run db:studio      # Ouvrir Prisma Studio
npm run db:seed        # Charger les données de démo

# Qualité
npm run lint
npm run build
```

---

## 🚫 Ce que ce projet n'a PAS (ne pas implémenter)

- ❌ Dark mode
- ❌ Notifications SMS
- ❌ Interface en anglais (français uniquement)
- ❌ Application mobile native
- ❌ Gestion de billetterie ou comptabilité
- ❌ Bulletins de paie officiels (rémunération prévisionnelle uniquement)

---

## 📋 Glossaire express

| Terme | Définition |
|-------|-----------|
| **Projet** | Un spectacle ou une production (ex: Peter Pan, Garou Tournée 2026) |
| **Représentation** | Une date unique d'un projet : jour + lieu + créneaux horaires |
| **Affectation** | L'assignation d'un collaborateur à une représentation pour un poste |
| **Cachet** | Rémunération forfaitaire par représentation (intermittents) |
| **DPAE** | Déclaration Préalable À l'Embauche — obligatoire avant 1ère prestation |
| **Compte GHOST** | Collaborateur invité sans mot de passe — accès via magic links |
| **Confirmation atomique** | Chaque date confirmée/refusée indépendamment, effet immédiat |
| **isReadOnly** | Flag org bloquant les écritures (trial expiré ou paiement échoué) |
| **hasConflict** | Flag affectation : conflit détecté, non bloquant, warning affiché |
| **Poste requis** | Besoin en personnel d'une équipe (ex: 2 techniciens son) |

---

## 📄 Index de la documentation

| Fichier | Contenu |
|---------|---------|
| `docs/01-vision-concepts.md` | Vision produit, problème marché |
| `docs/02-roles-permissions.md` | Matrice complète des rôles et droits |
| `docs/03-workflows.md` | 15 workflows métier détaillés |
| `docs/04-pages-interfaces-ux.md` | Wireframes et routes UI |
| `docs/05-data-models.md` | Entités et relations |
| `docs/06-regles-decisions.md` | **34 règles métier + 22 décisions techniques** |
| `docs/07-annuaire-collaborateurs.md` | Profil portable collaborateur |
| `docs/08-templates-projets.md` | Templates réutilisables (PRO+) |
| `docs/09-chef-de-poste-dashboard.md` | Dashboard chef de poste |
| `docs/10-remplacements-urgents.md` | Workflow remplacement d'urgence |
| `docs/11-feuille-de-route-logistique.md` | Fiche logistique jour J |
| `docs/12-annulations-reports.md` | 4 niveaux d'annulation et reports |
| `docs/13-notifications.md` | Catalogue des 16 types de notification |
| `docs/14-onboarding.md` | Wizard inscription 3 étapes |
| `docs/15-schema-prisma.md` | Schéma Prisma complet annoté |
| `docs/16-settings-organisation.md` | Paramètres org (membres, billing) |
| `docs/17-back-office-super-admin.md` | Interface `/admin` super-admin |
| `docs/18-webhooks-stripe.md` | Gestion events Stripe |
| `docs/19-module-tournee.md` | Module tournée ENTERPRISE |
| `docs/20-plans-tarifaires.md` | FREE / PRO / ENTERPRISE, trial, quotas |
| `docs/21-cron-jobs.md` | 7 tâches cron (rappels, DPAE, RGPD…) |
| `docs/22-settings-compte.md` | Paramètres compte utilisateur |
| `docs/23-architecture-technique.md` | **Architecture transverse — lire en premier** |
| `docs/24-emails-templates.md` | Catalogue 16 templates email Resend |

---

*Pour toute question sur une règle métier, se référer à `docs/06-regles-decisions.md`. Pour toute question d'architecture, se référer à `docs/23-architecture-technique.md`.*
