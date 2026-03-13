# 🛠️ Back-office SUPER_ADMIN
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

---

## Concept

Le back-office `/admin` est l'interface interne de l'équipe qui gère la plateforme. Il est **totalement séparé** de l'interface client — layout distinct, authentification distincte, aucun code partagé avec `/dashboard`. Un SUPER_ADMIN ne peut pas accéder aux pages clients, et un Directeur ne peut pas accéder au back-office.

**Utilisateurs :** l'équipe technique et commerciale de la plateforme (nous).

**Périmètre :**
- Gérer les organisations (consulter, suspendre, supprimer)
- Gérer les plans & facturation (changer le plan d'une org)
- Consulter les statistiques globales d'usage
- Accéder aux logs d'activité système
- Gérer les comptes SUPER_ADMIN

---

## 17.1 Accès & Sécurité

| Condition | Valeur |
|-----------|--------|
| Rôle requis | `User.role: SUPER_ADMIN` |
| Route préfixe | `/admin/*` |
| Auth | Même NextAuth.js que l'app — le middleware vérifie `SUPER_ADMIN` sur chaque route `/admin` |
| Accès externe | ❌ Jamais exposé via magic link ou lien partageable |
| 2FA | ✅ Obligatoire pour SUPER_ADMIN — TOTP via NextAuth (Google Authenticator / Authy) |

**Middleware :** un middleware Next.js dédié protège tout le préfixe `/admin` :
```typescript
// middleware.ts
if (pathname.startsWith('/admin')) {
  if (!session || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.redirect('/login?error=unauthorized')
  }
}
```

> ⚠️ Le back-office n'est accessible **que sur l'environnement de production** avec les bonnes variables d'environnement. En local et staging, l'accès est restreint par IP ou désactivé.

---

## 17.2 Layout du back-office

Layout distinct de l'app client — sidebar différente, palette sobre (gris/slate).

```
┌──────────────────┬───────────────────────────────────────────────────────────┐
│  🛠️ Admin Panel  │  [contenu de la page]                                     │
│  ──────────────  │                                                           │
│  📊 Tableau bord │                                                           │
│  🏢 Organisations│                                                           │
│  👤 Admins       │                                                           │
│  📋 Logs         │                                                           │
│  ──────────────  │                                                           │
│  Connecté en :   │                                                           │
│  sam@plateforme  │                                                           │
│  [ Se déconner.] │                                                           │
└──────────────────┴───────────────────────────────────────────────────────────┘
```

---

## 17.3 Page — Tableau de bord (`/admin`)

Vue d'ensemble de la santé de la plateforme.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Tableau de bord — Plateforme                          28/02/2026 · 14:32     │
├────────────────┬──────────────────┬──────────────────┬────────────────────────┤
│ Organisations  │ Utilisateurs     │ MRR estimé       │ Représentations/30j    │
│ actives        │ actifs (30j)     │                  │                        │
│   47           │   312            │  3 481 € HT      │   1 204                │
│ +3 ce mois     │                  │ +12% vs janv.    │                        │
├────────────────┴──────────────────┴──────────────────┴────────────────────────┤
│  Répartition par plan                        Nouvelles orgs (30 derniers j)   │
│  ┌─────────────────────────────────────────┐  ┌────────────────────────────┐  │
│  │  FREE     ██░░░░░░░░░░  12  (26%)       │  │  26 fév · Compagnie Noir  │  │
│  │  PRO      ████████████  31  (66%)       │  │  24 fév · Théâtre du Parc │  │
│  │  ENTERPRISE ███░░░░░░░   4  ( 8%)       │  │  21 fév · Les Zéphyrs     │  │
│  └─────────────────────────────────────────┘  │  ...                      │  │
│                                               └────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────────┤
│  Alertes système                                                               │
│  🔴  2 orgs sur plan FREE dépassent leur limite de membres (isReadOnly = true)  │
│  🟡  1 org sans Directeur actif (membre unique supprimé)                       │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Données affichées :**
- Toutes calculées à la volée (COUNT + SUM requêtes) — pas de table de stats dénormalisée en base.
- MRR : calculé depuis les `Organization.plan` actifs × prix par plan (config serveur).
- "Actifs (30j)" : `User.lastActiveAt > now() - 30j`.
- Alertes : requêtes programmées (cf. §17.7).

---

## 17.4 Page — Liste des organisations (`/admin/organisations`)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Organisations                                                          47    │
├───────────────────────────────────────────────────────────────────────────────┤
│  🔍 Rechercher...   [Tous les plans ▾]   [Tous statuts ▾]   [Trier : récent ▾]│
├──────────────────┬───────────────────┬────────────┬──────────┬───────────────┤
│  Nom             │ Type              │ Plan       │ Membres  │ Créée le      │
├──────────────────┼───────────────────┼────────────┼──────────┼───────────────┤
│  Théâtre du Nord │ Théâtre           │ PRO        │ 12       │ 15/01/2026    │
│  Compagnie Noir  │ Compagnie         │ FREE       │  3       │ 26/02/2026    │
│  Les Zéphyrs     │ Compagnie         │ PRO        │  8       │ 21/02/2026    │
│  Zénith Paris    │ Salle de concert  │ ENTERPRISE │ 24       │ 03/09/2025    │
│  ...             │                   │            │          │               │
└──────────────────┴───────────────────┴────────────┴──────────┴───────────────┘
```

**Filtres :**
- Plan : FREE / PRO / ENTERPRISE / SUSPENDU
- Statut : Actif / Suspendu / Supprimé (soft-deleted)
- Tri : date de création, nom, plan, nb membres

Chaque ligne est cliquable → fiche organisation `[→]`.

---

## 17.5 Page — Fiche organisation (`/admin/organisations/[id]`)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  ← Organisations   Théâtre du Nord                              [⚙️ Actions ▾]│
├────────────────────────────────┬──────────────────────────────────────────────┤
│  INFORMATIONS                  │  USAGE                                       │
│  Slug      theatre-du-nord     │  Projets actifs       4                      │
│  Type      Théâtre             │  Membres              12                     │
│  Ville     Lille               │  Représentations/30j  37                     │
│  Plan      PRO                 │  Stockage S3          240 Mo                 │
│  Stripe    cus_Nxxx...         │  Dernière activité    27/02/2026             │
│  Créée     15/01/2026          │                                              │
│  Billing   fact@theatre.fr     │  DIRECTEURS                                  │
│                                │  Sam Aubron · sam@theatre.fr                 │
│                                │  (seul Directeur)                            │
├────────────────────────────────┴──────────────────────────────────────────────┤
│  MEMBRES (12)                                                                 │
│  Nom              Email                 Rôle          Statut     Actif (30j)  │
│  Sam Aubron       sam@theatre.fr        Directeur     ACTIVE     ✅           │
│  Lucie Martin     lucie@theatre.fr      Régisseur     ACTIVE     ✅           │
│  Bob Freelance    bob@free.fr           Régisseur     En attente ❌           │
│  ...                                                                          │
├───────────────────────────────────────────────────────────────────────────────┤
│  ACTIVITÉ RÉCENTE (10 dernières entrées ActivityLog)                          │
│  27/02 · 14:22 · AFFECTATION_CREATED  · Lucie Martin · Affectation#clx...    │
│  27/02 · 11:05 · PROJET_CREATED       · Sam Aubron   · Projet#clx...         │
│  26/02 · 09:14 · MEMBER_INVITED       · Sam Aubron   · User#clx...           │
└───────────────────────────────────────────────────────────────────────────────┘
```

> **Colonne Statut :** `ACTIVE` = `OrganizationMembership.joinedAt IS NOT NULL` (invitation acceptée). `En attente` = `joinedAt IS NULL` (invitation envoyée, pas encore connecté). ⚠️ `accountStatus` (GHOST/ACTIVE/INACTIF) est sur `Collaborateur`, pas sur `User` — les membres staff n'ont pas forcément de `Collaborateur` record.

### Menu Actions [⚙️ Actions ▾]

```
┌──────────────────────────────────┐
│  Changer le plan              ▶  │
│  ──────────────────────────────  │
│  Suspendre l'organisation        │
│  ──────────────────────────────  │
│  Supprimer l'organisation        │
└──────────────────────────────────┘
```

### 17.5.1 Changer le plan

```
┌──────────────────────────────────────────────────────────────────┐
│  Changer le plan — Théâtre du Nord                     [✕]       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Plan actuel : PRO                                               │
│                                                                  │
│  Nouveau plan *                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ENTERPRISE                                            ▾   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Raison interne (non visible par le client)                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Accord commercial — réunion 27/02                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ⚠️ Le changement est effectif immédiatement.                    │
│  La facturation Stripe est mise à jour en prorata.               │
│                                                                  │
│                          [ Annuler ]  [ Confirmer le changement ]│
└──────────────────────────────────────────────────────────────────┘
```

**Workflow :**
```
POST /api/admin/organisations/[id]/plan

    → CAS A — org.stripeCustomerId IS NOT NULL (abonnement Stripe actif) :
        → stripe.subscriptions.update({ price: NOUVEAU_PRICE_ID })
        → NE PAS écrire Organization.plan en base ici
        → Le webhook customer.subscription.updated (§18.3) mettra à jour Organization.plan
        → ⚠️ Principe "Stripe source de vérité" (§18) : jamais l'inverse

    → CAS B — org.stripeCustomerId IS NULL (trial ou FREE sans souscription) :
        → Écriture directe : Organization.plan = nouveau plan
        ← Exception admin documentée : l'org n'a pas de subscription Stripe
           à synchroniser — l'écriture directe est la seule option
        → Si nouveau plan = FREE ET nbCollabs > 3 → Organization.isReadOnly = true

    → Dans les deux cas :
        → ActivityLog: ADMIN_PLAN_OVERRIDE (admin: userId, raison, ancienPlan, nouveauPlan)  ← enum §15 — distinct de PLAN_CHANGED (webhook Stripe)
        → Notification in-app au Directeur de l'org :
          "Votre abonnement a été mis à jour vers le plan [NOUVEAU PLAN]."
```

### 17.5.2 Suspendre l'organisation

La suspension est réversible — elle bloque l'accès à l'app sans supprimer les données.

```
┌──────────────────────────────────────────────────────────────────┐
│  Suspendre Théâtre du Nord ?                           [✕]       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Les membres ne pourront plus se connecter à l'organisation.     │
│  Les données sont conservées. La suspension est réversible.      │
│                                                                  │
│  Raison *                                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Impayé — relance envoyée le 25/02                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│                       [ Annuler ]  [ Suspendre l'organisation ]  │
└──────────────────────────────────────────────────────────────────┘
```

**Implémentation :**
- Ajouter `Organization.suspendedAt: DateTime?` et `Organization.suspendedReason: String?` au modèle (et au schéma Prisma — cf. §17.8).
- Le middleware client vérifie `Organization.suspendedAt !== null` → affiche page `/suspended` avec message générique ("Votre accès est temporairement suspendu — contactez support@...").
- Le Directeur reçoit une notification email.

### 17.5.3 Supprimer l'organisation (admin)

Identique au workflow de `§16.6` mais sans saisie du nom — le SUPER_ADMIN confirme par checkbox + raison.

```
┌──────────────────────────────────────────────────────────────────┐
│  Supprimer Théâtre du Nord ?                           [✕]       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⚠️ Action irréversible. Supprime toutes les données.            │
│                                                                  │
│  Raison *                                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Demande de suppression RGPD — email reçu 28/02            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ☐  Je confirme la suppression définitive de cette organisation  │
│                                                                  │
│                         [ Annuler ]  [ Supprimer définitivement ]│
│                                      (désactivé si non coché)    │
└──────────────────────────────────────────────────────────────────┘
```

Même cascade de suppression que `§16.6` + log `ActivityLog: ORG_DELETED_BY_ADMIN`.

---

## 17.6 Page — Gestion des admins (`/admin/admins`)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Super Admins                                      [ + Ajouter un admin ]    │
├───────────────────────────────────────────────────────────────────────────────┤
│  Nom               Email                     Ajouté le       Actions         │
│  Sam Aubron        sam@plateforme.fr          15/01/2026      (vous)          │
│  Alice Tech        alice@plateforme.fr        20/01/2026      [ Retirer ]     │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Règles :**
- Seul un SUPER_ADMIN peut ajouter/retirer un autre SUPER_ADMIN.
- On ne peut pas retirer le dernier SUPER_ADMIN (même règle que Directeur).
- L'ajout crée un `User` avec `role: SUPER_ADMIN` ou promouvoit un `MEMBER` existant.
- Toute modification est tracée dans `ActivityLog`.

---

## 17.7 Page — Logs système (`/admin/logs`)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Logs d'activité                                                              │
├───────────────────────────────────────────────────────────────────────────────┤
│  🔍 Rechercher...  [Type ▾]  [Organisation ▾]  [Période : 7 derniers jours ▾]│
├──────────────────────────────────────────────────────────────────────────────-┤
│  Horodatage        Org                 Action               Utilisateur       │
│  28/02 · 14:32     Théâtre du Nord     AFFECTATION_CREATED  Lucie Martin      │
│  28/02 · 14:28     Théâtre du Nord     PLAN_CHANGED         [ADMIN] Sam A.    │
│  28/02 · 11:05     Compagnie Noir      PROJET_CREATED       Alice Dupont      │
│  27/02 · 09:14     Zénith Paris        MEMBER_INVITED       Jean Martin       │
│  ...                                                                          │
├───────────────────────────────────────────────────────────────────────────────┤
│  [ Exporter CSV ]                                           Page 1 / 47  ›   │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Filtres disponibles :**
- Type d'action (tous les types de `ActivityLog.action`)
- Organisation (dropdown searchable)
- Utilisateur (email)
- Période : 24h / 7j / 30j / personnalisé

**Export CSV :** colonnes `horodatage, org, orgId, action, entityType, entityId, userId, userEmail, metadata(JSON)`. Route : `GET /api/admin/logs/export`.

---

## 17.8 Impact sur le schéma Prisma

Deux champs à ajouter au modèle `Organization` dans `prisma/schema.prisma` (et dans `05-data-models.md`) :

```prisma
model Organization {
  // ... champs existants ...

  // Suspension (admin uniquement)
  suspendedAt     DateTime? // null = actif
  suspendedReason String?   // raison interne (non visible par le client)
}
```

> ✅ Déjà présents dans `05-data-models.md` et `15-schema-prisma.md` depuis session 3.

---

## 17.9 Routes back-office

| Méthode | Route | Action |
|---------|-------|--------|
| GET | `/admin` | Tableau de bord plateforme |
| GET | `/admin/organisations` | Liste des organisations |
| GET | `/admin/organisations/[id]` | Fiche organisation |
| PATCH | `/api/admin/organisations/[id]/plan` | Changer le plan |
| POST | `/api/admin/organisations/[id]/suspendre` | Suspendre |
| POST | `/api/admin/organisations/[id]/reactiver` | Réactiver |
| DELETE | `/api/admin/organisations/[id]` | Supprimer |
| GET | `/admin/admins` | Liste des SUPER_ADMINs |
| POST | `/api/admin/admins` | Ajouter un SUPER_ADMIN |
| DELETE | `/api/admin/admins/[userId]` | Retirer un SUPER_ADMIN |
| GET | `/admin/logs` | Logs d'activité |
| GET | `/api/admin/logs/export` | Export CSV des logs |

> Toutes ces routes vérifient `User.role === SUPER_ADMIN`. Elles ignorent complètement `OrganizationMembership`.

---

## 17.10 Questions ouvertes

- **Impersonation :** se connecter "en tant que" un Directeur pour débugger ? → Utile mais risqué (RGPD). À implémenter avec log obligatoire (`ActivityLog: ADMIN_IMPERSONATION`).
- **Métriques avancées :** rétention, churn, cohortes — à brancher sur un outil dédié (Metabase, PostHog) plutôt qu'une page home-made.
- **Alertes Slack/email admin :** notifier l'équipe si une org dépasse ses limites, si un paiement échoue (Stripe webhook → `/api/webhooks/stripe`). Voir `18-webhooks-stripe.md`.
