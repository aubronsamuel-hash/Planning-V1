# 🗺️ Roadmap de Développement — SaaS Spectacle Vivant

> **Version :** 2.0 · **Date :** 07/03/2026 · **Statut :** ✅ Alignée spec v12.0
>
> Roadmap de développement complet, du setup initial jusqu'à la mise en production. Chaque item référence le doc et les règles correspondantes pour ne rien inventer.

---

## ⚙️ Phase 0 — Setup & Infrastructure ✅ *(Complète — Session 36)*

Socle technique sur lequel tout le reste repose.

- [x] Init projet Next.js 14 App Router + TypeScript strict
- [x] Configurer Prisma + PostgreSQL (Railway) — `prisma/schema.prisma` 809 lignes + `lib/prisma.ts` extension soft delete
- [x] Configurer NextAuth.js — session multi-org JWT (`app/api/auth/[...nextauth]/route.ts` + `types/next-auth.d.ts`)
- [x] Middleware global : auth guard + `organizationId` scope + `isReadOnly` check (`middleware.ts`)
- [x] Middleware Prisma : soft delete automatique (`WHERE deletedAt IS NULL`) (`lib/prisma.ts` — extension `$extends`)
- [x] Créer la structure `lib/` : `auth.ts` (getUserContext) · `plans.ts` · `email.ts` · `notifications.ts` · `upload.ts` · `api-response.ts` · `event-bus.ts`
- [x] Configurer Resend (emails transactionnels) + variables d'env (`lib/email.ts` + `.env.example`)
- [x] Configurer AWS S3 + presigned URLs (expiration 1h) (`lib/upload.ts` — Règle #10)
- [x] Layout global : sidebar, switcher d'organisation, centre de notifications (`app/(app)/layout.tsx` + `components/layout/`)

---

## 🔐 Phase 1 — Auth & Onboarding ✅ *(Complète — Session 38)*

Aucune fonctionnalité métier n'est accessible sans cette phase.

- [x] Page `/signup` — création User + Organization (plan: PRO, trial 14j) (`app/api/auth/signup/route.ts` + `app/(public)/signup/page.tsx`)
- [x] Système Magic Links — génération, usage unique, expiration par purpose (`docs/06 Règle #17`)
  - `LOGIN` 15min · `EMAIL_CHANGE` 24h · `CONFIRMATION | ACTIVATION | PLANNING_VIEW` 7j · `DOCUMENT_ACCESS` 1h
  - (`app/api/auth/magic-link/send/route.ts` + `app/api/auth/magic-link/verify/route.ts`)
- [x] Lazy Auth — comptes GHOST par défaut, activation volontaire ACTIVE (`docs/06 Règle #16`) — (`app/api/onboarding/equipe/route.ts`)
- [x] Wizard d'onboarding 3 étapes (`/onboarding`) + checklist démarrage (`docs/14`) — (`app/(app)/onboarding/` + 4 routes API)
- [x] Page `/login` — magic link email (pas de mot de passe) (`app/(public)/login/page.tsx` + `app/(public)/login/verify/page.tsx`)
- [x] Switcher multi-organisation — refresh JWT sur changement de contexte (`docs/23 §23.1`) — (`app/api/auth/switch-org/route.ts`)
- [x] Routes publiques — `/affectation/[token]/confirmer` · `/mon-planning/view/[token]` · `/documents/view/[token]` (`docs/04`)
  - (`app/(public)/affectation/[token]/confirmer/page.tsx` + `app/api/affectations/confirmer/route.ts`)
  - (`app/(public)/mon-planning/view/[token]/page.tsx` + `app/api/planning/view/route.ts`)
  - (`app/(public)/documents/view/[token]/page.tsx` + `app/api/documents/view/route.ts`)

---

## 🎭 Phase 2 — Cœur métier : Projets & Affectations ✅ *(Complète — Session 39)*

La grille d'affectation est la fonctionnalité centrale de tout le produit.

- [x] **Projets** — CRUD complet, 9 types, palette 12 couleurs, statuts (`docs/03 §5.2`, Règle #34)
- [x] **Représentations** — ajout unitaire + création en série, créneaux Get-in/Warmup/Show/Get-out (`docs/03 §5.3`)
- [x] **Équipes & Postes requis** — structure équipes, `isCritique`, héritage horaires (`docs/05`, Règle #19)
- [x] **Grille d'affectation** — vue régisseur, drag & drop, filtres par équipe (`docs/04`)
- [x] **Détection de conflits horaires** — calcul cross-minuit, ⚠️ non-bloquant, `hasConflict = true` (Règles #2, #20, #22)
- [x] **Affecter un collaborateur** — CDI/CDD/Intermittent, statuts corrects à la création (Règle #3 et Décision session 9)
- [x] **Confirmation atomique intermittents** — token UUID 7j, page sans connexion, mise à jour temps réel (`docs/03 §5.5`, Règles #14, #15)
- [x] **SSE — mises à jour temps réel** — grille régisseur reçoit les confirmations en push (`docs/23`, Décision #16)
- [x] **Statut visuel planning global** — 🟢🟡🔴 calculé à la volée par `hasPosteCritiqueManquant` (Règle #33)
- [x] **DPAE** — génération automatique item "à faire" pour tout intermittent/CDD, sans exception (Règle #3)

---

## 👥 Phase 3 — Collaborateurs, Planning & Notifications ✅ *(Complète — Session 40)*

- [x] **Annuaire collaborateurs** — liste `/equipe`, fiche enrichie, spécialités, recherche (`docs/07`)
- [x] **Inviter un collaborateur** — création compte GHOST + magic link + email (`docs/03 §5.6`, Règle #8)
- [x] **Planning personnel** `/mon-planning` — vue collaborateur, ses représentations, rémunération (`docs/04`)
- [ ] **Export iCal** — snapshot `.ics` + lien d'abonnement dynamique, affectations CONFIRMEE uniquement (Règle #12, Décision #9)
- [x] **Notifications in-app** — centre de notifs, catalogue 16 types, groupement, priorités (`docs/13`)
- [x] **Emails transactionnels** — 16 templates Resend : invitation, confirmation, annulation… (`docs/24`)
- [x] **Dashboard Chef de poste** — 3 panneaux, alertes CRITIQUE/URGENT/PLANIFIER (`docs/09`)
- [x] **Templates de projets** — sauvegarder/appliquer une structure d'équipe (`docs/08`)

---

## 💰 Phase 4 — RH, Plans & Facturation ✅ *(Complète — Session 40)*

- [x] **Dashboard RH** — suivi DPAE (À faire / Envoyée / Confirmée), alertes, tableau par projet (`docs/03 §5.10`)
- [x] **Export CSV paie** — colonnes : Nom, Prénom, N° SS (masqué), Type contrat, Date, Projet, Poste, Cachet HT, DPAE (Règle #11, Décision #2)
- [x] **Données sensibles** — chiffrement AES-256 N° SS + IBAN via `lib/crypto.ts`, déchiffrement RH uniquement (Règle #9)
- [x] **Plans tarifaires** — lib/plans.ts complet, guard quota dans `/api/collaborateurs/inviter`, `isReadOnly` (Règles #28, #32, `docs/20`)
- [x] **Stripe** — `/api/billing/checkout`, `/api/billing/portal`, webhooks complets (payment_failed/succeeded, subscription updated/deleted, invoice.finalized) (`docs/18`)
- [x] **Paramètres organisation** `/settings/organisation` — profil, membres, facturation Stripe, danger zone (Règle #7 Dernier Directeur, `docs/16`)
- [x] **Paramètres compte** `/settings/compte` — profil, sécurité, préférences, token iCal + feed iCal RFC 5545 (`docs/22`)
- [x] **Back-office SUPER_ADMIN** `/admin` — dashboard stats, liste orgs, fiche org, changer plan, suspendre/réactiver, logs d'activité (`docs/17`)

---

## ⚡ Phase 5 — Modules Avancés

- [ ] **Remplacements urgents** — workflow J-48h, scoring algo, `PropositionRemplacement`, `ActivityLog` (Règle #23, `docs/10`)
- [ ] **Annulations & Reports** — 4 niveaux (affectation, représentation, projet, report), cachets `A_DECIDER`, alertes DPAE (Règles #24, #25, #26, #27, `docs/12`)
- [ ] **Feuille de route logistique** `/feuille-de-route` — compagnon terrain, phases, contacts (`docs/11`)
- [ ] **Module Tournée** — hébergement, rooming list, flotte, préférences collab (`docs/19`)
- [ ] **Navigation multi-organisation** — switcher complet, notifications filtrées par org active (Règle #30)

---

## 🚀 Phase 6 — Cron Jobs, RGPD & Production

- [ ] **Cron jobs Vercel** — 7 jobs configurés dans `vercel.json` (`docs/21`)
  - `§21.1` Relances confirmations (48h, 1 seule par affectation — Règle #31)
  - `§21.2` Alertes DPAE J-1 (veille de représentation)
  - `§21.3` Expiration trial (+ reminder J-3 avec guard `trialReminderSentAt`)
  - `§21.4` Expiration `PropositionRemplacement` → `EXPIREE`
  - `§21.5` RGPD — anonymisation après 3 ans d'inactivité + email avertissement J-30 (Règle #13)
  - `§21.6` Archivage projets terminés
  - `§21.7` Nettoyage `MagicLinkToken` expirés (`WHERE expiresAt < now()`)
- [ ] **RGPD** — page politique de confidentialité + procédure droit à l'oubli
- [ ] **Monitoring** — Sentry (erreurs) + Logtail (logs API)
- [ ] **Backup BDD** — backup journalier PostgreSQL Railway activé
- [ ] **Checklist mise en production** — voir `Checklist Audit md.md`

---

## ❌ Hors scope v1 (ne pas implémenter)

| Ce qu'on ne fait PAS | Pourquoi |
|----------------------|----------|
| Dark mode | Décision #5 — gain de temps dev |
| Notifications SMS | Décision #8 — email + in-app suffisent |
| Interface en anglais | Décision #7 — PMF marché local d'abord |
| Application mobile native | `docs/01` — web responsive uniquement |
| Mode hors-ligne (Service Worker) | Non spécifié, hors scope v1 |
| Gestion de billetterie | `docs/01` |
| Bulletins de paie officiels | `docs/01` — rémunération prévisionnelle uniquement |
| Webhooks Stripe pour le trial | Décision session 9 — trial 100% app-side, `stripeCustomerId IS NULL` |

---

*Roadmap v2.0 — Alignée spec v12.0 — Mise à jour : 09/03/2026 (Session 40 — Phase 3 complète, iCal restant Phase 3/4)*
*Pour les règles métier : `docs/06-regles-decisions.md` · Pour l'archi : `docs/23-architecture-technique.md`*
