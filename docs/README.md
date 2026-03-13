# 🎭 SaaS Gestion du Spectacle Vivant — Documentation

> **Version :** 11.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale — Toutes les décisions validées, prête à coder

Un SaaS dédié aux structures du spectacle vivant (théâtres, compagnies, producteurs, salles de concert) pour planifier leurs spectacles, gérer leurs équipes artistiques et techniques, et donner à chaque collaborateur une visibilité claire sur son planning et sa rémunération.

---

## 📂 Structure de la documentation

| Fichier | Contenu | Thème |
|---------|---------|-------|
| [01 — Vision & Concepts](./01-vision-concepts.md) | Vision produit, problème résolu, glossaire métier complet | 🎯 Pourquoi |
| [02 — Rôles & Permissions](./02-roles-permissions.md) | 6 rôles détaillés, matrice des permissions | 👥 Qui |
| [03 — Workflows](./03-workflows.md) | 15 workflows (onboarding → DPAE → confirmation → iCal → annulations → remplacements) | 🔄 Comment |
| [04 — Pages, Interfaces & UX](./04-pages-interfaces-ux.md) | Wireframes ASCII, routes, expériences clés | 🖥️ Quoi (UI) |
| [05 — Modèles de données](./05-data-models.md) | Schémas complets, champs, relations (Prisma-ready) | 🗄️ Structure |
| [06 — Règles & Décisions](./06-regles-decisions.md) | 32 règles métier + 22 décisions techniques validées | 📋 Règles |
| [07 — Annuaire collaborateurs](./07-annuaire-collaborateurs.md) | Profil portable, fiche enrichie, spécialités | 📒 Collabs |
| [08 — Templates de projets](./08-templates-projets.md) | Créer/réutiliser des structures d'équipe | 📁 Templates |
| [09 — Dashboard Chef de poste](./09-chef-de-poste-dashboard.md) | 3 panneaux, alertes, actions rapides | 🎯 Chef |
| [10 — Remplacements urgents](./10-remplacements-urgents.md) | Workflow J-2, moteur de suggestion, traçabilité | ⚡ Urgences |
| [11 — Feuille de route & Logistique](./11-feuille-de-route-logistique.md) | Compagnon terrain mobile, phases de la journée, transport, contacts locaux | 🗺️ Terrain |
| [12 — Annulations & Reports](./12-annulations-reports.md) | 4 niveaux d'annulation, cachets, alertes DPAE, report de date | ❌ Annulations |
| [13 — Notifications](./13-notifications.md) | Centre de notifs, catalogue 16 types, groupement, priorités | 🔔 Notifs |
| [14 — Onboarding](./14-onboarding.md) | Inscription, wizard 3 étapes, checklist démarrage, états vides | 🚀 Onboarding |
| [15 — Schéma Prisma](./15-schema-prisma.md) | Schéma Prisma complet prêt à migrer, enums, index, checklist | 🗃️ Prisma |
| [16 — Paramètres organisation](./16-settings-organisation.md) | `/settings/organisation` — profil, membres, facturation Stripe, suppression | ⚙️ Settings |
| [17 — Back-office SUPER_ADMIN](./17-back-office-super-admin.md) | `/admin` — dashboard, orgs, plans, suspension, logs, admins | 🛠️ Admin |
| [18 — Webhooks Stripe](./18-webhooks-stripe.md) | Événements Stripe → plan, paiement échoué, trial, suspension | 💳 Stripe |
| [19 — Module Tournée](./19-module-tournee.md) | Hébergement, rooming list, flotte, préférences collaborateur | 🚌 Tournée |
| [20 — Plans tarifaires](./20-plans-tarifaires.md) | FREE / PRO / ENTERPRISE — tiers, limites, trial 14j, blocage quota | 💳 Plans |
| [21 — Cron Jobs](./21-cron-jobs.md) | 7 tâches planifiées — relances, DPAE J-1, trial, RGPD, nettoyage | ⏰ Crons |
| [22 — Paramètres compte](./22-settings-compte.md) | `/settings` — profil, sécurité, préférences, token iCal | 👤 Compte |
| [23 — Architecture technique](./23-architecture-technique.md) | Session multi-org, JWT plan, isReadOnly/IDOR guards, soft delete, erreurs API, lib/plans.ts, SSE, S3 | 🏗️ Archi |
| [24 — Templates Email](./24-emails-templates.md) | Catalogue Resend — 16 templates, variables, déclencheurs, lib/email.ts | 📧 Emails |

---

## ⚡ Accès rapide par rôle

| Je suis… | Je consulte en priorité |
|----------|------------------------|
| **Développeur back-end** | [Architecture technique](./23-architecture-technique.md) → [Emails](./24-emails-templates.md) → [Schéma Prisma](./15-schema-prisma.md) → [Modèles de données](./05-data-models.md) → [Règles & Décisions](./06-regles-decisions.md) → [Workflows](./03-workflows.md) |
| **Développeur front-end** | [Pages & Interfaces](./04-pages-interfaces-ux.md) → [Workflows](./03-workflows.md) → [Rôles](./02-roles-permissions.md) |
| **Designer / UX** | [Pages & Interfaces](./04-pages-interfaces-ux.md) → [Dashboard Chef de poste](./09-chef-de-poste-dashboard.md) → [Vision](./01-vision-concepts.md) |
| **Product / PO** | [Vision & Concepts](./01-vision-concepts.md) → [Règles & Décisions](./06-regles-decisions.md) → tous les fichiers |
| **Nouveau sur le projet** | Lire dans l'ordre : 01 → 02 → 03 → 04 |

---

## 🗝️ Glossaire express

| Terme | Définition rapide |
|-------|-------------------|
| **Projet** | Un spectacle ou une production (ex: Peter Pan, Garou Tournée 2026) |
| **Représentation** | Une occurrence unique d'un projet : un jour, un lieu, des horaires |
| **Affectation** | L'assignation d'un collaborateur à une représentation pour un poste |
| **Poste requis** | Un besoin en personnel sur un projet (ex: "2 Éclairagistes") |
| **Équipe** | Sous-groupe de postes/collaborateurs sous un Chef de poste |
| **Chef de poste** | Responsable d'une équipe sur un projet donné (rôle par projet) |
| **Cachet** | Rémunération forfaitaire par représentation (intermittents) |
| **DPAE** | Déclaration Préalable À l'Embauche — obligatoire avant 1ère prestation |
| **Compte GHOST** | Collaborateur invité sans mot de passe — accès via magic links uniquement |
| **Magic link** | Lien email temporaire donnant accès sans connexion (UUID, usage unique) |
| **Confirmation atomique** | Chaque date confirmée/refusée indépendamment, effet immédiat |

---

## 🏗️ Stack technique décidée

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 14 (App Router) + TypeScript |
| ORM | Prisma + PostgreSQL |
| Auth | NextAuth.js + Lazy Auth (magic links) |
| Stockage | AWS S3 + signed URLs (expiration 1h) |
| Emails | Resend (SDK TypeScript, intégration native Next.js) |
| Temps réel | Server-Sent Events (SSE) — mises à jour grille planning |
| Paiement | Stripe (abonnement mensuel par org) |
| Déploiement | Vercel (front + API) + Railway (PostgreSQL) |

---

## 📌 Décisions clés en un coup d'œil

| # | Décision |
|---|----------|
| ✅ | Abonnement mensuel par organisation (pas par utilisateur) |
| ✅ | Confirmation d'affectation atomique — date par date, effet immédiat |
| ✅ | Lazy Auth — compte fantôme (GHOST) → activation volontaire |
| ✅ | Salle variable par représentation (pas de salle fixe par projet) |
| ✅ | Export iCal (abonnement permanent) + CSV paie (SAGE/Cegid) |
| ✅ | RGPD : anonymisation après 3 ans d'inactivité |
| ✅ | Créneaux horaires : Get-in / Warmup / Show / Get-out |
| ✅ | 9 types de projets (Théâtre, Concert, Cirque, Maintenance...) |
| ✅ | 3 niveaux de rôles : plateforme (User.role) · organisation (OrganizationMembership) · équipe (EquipeMembre) |
| ✅ | Plans tarifaires : FREE (0€/3 collabs) · PRO (49€/20 collabs) · ENTERPRISE (149€/illimité) |
| ✅ | Trial 14 jours PRO à l'inscription · Resend pour les emails · Vercel + Railway |
| ❌ | Pas de dark mode · Pas de SMS · Interface français uniquement |

---

*Documentation v12.0 — Mise à jour : 02/03/2026*
