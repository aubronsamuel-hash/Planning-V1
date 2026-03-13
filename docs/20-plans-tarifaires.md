# 💳 Plans Tarifaires
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

---

## Concept

Le SaaS est vendu par abonnement mensuel à l'organisation (pas par utilisateur). Trois tiers couvrent le cycle de vie d'une structure : découverte gratuite → croissance → échelle.

**Principe de facturation :** Stripe est la source de vérité absolue. `Organization.plan` est mis à jour uniquement via webhook Stripe (→ `18-webhooks-stripe.md`). Jamais en direct depuis l'UI.

---

## 20.1 Vue d'ensemble des tiers

| Tier | Nom commercial | Prix (HT/mois) | Cible |
|------|---------------|:---:|-------|
| `FREE` | Découverte | 0 € | Petites structures, test, associations |
| `PRO` | Croissance | 49 € | PME culturelles, compagnies, théâtres régionaux |
| `ENTERPRISE` | Scale | 149 € | Grandes structures, tournées, multi-projets |

---

## 20.2 Limites & fonctionnalités par plan

| Fonctionnalité | FREE | PRO | ENTERPRISE |
|----------------|:----:|:---:|:----------:|
| **Collaborateurs max** | 3 | 20 | Illimité |
| **Administrateurs (rôle Directeur/RH/Régisseur)** | 1 | Illimité | Illimité |
| **Projets actifs simultanément** | 1 | Illimité | Illimité |
| **Représentations par projet** | 20 | Illimité | Illimité |
| **Module DPAE** | ❌ | ✅ | ✅ |
| **Relances automatiques collaborateurs** | ❌ | ✅ | ✅ |
| **Export CSV paie (SAGE / Cegid)** | ❌ | ✅ | ✅ |
| **Templates de projets** | ❌ | ✅ | ✅ |
| **Module Tournée (hébergement, flotte)** | ❌ | ❌ | ✅ |
| **Export comptable avancé** | ❌ | ❌ | ✅ |
| **Support prioritaire** | ❌ | ❌ | ✅ |
| **Stockage documents S3** | 500 Mo | 5 Go | 50 Go |

> **Note :** les limites sont des constantes côté serveur, jamais stockées en base — seul `Organization.plan` est persisté. Les valeurs sont centralisées dans `lib/plans.ts`.

---

## 20.3 Trial period

**Durée :** 14 jours sur le plan **PRO** (à partir de la date d'inscription).

**Comportement pendant le trial :**
- Toutes les fonctionnalités PRO sont disponibles sans restriction
- Bandeau persistent en haut de l'app : "Essai gratuit — X jours restants · [Choisir un plan]"
- Pas de carte bancaire requise pour démarrer

**Fin du trial — 3 cas :**

```
CAS A — L'organisation a saisi ses infos de paiement et subscrit avant l'expiration :
    → Trial se termine → plan PRO actif → aucune interruption

CAS B — Le trial expire sans souscription, org ≤ 3 collaborateurs :
    → Automatiquement rétrogradée en plan FREE
    → Email au Directeur : "Votre essai est terminé — vous êtes maintenant sur le plan Découverte"
    → Les données restent intactes mais les fonctionnalités PRO sont désactivées

CAS C — Le trial expire sans souscription, org > 3 collaborateurs :
    → Mode "Lecture seule" activé (Organization.isReadOnly = true)
    → Toute création/modification est bloquée
    → Bandeau rouge : "Votre essai est terminé et votre organisation dépasse les limites du plan gratuit"
    → Redirect obligatoire vers /settings/organisation#facturation pour souscrire
    → Les données sont conservées 30 jours en lecture seule, puis org suspendue
```

**Email J-3 :** géré par le **cron `§21.3 Étape 1`** (app-side). Le trial est 100% géré par `Organization.trialEndsAt` sans client Stripe — Stripe ne peut donc pas déclencher `customer.subscription.trial_will_end`. Le cron est le seul mécanisme de J-3 et d'expiration trial. Voir §18.7 pour le handler Stripe (applicable si migration vers trials Stripe natifs).

---

## 20.4 Règle de blocage — Dépassement de quota

Quand une action dépasserait la limite du plan actuel :

```
EXEMPLE — Org FREE (limite 3 collabs) tente d'inviter un 4ème collaborateur :

    [Régisseur — "+ Inviter un collaborateur"]
        → Vérification plan avant ouverture du modal
        → Quota atteint (3/3) → modal bloqué

    → Toast d'information :
      "⚠️ Votre plan Découverte est limité à 3 collaborateurs.
       Passez au plan Croissance pour continuer."
      [ Voir les plans ]  →  /settings/organisation#facturation

    → L'action est bloquée proprement — aucune donnée n'est créée
    → L'utilisateur peut TOUJOURS consulter les données existantes
```

**Règle clé :** le blocage est non-destructif. On ne supprime jamais de données pour respecter un quota. Si une org passe en downgrade et dépasse la limite, elle bascule en lecture seule jusqu'à ce qu'elle soit à nouveau dans les limites (ou upgrade).

**Routes concernées par les guards de plan :**

| Action | Plan minimum |
|--------|:---:|
| Inviter un collaborateur (quota) | FREE (1-3) / PRO (4-20) / ENTERPRISE (21+) |
| Accéder au module DPAE | PRO |
| Activer les relances automatiques | PRO |
| Exporter CSV paie | PRO |
| Créer un 2ème projet actif | PRO |
| Accéder au module Tournée | ENTERPRISE |
| Export comptable avancé | ENTERPRISE |

---

## 20.5 Upgrade / Downgrade

**Upgrade (FREE → PRO, PRO → ENTERPRISE) :**
```
[Directeur — /settings/organisation#facturation]
    → Clic sur "Passer au plan Croissance"
    → POST /api/billing/checkout (cf. §18.0) — crée une Stripe Checkout Session
    → Redirection vers la page Checkout Stripe (paiement carte)
    → Directeur saisit sa carte
    → Stripe envoie customer.subscription.updated
    → App met à jour Organization.plan = PRO via webhook
    → Accès aux nouvelles fonctionnalités instantané
```
> ⚠️ Ne pas confondre avec le **Stripe Customer Portal** (`GET /api/billing/portal`) qui est réservé à la gestion d'un abonnement **existant** (mise à jour CB, historique de facturation, résiliation).

**Downgrade (PRO → FREE) :**
```
    → Le downgrade prend effet à la fin de la période de facturation en cours
    → Si l'org a > 3 collabs au moment du downgrade :
        → Email d'avertissement : "À partir du [date], vous serez en mode lecture seule
           si votre nombre de collaborateurs n'a pas diminué"
    → Webhook customer.subscription.updated déclenche la vérification des limites
```

---

## 20.6 Implémentation — `lib/plans.ts`

```typescript
// lib/plans.ts — constantes des limites par plan
export const PLAN_LIMITS = {
  FREE: {
    maxCollaborateurs: 3,
    maxAdmins: 1,
    maxProjetsActifs: 1,
    maxRepresentationsParProjet: 20,
    maxStorageMo: 500,
    features: {
      dpae: false,
      relancesAuto: false,
      exportCsv: false,
      templates: false,
      moduleTournee: false,
      exportComptableAvance: false,
    },
  },
  PRO: {
    maxCollaborateurs: 20,
    maxAdmins: Infinity,
    maxProjetsActifs: Infinity,
    maxRepresentationsParProjet: Infinity,
    maxStorageMo: 5120,
    features: {
      dpae: true,
      relancesAuto: true,
      exportCsv: true,
      templates: true,
      moduleTournee: false,
      exportComptableAvance: false,
    },
  },
  ENTERPRISE: {
    maxCollaborateurs: Infinity,
    maxAdmins: Infinity,
    maxProjetsActifs: Infinity,
    maxRepresentationsParProjet: Infinity,
    maxStorageMo: 51200,
    features: {
      dpae: true,
      relancesAuto: true,
      exportCsv: true,
      templates: true,
      moduleTournee: true,
      exportComptableAvance: true,
    },
  },
} as const

export type PlanKey = keyof typeof PLAN_LIMITS
```

---

## 20.7 Champs Prisma concernés

Sur le modèle `Organization` :

```prisma
plan                 OrganizationPlan  @default(FREE)
isReadOnly           Boolean           @default(false)   // lecture seule si trial expiré + quota dépassé
stripeCustomerId     String?           @unique
trialEndsAt          DateTime?
trialReminderSentAt  DateTime?         // guard cron §21.3 — évite d'envoyer plusieurs emails J-3
paymentFailedAt      DateTime?
```

> Voir schéma complet → `15-schema-prisma.md`

---

## 20.8 Questions ouvertes

- Coupon / code promo (réductions partenaires) ?
- Facturation annuelle avec remise (10% ?) ?
- Plan personnalisé au-dessus de Enterprise (grands opéras, festivals) ?
