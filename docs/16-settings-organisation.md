# ⚙️ Paramètres Organisation
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

---

## Concept

La page `/settings/organisation` regroupe tout ce qui concerne l'organisation elle-même : son profil public, ses membres, son abonnement, et les actions irréversibles. C'est une page d'administration interne — elle n'est accessible qu'aux **Directeurs** (et au SUPER_ADMIN via le back-office).

**Principe :** les paramètres de l'organisation sont indépendants des paramètres utilisateur (`/settings/compte` — à venir). Ce fichier couvre uniquement `/settings/organisation`.

---

## 16.1 Accès & Permissions

| Rôle | Accès | Ce qu'il peut faire |
|------|-------|---------------------|
| DIRECTEUR | ✅ Complet | Tout lire, tout modifier |
| REGISSEUR | ❌ | Pas d'accès — redirection `/dashboard` |
| RH | ❌ | Pas d'accès — redirection `/dashboard` |
| COLLABORATEUR | ❌ | Pas d'accès — redirection `/dashboard` |
| SUPER_ADMIN | ✅ Back-office | Via `/admin/organisations/[id]` (interface séparée) |

> **Règle d'accès API :** chaque route `/api/settings/organisation/*` vérifie `OrganizationMembership.role === DIRECTEUR` **ET** que l'organisation cible correspond au contexte de session. Un Directeur d'une organisation ne peut jamais modifier une autre organisation.

---

## 16.2 Structure de la page

La page est découpée en **4 sections** accessibles via une navigation interne (ancres ou onglets latéraux).

```
┌──────────────┬──────────────────────────────────────────────────────────────┐
│              │  Paramètres de l'organisation                                │
│   SIDEBAR    ├──────────────────────────────────────────────────────────────┤
│              │  ┌─────────────────────────────────────────────────────────┐ │
│ ⚙️ Réglages  │  │  > Informations générales                               │ │
│              │  │  > Membres                                               │ │
│  Organisation│  │  > Abonnement & Facturation                              │ │
│  Mon compte  │  │  > Zone de danger                                        │ │
│              │  └─────────────────────────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 16.3 Section — Informations générales

**Route :** `/settings/organisation` (section par défaut)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Informations générales                                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Logo                                                                        │
│  ┌──────────────┐                                                            │
│  │              │   [ Changer le logo ]   Formats acceptés : JPG, PNG, SVG  │
│  │  [LOGO ORG]  │   Taille max : 2 Mo — Affiché dans la sidebar et emails   │
│  │              │                                                            │
│  └──────────────┘                                                            │
│                                                                              │
│  Nom de l'organisation *                                                     │
│  ┌────────────────────────────────────────────────────────────┐              │
│  │  Théâtre du Nord                                           │              │
│  └────────────────────────────────────────────────────────────┘              │
│                                                                              │
│  Identifiant unique (slug)                                                   │
│  ┌────────────────────────────────────────────────────────────┐              │
│  │  theatre-du-nord                                           │  🔒          │
│  └────────────────────────────────────────────────────────────┘              │
│  ⚠️ L'identifiant est définitif — il ne peut pas être modifié après création │
│  Il apparaît dans les URLs partagées avec les collaborateurs.                │
│                                                                              │
│  Type de structure *                                                         │
│  ┌────────────────────────────────────────────────────────────┐              │
│  │  Théâtre                                               ▾   │              │
│  └────────────────────────────────────────────────────────────┘              │
│  Options : Théâtre · Compagnie de danse · Compagnie théâtrale · Producteur · Salle de concert · Festival · Autre │
│                                                                              │
│  Ville *                                                                     │
│  ┌────────────────────────────────────────────────────────────┐              │
│  │  Lille                                                     │              │
│  └────────────────────────────────────────────────────────────┘              │
│                                                                              │
│  Pays                                                                        │
│  ┌────────────────────────────────────────────────────────────┐              │
│  │  France (FR)                                           ▾   │              │
│  └────────────────────────────────────────────────────────────┘              │
│  (Fixe — seul FR est disponible)                                             │
│                                                                              │
│                                              [ Enregistrer les modifications ]│
└──────────────────────────────────────────────────────────────────────────────┘
```

**Règles :**
- `name` : obligatoire, 2–100 caractères.
- `slug` : généré automatiquement à la création (depuis le nom, en `kebab-case`, unique), **immuable après création**. Champ affiché en lecture seule avec icône 🔒.
- `type` : liste libre (`String` dans le modèle), pas d'enum — le texte est affiché dans la sidebar et les exports.
- `logo` : uploadé sur S3, URL stockée dans `Organization.logo`. Le ratio recommandé est 1:1 (carré). Taille max : 2 Mo.
- `country` : champ technique fixé à `"FR"` — affiché en lecture seule.
- Enregistrement : `PATCH /api/settings/organisation` — validé côté serveur, le slug est ignoré même s'il est envoyé.

---

## 16.4 Section — Membres

**Route :** `/settings/organisation#membres`

La gestion des membres est le cœur de cette page pour le Directeur.

### 16.4.1 Liste des membres

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Membres de l'organisation                 [ + Inviter un membre ]           │
├──────────────────────────────────────────────────────────────────────────────┤
│  🔍 Rechercher un membre...                                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│  Nom                    Email                     Rôle           Actions     │
├──────────────────────────────────────────────────────────────────────────────┤
│  👤 Sam Aubron          sam@theatre-nord.fr       Directeur      (vous)      │
│  👤 Lucie Martin        lucie@theatre-nord.fr     Régisseur      [⋯]         │
│  👤 Pierre Dumont       pierre@theatre-nord.fr    RH             [⋯]         │
│  👤 Alice Renard        alice@theatre-nord.fr     Collaborateur  [⋯]         │
│  👻 bob@freelance.fr    (invitation en attente)   Régisseur      [Renvoyer]  │
├──────────────────────────────────────────────────────────────────────────────┤
│  4 membres actifs · 1 invitation en attente                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Règles d'affichage :**
- Les membres dont `joinedAt IS NULL` (invitation envoyée, pas encore connectés) affichent leur email à la place du nom + badge 👻.
- Les invitations en attente (aucun `joinedAt`) affichent `(invitation en attente)` + bouton `[Renvoyer]`.
- Le Directeur connecté voit `(vous)` à la place des actions — ne peut pas se modifier lui-même.

### 16.4.2 Menu actions membre [⋯]

```
┌──────────────────────────────┐
│  Changer le rôle          ▶  │
│  ─────────────────────────   │
│  Retirer de l'organisation   │
└──────────────────────────────┘
```

**Sous-menu "Changer le rôle" :**
```
┌──────────────────────────────┐
│  ● Directeur                 │
│  ○ Régisseur                 │
│  ○ RH                        │
│  ○ Collaborateur             │
└──────────────────────────────┘
```

**Règle #7 — Dernier Directeur :** si l'organisation n'a qu'un seul Directeur, la tentative de lui changer de rôle ou de le retirer est bloquée côté API avec un message :

> ⚠️ *Impossible — Sam Aubron est le seul Directeur de cette organisation. Désignez d'abord un autre Directeur.*

La vérification se fait aussi côté UI : l'option est grisée avec une info-bulle explicative.

### 16.4.3 Modal — Inviter un membre

```
┌──────────────────────────────────────────────────────────────────┐
│  Inviter un membre                                         [✕]   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Adresse email *                                                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  email@exemple.fr                                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│  Si l'email est déjà dans la plateforme, le compte existant      │
│  sera lié. Sinon, un compte fantôme (GHOST) sera créé.           │
│                                                                  │
│  Rôle *                                                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Régisseur                                             ▾   │  │
│  └────────────────────────────────────────────────────────────┘  │
│  Options : Directeur · Régisseur · RH · Collaborateur            │
│                                                                  │
│  Message personnalisé (optionnel)                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Bienvenue dans l'équipe !                                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│                          [ Annuler ]  [ Envoyer l'invitation ]   │
└──────────────────────────────────────────────────────────────────┘
```

**Workflow invitation :**
```
[Directeur clique "Envoyer l'invitation"]
    → POST /api/settings/organisation/membres/inviter
    → Vérification : email déjà membre de cette org ? → Erreur "déjà membre"
    → Email existant sur la plateforme ?
        OUI → lier ce User à l'org via OrganizationMembership (role = choisi)
        NON → créer User + OrganizationMembership (joinedAt: null — invitation en attente)
    → Envoi email invitation avec magic link (purpose: ACTIVATION si GHOST,
      sinon notification standard)
    → Toast ✅ "Invitation envoyée à bob@freelance.fr"
```

### 16.4.4 Modal — Retirer un membre

```
┌──────────────────────────────────────────────────────────────────┐
│  Retirer Alice Renard de l'organisation ?              [✕]       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Alice Renard (Collaborateur) perdra immédiatement l'accès       │
│  à tous les projets de l'organisation.                           │
│                                                                  │
│  ⚠️ Ses affectations passées et futures sont conservées pour     │
│  l'historique. Elle n'apparaîtra plus dans l'annuaire.           │
│                                                                  │
│                             [ Annuler ]  [ Retirer le membre ]   │
└──────────────────────────────────────────────────────────────────┘
```

**Règles :**
- Le retrait supprime `OrganizationMembership` mais ne supprime pas `User`.
- Les `Affectation` existantes (passées et futures) sont conservées intactes — l'historique paie reste intact.
- Si le membre retiré est chef de poste (`EquipeMembre.role: CHEF`) sur un projet actif → alerte dans le modal : *"Alice est chef de poste sur l'équipe Technique de Peter Pan — vous devrez désigner un remplaçant."*
- Les futures affectations de ce membre restent actives (le régisseur doit décider manuellement de les annuler).

---

## 16.5 Section — Abonnement & Facturation

**Route :** `/settings/organisation#facturation`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Abonnement & Facturation                                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Plan actuel                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  🏆 PRO                                                               │    │
│  │  Renouvelé le 1er mars 2026 · 49 € / mois HT                         │    │
│  │                                           [ Gérer l'abonnement → ]   │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Limites du plan PRO                                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  Projets actifs          4 / illimité                                 │    │
│  │  Membres actifs         12 / 20                                       │    │
│  │  Stockage documents    240 Mo / 5 Go                                  │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Email de facturation                                                        │
│  ┌────────────────────────────────────────────────────────┐                  │
│  │  facturation@theatre-nord.fr                           │                  │
│  └────────────────────────────────────────────────────────┘                  │
│                                              [ Mettre à jour l'email ]       │
│                                                                              │
│  Historique des factures                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  Févr. 2026   49,00 € HT   ✅ Payée    [ Télécharger PDF ]           │    │
│  │  Janv. 2026   49,00 € HT   ✅ Payée    [ Télécharger PDF ]           │    │
│  │  Déc.  2025   49,00 € HT   ✅ Payée    [ Télécharger PDF ]           │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Implémentation :**
- `[ Gérer l'abonnement → ]` → redirect vers le **Stripe Customer Portal** (lien temporaire généré server-side via `stripe.billingPortal.sessions.create`). Le Directeur gère upgrade/downgrade/annulation directement dans l'interface Stripe — on ne réimplémente pas ça.
  - **Guard `stripeCustomerId IS NULL` :** si l'org est encore en trial (`stripeCustomerId IS NULL`), le bouton "Gérer l'abonnement" est remplacé par un CTA `[ Choisir un plan → ]` pointant vers la page de souscription (pas le Stripe Portal, qui nécessite un client Stripe existant). `stripe.billingPortal.sessions.create` ne doit jamais être appelé avec `customer: null`.
- `[ Télécharger PDF ]` → les factures sont listées via `stripe.invoices.list({ customer: org.stripeCustomerId })` et les PDFs viennent de `invoice.invoice_pdf` (URL Stripe, pas stockée en base).
  - **Guard `stripeCustomerId IS NULL` :** si `stripeCustomerId IS NULL`, afficher un état vide : "Aucune facture — vous êtes en période d'essai. Les factures apparaîtront ici après votre première souscription." Ne jamais appeler `stripe.invoices.list({ customer: null })`.
- `billingEmail` → champ `Organization.billingEmail`, modifiable séparément du compte utilisateur. Synchro avec Stripe via `stripe.customers.update` **uniquement si `stripeCustomerId IS NOT NULL`**.
- Limites du plan : calculées à la volée (COUNT requêtes) — pas stockées en base. Seuils par plan définis en config serveur.

**Plans :**

| Plan | Prix | Projets actifs | Collaborateurs | Stockage |
|------|------|----------------|----------------|---------|
| FREE | 0 € | 1 | 3 | 500 Mo |
| PRO | 49 € HT/mois | Illimité | 20 | 5 Go |
| ENTERPRISE | 149 € HT/mois | Illimité | Illimité | 50 Go |

> Détail complet des limites et des fonctionnalités → `20-plans-tarifaires.md`

---

## 16.6 Section — Zone de danger

**Route :** `/settings/organisation#danger`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Zone de danger                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  🗑️  Supprimer l'organisation                                         │    │
│  │                                                                      │    │
│  │  Supprime définitivement l'organisation et toutes ses données        │    │
│  │  (projets, représentations, affectations, documents S3).             │    │
│  │  Cette action est irréversible.                                      │    │
│  │                                                                      │    │
│  │                                    [ Supprimer l'organisation... ]   │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Modal de confirmation — Suppression

```
┌──────────────────────────────────────────────────────────────────┐
│  Supprimer Théâtre du Nord ?                           [✕]       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⚠️ Cette action est irréversible. Seront supprimés :            │
│                                                                  │
│   • 4 projets actifs et leurs représentations                    │
│   • 37 affectations passées et futures                           │
│   • 12 membres (leurs comptes perso ne seront pas supprimés)     │
│   • Tous les documents stockés (S3)                              │
│                                                                  │
│  L'abonnement Stripe sera automatiquement résilié.               │
│                                                                  │
│  Pour confirmer, tapez le nom de l'organisation :                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│                         [ Annuler ]  [ Supprimer définitivement ]│
│                                      (désactivé si champ vide)   │
└──────────────────────────────────────────────────────────────────┘
```

**Workflow suppression :**
```
[Directeur tape le nom exact → bouton activé → clique "Supprimer définitivement"]
    → DELETE /api/settings/organisation
    → Vérification : nom tapé = Organization.name ? → sinon 400
    → Vérification : requêrant est DIRECTEUR de cette org ? → sinon 403
    → Annulation abonnement Stripe (stripe.subscriptions.cancel)
    → Suppression des fichiers S3 (batch delete tous les Document.s3Key de l'org)
    → Cascade DB :
        OrganizationMembership → supprimé
        Notification (liées à des entités de cette org) → supprimé
        ActivityLog (de cette org) → supprimé
        Affectation → supprimé (cascade depuis Representation → Projet → Org)
        Representation → supprimé
        Equipe, PosteRequis, ProjetMembre → supprimé
        Projet → supprimé
        ProjetTemplate, EquipeTemplate, PosteRequisTemplate → supprimé
        Document (records DB) → supprimé (fichiers S3 déjà purgés)
        Organization → supprimé
        ⚠️ User records conservés (les comptes perso des membres ne sont pas supprimés)
    → Déconnexion de la session active
    → Redirection → /goodbye (page de confirmation post-suppression)
```

> **Note dev :** la suppression S3 en batch peut être longue. Implémenter en job asynchrone (queue) avec timeout UI. Si le job échoue partiellement, les fichiers S3 orphelins seront nettoyés par un cron hebdomadaire (bucket lifecycle policy).

---

## 16.7 Routes de la section

| Méthode | Route | Action | Rôle requis |
|---------|-------|--------|-------------|
| GET | `/settings/organisation` | Page settings (rendu SSR) | DIRECTEUR |
| PATCH | `/api/settings/organisation` | Modifier nom/type/ville/logo | DIRECTEUR |
| GET | `/api/settings/organisation/membres` | Lister membres + invitations | DIRECTEUR |
| POST | `/api/settings/organisation/membres/inviter` | Inviter un membre | DIRECTEUR |
| PATCH | `/api/settings/organisation/membres/[userId]` | Changer le rôle | DIRECTEUR |
| DELETE | `/api/settings/organisation/membres/[userId]` | Retirer un membre | DIRECTEUR |
| GET | `/api/settings/organisation/facturation` | Infos plan + invoices Stripe | DIRECTEUR |
| PATCH | `/api/settings/organisation/facturation/email` | Modifier billingEmail | DIRECTEUR |
| POST | `/api/settings/organisation/facturation/portal` | Générer lien Stripe Portal | DIRECTEUR |
| DELETE | `/api/settings/organisation` | Supprimer l'organisation | DIRECTEUR |

> ⚠️ Toutes ces routes vérifient l'appartenance au scope de l'organisation en session. Un SUPER_ADMIN utilise `/api/admin/organisations/[id]` — routes distinctes.

---

## 16.8 Questions ouvertes

- **Sous-organisations / multi-établissements :** un grand théâtre national avec plusieurs salles aurait-il besoin de sous-orgs ? → À spécifier.
- **Audit log settings :** journaliser les changements de rôle et de plan dans `ActivityLog` → À implémenter (actions `MEMBER_ROLE_CHANGED`, `MEMBER_REMOVED`, `ORG_SETTINGS_UPDATED`).
- **Paramètres de notification par défaut :** définir à l'échelle de l'org les délais de rappel de confirmation (défaut 48h) → À spécifier.
- **SSO / SAML :** pour les clients ENTERPRISE → À spécifier.
