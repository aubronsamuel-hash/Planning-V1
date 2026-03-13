# 🤖 Guide Claude — SaaS Gestion du Spectacle Vivant

> **Version :** 1.0 · **Date :** 07/03/2026 · **Statut :** ✅ Actif

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

## 🏗️ Conventions de code

### Structure des fichiers
```
app/
├── api/                    # Routes API (Next.js Route Handlers)
│   ├── [resource]/
│   │   ├── route.ts        # GET, POST
│   │   └── [id]/route.ts   # GET, PATCH, DELETE
├── (app)/                  # Pages authentifiées (layout avec sidebar)
└── (public)/               # Pages publiques (login, signup, magic link)

lib/
├── auth/getUserContext.ts   # Helpers de permission (canAffecter, canVoirRH…)
├── plans.ts                 # Logique plans FREE/PRO/ENTERPRISE
├── email.ts                 # Wrapper Resend
└── notifications.ts         # Constantes canaux (email + in-app)

prisma/
└── schema.prisma            # Source de vérité du modèle de données
```

### Pattern API standard
```typescript
// app/api/[resource]/route.ts
export async function GET(req: Request) {
  const session = await getServerSession()
  if (!session) return new Response('Unauthorized', { status: 401 })

  // 1. Vérifier le rôle
  if (!canVoirTousLesProjets(session)) return new Response('Forbidden', { status: 403 })

  // 2. Toujours scoper à l'org active
  const data = await prisma.projet.findMany({
    where: {
      organizationId: session.user.organizationId,
      deletedAt: null,  // ← toujours
    }
  })

  return Response.json(data)
}
```

### Magic links — purposes valides
| Purpose | Expiration |
|---------|-----------|
| `LOGIN` | 15 min |
| `EMAIL_CHANGE` | 24h |
| `CONFIRMATION` | 7 jours |
| `ACTIVATION` | 7 jours |
| `PLANNING_VIEW` | 7 jours |

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

---

*Pour toute question sur une règle métier, se référer à `docs/06-regles-decisions.md`. Pour toute question d'architecture, se référer à `docs/23-architecture-technique.md`.*
