# 🧠 Mémoire Claude — SaaS Spectacle Vivant
> Fichier interne — à lire en priorité au début de chaque session.
> Dernière mise à jour : 07/03/2026 — Session 38

---

## Ce qu'on construit

Un **SaaS B2B multi-tenant** pour le spectacle vivant français (théâtres, compagnies, producteurs, salles de concert). Il permet de planifier des spectacles, gérer des équipes artistiques/techniques, et donner aux collaborateurs (intermittents, CDD, CDI) une visibilité sur leur planning et leur rémunération.

**Utilisateur principal (power user) :** le Régisseur — il passe ses journées dans la grille d'affectation.

---

## État de la spec

**Version actuelle : v11.0** — documentation dans `docs/` (23 fichiers + README)

### Fichiers racine hors docs/

| Fichier | Contenu |
|---------|---------|
| `CLAUDE_MEMORY.md` | Mémoire Claude — à lire en priorité |
| `CLAUDE.md` | Vide (placeholder) |
| `SPECIFICATION.md` | Résumé spec initiale (stale — référence uniquement) |
| `Checklist Audit md.md` | Checklist mise en production (Sécurité, Billing, Métier, Technique) — corrigée session 30 |
| `Roadmap de Lancement.md` | Roadmap 3 phases (Consolidation, Mobile, Conformité RH) — corrigée session 30 |

### Fichiers et ce qu'ils contiennent

| Fichier | Contenu résumé | Lignes |
|---------|---------------|--------|
| `docs/README.md` | Index master, glossaire, stack, décisions clés | ~90 |
| `docs/01-vision-concepts.md` | Vision, problème résolu, 9 types de projets, créneaux | ~143 |
| `docs/02-roles-permissions.md` | 6 rôles, matrice permissions 6 colonnes | ~162 |
| `docs/03-workflows.md` | 17 workflows §5.1→§5.17 (onboarding, projet, représentations, équipes, lazy auth, confirmation, refus, iCal, DPAE, rémunération, remplacement urgent, annulations ×3, report, changement email, cycle vie collaborateur) | ~668 |
| `docs/04-pages-interfaces-ux.md` | Wireframes pages transverses §6.1→§6.10, **table master des routes**, UX clés §11.1→§11.4 (dont empty states) | ~1000 |
| `docs/05-data-models.md` | Tous les modèles Prisma-ready, champs, relations | ~235 |
| `docs/06-regles-decisions.md` | 34 règles métier + 22 décisions techniques (Règle #2 conflit avertissement, #3 DPAE chaque engagement, #16 GHOST Collaborateur.accountStatus, #31 route relancer) | ~110 |
| `docs/07-annuaire-collaborateurs.md` | Vue liste `/equipe`, fiche enrichie, spécialités, recherche | ~169 |
| `docs/08-templates-projets.md` | Templates de projets (structure + équipes suggérées) | ~156 |
| `docs/09-chef-de-poste-dashboard.md` | Dashboard 3 panneaux, alertes CRITIQUE/URGENT/PLANIFIER | ~183 |
| `docs/10-remplacements-urgents.md` | Workflow J-48h, scoring algo, PropositionRemplacement | ~203 |
| `docs/11-feuille-de-route-logistique.md` | Compagnon terrain mobile, phases, transport texte, contacts | ~246 |
| `docs/12-annulations-reports.md` | 4 niveaux annulation, cachets, DPAE alerte, report | ~326 |
| `docs/13-notifications.md` | Centre notifs, dropdown, catalogue 16 types, groupement, priorités | ~200 |
| `docs/14-onboarding.md` | /signup, wizard 3 étapes, checklist démarrage, états vides par page | ~200 |
| `docs/15-schema-prisma.md` | **Schéma Prisma complet** — enums, models, index, checklist migration | ~300 |
| `docs/16-settings-organisation.md` | `/settings/organisation` — profil, membres, Stripe, danger zone | ~280 |
| `docs/17-back-office-super-admin.md` | `/admin` — dashboard, orgs, plans, suspension, logs, admins | ~280 |
| `docs/18-webhooks-stripe.md` | Événements Stripe → plan, paiement échoué, trial, suspension | ~230 |
| `docs/19-module-tournee.md` | Hébergement, rooming list, flotte, préférences collab, Prisma | ~310 |
| `docs/20-plans-tarifaires.md` | Plans FREE/PRO/ENTERPRISE — tiers, limites, trial 14j, blocage quota, lib/plans.ts | ~130 |
| `docs/21-cron-jobs.md` | 7 cron jobs — relances, DPAE J-1, trial expiration, tokens, RGPD, archivage, postes | ~150 |
| `docs/22-settings-compte.md` | `/settings` — profil, sécurité (mdp/2FA), préférences, token iCal | ~110 |
| `docs/23-architecture-technique.md` | **Session multi-org JWT, soft delete middleware Prisma, format erreur API, lib/plans.ts, SSE, S3** | ~380 |

**Règle de base :** chaque module a ses wireframes dans son propre fichier. `04` ne contient que les pages transverses (dashboard, projets, planning global, planning collab, rémunération collab) + la table master des routes.

---

## Architecture technique décidée

| Couche | Choix |
|--------|-------|
| Framework | Next.js 14 App Router + TypeScript |
| ORM | Prisma + PostgreSQL |
| Auth | NextAuth.js + Lazy Auth (magic links) |
| Stockage | AWS S3 + signed URLs (1h) |
| Temps réel | SSE — Server-Sent Events pour la grille planning |
| Emails | **Resend** — SDK TypeScript, décision #18 |
| Paiement | Stripe (abonnement mensuel par org) |

---

## Architecture des rôles (critique — 3 niveaux distincts)

```
Niveau 1 — Plateforme
  User.role: SUPER_ADMIN | MEMBER

Niveau 2 — Organisation
  OrganizationMembership.role: DIRECTEUR | REGISSEUR | RH | COLLABORATEUR
  ⚠️ CHEF_POSTE n'est PAS ici

Niveau 3 — Équipe/Projet
  EquipeMembre.role: CHEF | MEMBRE
  → C'est ici qu'on devient "Chef de poste" sur une équipe spécifique
```

Un COLLABORATEUR peut être CHEF sur une équipe sans changer son rôle d'organisation.

---

## Modèles de données clés (résumé des points délicats)

**Tokens magic link — système unifié :**
```
MagicLinkToken
├── purpose: CONFIRMATION | DOCUMENT_ACCESS | PLANNING_VIEW | ACTIVATION
└── Un seul système, pas de token dupliqué sur Affectation
⚠️ Affectation n'a PAS de confirmationToken — c'est MagicLinkToken qui gère tout
```

**Affectation.confirmationStatus :**
```
EN_ATTENTE | CONFIRMEE | REFUSEE | NON_REQUISE | ANNULEE | ANNULEE_TARDIVE
```

**Affectation.heuresContrat** (feature session 30) :
```
heuresContrat: Int?   ← heures déclarées au contrat (intermittents & CDD)
null pour CDI — usage : suivi quota Pôle Emploi / Caisse des Congés Spectacles
Affiché dans §5.10 Vue rémunération (colonne "Heures")
```

**Affectation.cachetAnnulation** (nouveau — section 12) :
```
null (si non annulée) | A_DECIDER | DU | ANNULE
→ Rempli seulement quand confirmationStatus = ANNULEE | ANNULEE_TARDIVE
→ Le RH tranche manuellement, l'app ne présuppose rien
```

**Representation.status** (nouveau — section 12) :
```
PLANIFIEE | CONFIRMEE | ANNULEE | REPORTEE
+ annulationReason: String?
+ annulationAt: DateTime?
+ reporteeVersId: String?   ← lien vers la nouvelle représentation si reportée
```

**Types de temps :**
```
Representation.date → Date (sans heure)
Tous les créneaux → String "HH:MM"  (getInTime, showStartTime, etc.)
Cross-minuit : si endTime < startTime → ajouter 24h au endTime pour le calcul
```

**Projet.type enum :**
```
THEATRE | COMEDIE_MUSICALE | CONCERT | OPERA | DANSE | CIRQUE | MAINTENANCE | EVENEMENT | AUTRE
```

**Projet.status enum :**
```
EN_PREPARATION | EN_COURS | TERMINE | ARCHIVE | ANNULE
```

**Collaborateur.accountStatus :** *(⚠️ ce n'est PAS sur User — User.role vaut TOUJOURS `MEMBER`)*
```
GHOST   → pas de mdp, accès magic links uniquement
ACTIVE  → compte complet avec mot de passe
INACTIF → désactivé manuellement par RH/Directeur (historique conservé)
+ ghostCreatedAt: DateTime? · activatedAt: DateTime? (sur Collaborateur, pas sur User)
```

---

## Ce qui a été fait session par session

### Sessions précédentes
- Spec initiale v1→v6 (monolithique, ~1983 lignes)
- Ajout sections : Annuaire (07), Templates (08), Dashboard Chef de poste (09), Remplacements urgents (10)
- Fix matrice permissions (6 colonnes avec Chef de poste)
- Ajout workflow iCal (5.8)
- Bump v7.0

### Cette session (28/02/2026)
1. **Review senior dev** → 12 bugs architecturaux corrigés (roles, tokens, champs, enums, workflows)
2. **Split `docs/`** → monolithe → 11 fichiers thématiques + README
3. **Feuille de route (11)** → section créée, rooming list déférée (Module Tournée v2)
4. **Annulations & Reports (12)** → 4 niveaux (affectation, représentation, projet, report), cachets manuels, alertes DPAE
5. **Refacto `04`** → `§6.5` migré vers `07`, 5 sections routes → 1 table master
6. **Fix `07`** → numérotation 7.1→7.6, `CHEF_POSTE` retiré de `OrganizationMembership.role`

### Session 3 (28/02/2026 — peaufinage)
7. **Fix `05`** → 3 bugs corrigés : `confirmationToken` retiré d'Affectation, `ANNULEE` ajouté à `ConfirmationStatus`, `REPORTEE` ajouté à `RepresentationStatus`, champs `annulationReason/At/reporteeVersId` ajoutés à Representation, `cachetAnnulation` ajouté à Affectation
8. **Schéma Prisma (15)** → `docs/15-schema-prisma.md` créé — tous les modèles, enums, relations, index, checklist migration, note Module Tournée v2
9. **Settings organisation (16)** → `docs/16-settings-organisation.md` créé — 4 sections (profil, membres, Stripe, danger zone), wireframes, routes API, règle #7 Dernier Directeur, cascade suppression
10. **Back-office SUPER_ADMIN (17)** → `docs/17-back-office-super-admin.md` créé — dashboard, fiche org, changer plan, suspension, suppression, logs, gestion admins · `suspendedAt/suspendedReason` ajoutés à `Organization` dans `05` et `15`
11. **Webhooks Stripe (18)** → `docs/18-webhooks-stripe.md` créé — 6 événements (subscription updated/deleted, payment failed/succeeded, invoice finalized, trial ending) · `paymentFailedAt/trialEndsAt` ajoutés à `Organization` dans `05` et `15`
12. **Section 12 complétée** → wireframes ASCII ajoutés : modal annulation affectation (simple + tardive), menu contextuel grille, modal annulation projet, page RH `/projets/[id]/annulations` avec tableau cachets, bandeau dashboard RH, routes API complètes
13. **Module Tournée (19)** → `docs/19-module-tournee.md` créé — hébergement (rooming list, chambres, envoi email hôtel), flotte (véhicules, assignations, passagers), préférences collaborateur, intégration feuille de route, 19 routes API, 7 nouveaux modèles Prisma ajoutés dans `05`

### Session 8 (01/03/2026 — audit final cross-fichiers — 13 bugs corrigés)
44. **Bug 1** → `12` §12.5 : `Affectation.dpaeStatus = SOUMISE` → `IN ('ENVOYEE', 'CONFIRMEE')` — `SOUMISE` n'existe pas dans l'enum `DpaeStatus` (valeurs : `A_FAIRE | ENVOYEE | CONFIRMEE | NON_REQUISE`)
45. **Bug 2** → `13` §13.4 : `RAPPEL_CONFIRMATION` timing `J-3` → `48h` — aligné avec `03` §5.6 et `21` §21.1 (cron 48h)
46. **Bug 3** → `16` §16.3 : types de structure harmonisés avec `14` §14.1 — ajout "Compagnie de danse", "Compagnie théâtrale", "Festival"
47. **Bug 4** → `15` note Module Tournée : `VehiculeFlotte` → `Vehicule, VehiculeAssignment, VehiculePassager` (noms réels des modèles dans `05` et `19`)
48. **Bug 5** → `21` §21.7 : `PosteRequis.quantite` → `requiredCount` — champ inexistant (`requiredCount` dans `05` et `15`)
49. **Bug 6** → `21` §21.4 : cron nettoyage tokens — supprimait uniquement `usedAt IS NULL`, les tokens utilisés expirés s'accumulaient en base. Condition simplifiée en `WHERE expiresAt < now()` sans filtre `usedAt`
50. **Bug 7** → `03` §5.7 : critère anonymisation RGPD comptes ACTIVE — "aucune connexion" → "aucune affectation" (aligné sur `06` Règle #13 et `21` §21.5)
51. **Bug 8+9 (CRITIQUE)** → `14` §14.1 et `03` §5.1 : trial jamais initialisé dans le signup — ajouté `Organization créée (plan: PRO, trialEndsAt: now() + 14 jours)` dans les deux fichiers + note explicative dans `14` (trial 100% app-side, `stripeCustomerId IS NULL` pendant tout le trial, cron `21.3` seul mécanisme d'expiration)
52. **Bug 10** → `18` §18.3 : `FREE_PRICE_ID → OrganizationPlan.FREE` supprimé — FREE n'a pas de price_id Stripe, la résiliation est gérée par `subscription.deleted` (§18.4). Ajout d'un guard "price_id inconnu → log erreur + alerter SUPER_ADMIN"
53. **Bug 11** → `21` §21.1 : cron relance — ajout filtre `AND contractTypeUsed = 'INTERMITTENT'` — évite d'envoyer un magic link de confirmation à des CDI/CDD (qui n't'ont pas de flux magic link de confirmation)
54. **Bug 12** → `04` "Accès public" : routes manquantes pour les purposes `PLANNING_VIEW` et `DOCUMENT_ACCESS` — ajout `/mon-planning/view/[token]` et `/documents/view/[token]`
55. **Bug 13** → `04` table master : `/notifications` manquant dans "Espace organisation" + `POST /api/affectations/batch` manquant dans "API & exports" (nécessaire pour "Affecter en série" §11.1)

### Session 9 (01/03/2026 — audit pass 3 — 6 bugs corrigés)
56. **Bug 14 (CRITIQUE)** → `21` §21.4 : `PropositionRemplacement` jamais mise à `EXPIREE` — le cron nettoyait uniquement `MagicLinkToken`, les propositions EN_ATTENTE restaient en base pour toujours. Ajout d'un `UPDATE PropositionRemplacement SET status = 'EXPIREE' WHERE expiresAt < now() AND status = 'EN_ATTENTE'`
57. **Bug 15 (MOYEN)** → `21` §21.3 : `org.collaborateurCount` n'est pas un champ DB — remplacé par `COUNT(OrganizationMembership WHERE organizationId = org.id AND role = 'COLLABORATEUR')`
58. **Bug 16 (IMPORTANT)** → `20` §20.3 et `18` §18.7 : le webhook Stripe `customer.subscription.trial_will_end` est **impossible** en v1 (trial 100% app-side, `stripeCustomerId IS NULL`, Stripe n'a aucun client à notifier). Note corrigée dans `20.3` et `18.7` : J-3 géré exclusivement par cron `21.3`. `18.7` clarifié comme "prévu v2 uniquement".
59. **Bug 17 (CRITIQUE)** → `03` §5.5 : aucun fichier ne spécifiait les valeurs à passer explicitement à la création d'une affectation CDI/CDD. Les `@default` Prisma (`EN_ATTENTE`, `A_FAIRE`) sont incorrects pour CDI/CDD. Ajout d'une note explicite : CDI → `confirmationStatus = NON_REQUISE` + `dpaeStatus = NON_REQUISE` ; CDD → `confirmationStatus = NON_REQUISE` + `dpaeStatus = A_FAIRE`.
60. **Bug 18 (IMPORTANT)** → `21` §21.3 Étape 1 : condition `WHERE trialEndsAt BETWEEN now() AND now() + 3 days` envoyait un email pour J-1, J-2 ET J-3 (3 emails). Ajout du guard `AND trialReminderSentAt IS NULL` + `Organization.trialReminderSentAt = now()` après envoi. Nouveau champ `trialReminderSentAt DateTime?` ajouté dans `05`, `15`, `20`, `21`.
61. **Bug 19 (MINEUR)** → `15` : enum `NotificationChannel { IN_APP, EMAIL }` défini mais non référencé par aucun modèle Prisma. Supprimé du schéma — le canal est de la logique applicative TypeScript, pas une valeur persistée par notification.

### Session 28 (06/03/2026 — passe senior remplacements urgents — 4 bugs corrigés dans 10)
169. **R10-1 (IMPORTANT)** → `10` §10.3 : aucun `ActivityLog` dans tout le workflow remplacement. Les trois valeurs `REMPLACEMENT_PROPOSE`, `REMPLACEMENT_ACCEPTE`, `REMPLACEMENT_REFUSE` existent dans l'enum `ActivityLogAction` de `15` mais n'étaient jamais appelées dans la spec `10`. Ajoutés aux trois moments-clés du workflow.
170. **R10-2 (IMPORTANT)** → `10` §10.3 : la nouvelle affectation créée quand le candidat accepte était `CONFIRMEE` sans mention de `dpaeStatus`. Règle #3 = DPAE requise à chaque engagement INTERMITTENT/CDD. Ajouté : `dpaeStatus = A_FAIRE` si INTERMITTENT|CDD · `dpaeStatus = NON_REQUISE` si CDI. Aussi ajouté `remplaceDe = <id affectation annulée>` et `PropositionRemplacement.status = ACCEPTEE/REFUSEE` dans les branches.
171. **R10-3 (MOYEN)** → `10` §10.3 : passage à `EXPIREE` attribué implicitement à un timer temps-réel. Précisé : c'est le **cron §21.4 (horaire)** qui marque les propositions expirées — l'expiration n'est pas instantanée, délai max = prochain tour du cron.
172. **R10-4 (MOYEN)** → `10` §10.5 : labels `(extension)` sur `Affectation`, `NotificationType` et `PropositionRemplacement` datant de la v7.0. Trompeurs — ces éléments sont déjà dans le schéma de base `15`. Labels supprimés, renvois à `15` ajoutés. `remplaceDe: Affectation?` corrigé en `remplaceDe: String?` (c'est la FK, pas la relation).

### Session 29 (06/03/2026 — passe senior annulations & reports — 5 bugs corrigés dans 12)
173. **A12-1 (CRITIQUE)** → `12` §12.1 workflow : `annulationRaison` et `annulationDate` jamais persistés. Le modal propose un champ "Raison" mais le workflow ne sauvegardait pas ces champs sur `Affectation`. Ajoutés après la mise à jour du `confirmationStatus`.
174. **A12-2 (CRITIQUE)** → `12` §12.1 workflow : `ActivityLog: AFFECTATION_ANNULEE` sans distinction du sous-cas. L'enum `15` possède `AFFECTATION_ANNULEE` (> 48h) et `AFFECTATION_ANNULEE_TARDIVE` (≤ 48h). Le workflow précise maintenant lequel utiliser selon le délai.
175. **A12-3 (CRITIQUE)** → `12` §12.2 workflow : `ActivityLog: REPRESENTATION_ANNULEE` complètement absent du workflow d'annulation d'une représentation. Ajouté avec `(representationId, nbAffectationsImpactees)`.
176. **A12-4 (CRITIQUE)** → `12` §12.4 workflow : `ActivityLog: REPRESENTATION_REPORTEE` absent du workflow de report. Ajouté. Aussi ajouté `annulationAt = now()` sur l'ancienne Representation (champ horodatage du report, cohérent avec §12.5).
177. **A12-5 (MODÉRÉ)** → `12` §12.6 wireframe page RH : Carol L. (CDD) affichait "NON REQUISE" pour la DPAE — contredit Règle #3 (dpaeStatus = A_FAIRE pour tout INTERMITTENT ou CDD). Corrigé en `❌ Non soumise`. Règle d'affichage affinée : CDI/CDD → `—` pour cachet uniquement, la colonne DPAE reste active pour CDD.

### Session 30 (06/03/2026 — passe senior workflows — 7 bugs corrigés dans 03 + feature heuresContrat)
178. **W03-1 (CRITIQUE)** → `03` ligne 356 : commentaire dev stale `"idder sam : ajouter aussi le nombre dheure déclarer dans le contrat ?"` laissé dans la spec — supprimé.
179. **W03-2 (CRITIQUE)** → `03` §5.12 CAS B : `ActivityLog: AFFECTATION_ANNULEE` pour une annulation tardive — doit être `AFFECTATION_ANNULEE_TARDIVE`. Même bug qu'A12-2 dans `12`, présent en miroir dans `03`. Corrigé.
180. **W03-3 (MODÉRÉ)** → `03` §5.12 CAS A + CAS B : `annulationRaison` et `annulationDate` jamais persistés dans le workflow. Même bug qu'A12-1. Les deux champs ajoutés dans les deux cas.
181. **W03-4 (CRITIQUE)** → `03` §5.13 : `ActivityLog: REPRESENTATION_ANNULEE` absent du workflow d'annulation de représentation. Même bug qu'A12-3. Ajouté avec `(representationId, nbAffectationsImpactees)`.
182. **W03-5 (CRITIQUE)** → `03` §5.15 : `ActivityLog: REPRESENTATION_REPORTEE` absent + `annulationAt = now()` manquant sur l'ancienne représentation lors d'un report. Même bug qu'A12-4. Les deux ajoutés.
183. **W03-6 (MODÉRÉ)** → `03` §5.16 : note "EMAIL_CHANGED non encore présent dans `15`" périmée — l'enum `15` contient déjà `EMAIL_CHANGED` depuis la session 23. Note remplacée par "✅ présent".
184. **W03-7 (CRITIQUE)** → `03` §5.17 CAS B + diagramme modèle : `User créé : { email, role: GHOST }` — `User.role` ne peut jamais être GHOST (c'est `Collaborateur.accountStatus`, jamais `User.role` qui vaut toujours MEMBER). Corrigé en `role: MEMBER` + note explicite. Diagramme corrigé : `role: MEMBER/GHOST` → `role: MEMBER`.
185. **heuresContrat (FEATURE)** → Champ `heuresContrat Int?` ajouté sur `Affectation` dans `05` et `15`. Nullable (null pour CDI, renseigné pour intermittents et CDD). Représente les heures déclarées au contrat pour Pôle Emploi / Caisse des Congés Spectacles. Tableau §5.10 de `03` mis à jour avec colonne "Heures".
186. **Checklist + Roadmap (corrections)** → `Checklist Audit md.md` : Magic Links "24h" → durées par purpose (LOGIN 15min, EMAIL_CHANGE 24h, autres 7j) · Règle #30 → Règle #26 · "CONFIRMÉS uniquement" → "tous statuts y compris EN_ATTENTE et REFUSEE". `Roadmap de Lancement.md` : DPAE "J-2" → **J-1** (aligné session 26).

### Session 27 (06/03/2026 — passe senior webhooks Stripe — 6 bugs corrigés dans 18)
163. **S18-1 (CRITIQUE)** → `18` §18.3 : `Organization.isReadOnly` jamais remis à `false` lors d'un upgrade PRO/ENTERPRISE. Si une org était `isReadOnly = true` suite à un passage en FREE avec quota dépassé, l'upgrade ne la débloquait pas. Ajout explicite `isReadOnly = false` pour PRO/ENTERPRISE + `isReadOnly = false` dans le else du quota FREE.
164. **S18-2 (IMPORTANT)** → `18` §18.0 : `STRIPE_PRICE_PRO` hardcodé dans la Checkout Session alors que l'endpoint accepte `{ plan: 'PRO' | 'ENTERPRISE' }`. Pour ENTERPRISE, le mauvais price_id aurait été utilisé. Remplacé par expression dynamique `plan === 'PRO' ? STRIPE_PRICE_PRO : STRIPE_PRICE_ENTERPRISE`.
165. **S18-3 (IMPORTANT)** → `18` §18.4 : `org.collaborateurCount` utilisé comme champ DB (même bug que §21.3 session 9). Remplacé par `COUNT(OrganizationMembership WHERE organizationId = org.id AND role = 'COLLABORATEUR')`.
166. **S18-4 (IMPORTANT)** → `18` §18.5 : `ActivityLog: PAYMENT_FAILED` absent du bloc `attempt_count = 1` — le premier échec de paiement n'était pas tracé. Log déplacé hors des blocs conditionnels (loggué à chaque tentative) + `Organization.paymentFailedAt = now()` aussi déplacé au niveau global.
167. **S18-5 (MOYEN)** → `18` §18.8 : note "À appliquer dans 05 et 15" stale — `paymentFailedAt` et `trialEndsAt` sont déjà présents dans les deux fichiers depuis sessions 5/6. Note remplacée par "✅ Déjà présents".
168. **S18-6 (MOYEN)** → `18` §18.9 checklist : "Configurer le trial 14j dans Stripe" → **sans objet** — le trial est 100% app-side (stripeCustomerId IS NULL pendant le trial, Stripe non impliqué). Checklist corrigée avec note explicative.

### Session 26 (06/03/2026 — passe senior notifications — 5 bugs corrigés dans 13 + 2 dans 15)
158. **N-1 (CRITIQUE)** → `13` §13.7 + `15` model Notification : `organizationId` absent. Sans ce champ, un user membre de N orgs voit les notifs de toutes ses orgs mélangées. Ajouté `organizationId String` + relation `Organization` + index `@@index([userId, organizationId, read])` dans `15`. Ajouté dans le pseudocode `13.7`.
159. **N-2 (IMPORTANT)** → `13` §13.6 + `15` enum `NotificationPriority` : `DPAE_A_FAIRE "J-2 ou moins"` → **J-1**. Le cron §21.2 déclenche à `CURRENT_DATE + 1` (veille). "J-2" était faux dans les deux fichiers.
160. **N-3 (IMPORTANT)** → `13` §13.2 et §13.3 : wireframes `DPAE_A_FAIRE` avec corps `"Carol L. — première prestation"` → `"nouvelle affectation"`. Règle #3 (session 21) : DPAE requise à chaque affectation, pas seulement la première.
161. **N-4 (MOYEN)** → `13` §13.4 : `DPAE_A_FAIRE` ne documentait qu'un seul déclencheur ("Nouvelle affectation"). Second déclencheur ajouté : cron §21.2 à J-1 si dpaeStatus encore `A_FAIRE | ENVOYEE` (priorité CRITIQUE).
162. **N-5 (MOYEN)** → `13` §13.8 : route `/api/notifications/unread-count` décrite en note mais absente de la table. Ajoutée formellement (GET, réponse `{ count: number }`, polling badge 30s).

### Session 25 (06/03/2026 — passe senior cron jobs — 7 bugs corrigés dans 21 + 1 dans 15)
151. **CJ-1 (CRITIQUE)** → `15` enum `ActivityLogAction` : `RELANCE_CONFIRMATION_ENVOYEE` absent. Ajouté sous la section Affectations (entre `AFFECTATION_ANNULEE_TARDIVE` et `// ── Représentations`). Le cron `21` §21.1 référençait cette valeur mais elle n'existait pas dans l'enum Prisma.
152. **CJ-2 (CRITIQUE)** → `21` §21.5 : deux erreurs de nommage ActivityLog. (a) `RGPD_ANONYMISATION` → `USER_ANONYMIZED` (valeur réelle de l'enum dans `15`). (b) `RGPD_WARNING_SENT` complètement absent de l'étape 1 (avertissement J-30) — ajouté après `User.rgpdWarningAt = now()`.
153. **CJ-3 (IMPORTANT)** → `21` §21.1 : le cron générait un nouveau `MagicLinkToken (purpose: CONFIRMATION)` sans invalider l'éventuel token précédent encore valide. Deux tokens CONFIRMATION valides pouvaient coexister pour la même affectation. Ajout d'une étape préalable : `UPDATE MagicLinkToken SET usedAt = now() WHERE affectationId = X AND purpose = 'CONFIRMATION' AND usedAt IS NULL AND expiresAt > now()`.
154. **CJ-4 (IMPORTANT)** → `21` §21.7 : le calcul "postes non pourvus" (`COUNT(Affectations actives)`) ne filtrait pas les affectations `ANNULEE` / `ANNULEE_TARDIVE`. Une affectation annulée libère le poste mais était comptée comme pourvue. Filtre explicite ajouté : `confirmationStatus NOT IN ('ANNULEE', 'ANNULEE_TARDIVE') AND deletedAt IS NULL`.
155. **CJ-5 (MOYEN)** → `21` §21.5 : `dernière_affectation` était du pseudocode sans correspondance avec un champ réel. Remplacé par `User.lastActiveAt` (champ existant dans `15`, mis à jour à chaque connexion active). Gestion du cas NULL ajoutée : `OR (lastActiveAt IS NULL AND createdAt < now() - interval '...')`.
156. **CJ-6 (MOYEN)** → `21` §21.6 : le cron archive les projets `status = 'TERMINE'` mais aucun mécanisme n'est automatisé pour passer un projet de `EN_COURS` à `TERMINE` (transition manuelle). Note ajoutée : les projets avec toutes représentations passées mais status `EN_COURS` ne seront jamais archivés par ce cron — à gérer côté UX (badge "projets à clôturer" sur le dashboard).
157. **CJ-7 (MINEUR)** → `21` §21.9 : table des champs ajoutés par les crons — `Collaborateur.anonymizedAt` absent alors que §21.5 efface `socialSecurityNumber` et `IBAN` sur `Collaborateur`. Ligne ajoutée.

### Session 24 (03/03/2026 — passe senior architecture technique — 6 bugs corrigés dans 23)
145. **AT-1 (CRITIQUE)** → `23` §23.2 : extension Prisma `findUnique` cassée. Le commentaire disait "on reroute vers findFirst" mais le code appelait toujours `query(args)` (findUnique) avec `deletedAt: null` ajouté — ce qui plante Prisma en runtime car `deletedAt` ne fait pas partie de la contrainte unique. Correction : suppression de l'interception `findUnique` + règle explicite "ne jamais utiliser `findUnique` sur les modèles soft-deletables, utiliser `findFirst` à la place".
146. **AT-2 (IMPORTANT)** → `23` §23.7 : diagramme upload montrait `Document.confirmed=true` mais ce champ n'existe pas dans le modèle (`05`/`15`). Flux réécrit en 2 étapes propres : `/upload` génère la presigned URL sans créer de record DB · `/confirm` crée le record Document seulement si S3 upload OK. Plus de champ `confirmed` nécessaire.
147. **AT-3 (IMPORTANT)** → `23` §23.4 : `organizationPlan` dans le JWT peut être stale après changement de plan (upgrade Stripe, intervention admin). Règle ajoutée : `useFeature()` = cache UI uniquement. Les vérifications serveur doivent toujours lire `org.plan` depuis la DB — jamais depuis `session.user.organizationPlan`.
148. **AT-4 (MOYEN)** → `23` §23.4 : contrats des fonctions non documentés. `canAddProjet.activeCount` = projets `EN_PREPARATION | EN_COURS` uniquement (exclure `TERMINE/ARCHIVE/ANNULE`). `canUploadDocument.currentStorageBytes` = `SUM(sizeBytes) WHERE deletedAt IS NULL` (exclure les soft-deleted).
149. **AT-5 (MOYEN)** → `23` §23.6 : `eventBus` référencé dans le snippet SSE mais jamais défini ni importé. Ajout d'une note : `lib/event-bus.ts` (EventEmitter Node.js in-process sur Railway), avec avertissement multi-instance → Redis Pub/Sub si plusieurs pods.
150. **AT-6 (MINEUR)** → `23` §23.1 : `requireOrgSession` accepte `OrganizationRole | OrgSessionOptions` sans indiquer que la forme string est dépréciée. Note ajoutée : préférer toujours l'objet `{ minRole }`.

### Session 23 (03/03/2026 — passe senior schéma Prisma — 6 bugs corrigés dans 15)
139. **P15-1 (CRITIQUE)** → `15` `PosteRequis.isCritique` : `Règle #31` → `Règle #33` — oubli de la correction DM-5 (session 22) qui n'avait fixé que `05`.
140. **P15-2 (IMPORTANT)** → `15` `ActivityLog` relation User : `onDelete: SetNull` manquant. Sans ça, Prisma défaut à `NoAction` (= Restrict PostgreSQL) qui bloque la suppression d'un User avec des logs. Critical pour l'anonymisation RGPD.
141. **P15-3 (IMPORTANT)** → `15` note "Soft delete" : `Document` absent de la liste (`Projet, Representation, Affectation` → ajout `Document`). Note sur le filtre `WHERE deletedAt IS NULL` ajoutée.
142. **P15-4 (MOYEN)** → `15` note Module Tournée : la liste des choses à ajouter lors de l'implémentation oubliait les champs sur `Collaborateur` (`preferenceChambre`, `regimeAlimentaire`, `allergies`, `permisConduire`, `permisCategorie`) et leurs enums. Ajouté dans la note.
143. **P15-5 (MOYEN)** → `15` `Collaborateur` : `@@index([accountStatus])` manquant — nécessaire pour les requêtes cron RGPD (`WHERE accountStatus = 'GHOST'`) et les queries fréquentes de filtrage.
144. **P15-6 (MINEUR)** → `15` date stale : `02/03/2026` → `03/03/2026`.

### Session 22 (03/03/2026 — passe senior data models — 7 bugs corrigés dans 05 + 15)
132. **DM-1 (CRITIQUE)** → `05` + `15` : `accountStatus` mal placé sur `User`. Migré vers `Collaborateur` (champ `accountStatus: GHOST | ACTIVE | INACTIF` + `ghostCreatedAt` + `activatedAt`). `INACTIF` manquait dans les deux fichiers. Note explicite : `User.role` toujours `MEMBER`. `15` : champs retirés de `User`, ajoutés dans `Collaborateur`.
133. **DM-2 (CRITIQUE)** → `05` `MagicLinkToken.purpose` : `LOGIN` et `EMAIL_CHANGE` manquants (déjà dans `15` depuis session 15, mais absent de `05`). Ajoutés avec durées d'expiration documentées (LOGIN 15 min · EMAIL_CHANGE 24h).
134. **DM-3 (IMPORTANT)** → `05` + `15` : `Affectation.hasConflict: Boolean @default(false)` manquant. Ajouté — flag posé à la création si conflit de créneau (avertissement ⚠️ non bloquant, Règle #2).
135. **DM-4 (IMPORTANT)** → `05` `ActivityLog` : `action` non typé comme `ActivityLogAction` enum + `userId` non nullable. Corrigé : `action: ActivityLogAction` + `userId: String?` avec note `null` pour les crons/webhooks.
136. **DM-5 (MOYEN)** → `05` `PosteRequis.isCritique` : référence `Règle #31` → `Règle #33` (calcul statut visuel représentation 🟢/🟡/🔴).
137. **DM-6 (MOYEN)** → `05` `Hebergement.checkIn/checkOut` et `ChambreOccupant.nuitDu` : `DateTime` → `Date` (cohérence avec la convention `Representation.date: Date`).
138. **DM-7 (MINEUR)** → `05` `PropositionRemplacement.propositionToken` : note ajoutée expliquant le choix de token maison (pragmatisme — `status` ACCEPTEE/REFUSEE porté par `PropositionRemplacement` elle-même, pas via `MagicLinkToken.usedAt`).

### Session 21 (03/03/2026 — passe senior règles & décisions — 6 bugs corrigés dans 06)
126. **R-1 (CRITIQUE)** → `06` Règle #2 : "le système empêche" → comportement corrigé : **avertissement ⚠️ non bloquant** dans le dropdown (tooltip). Flag `hasConflict = true` posé sur l'Affectation. Aligné avec W-3 de la session 20.
127. **R-2 (CRITIQUE)** → `06` Règle #3 : "si c'est sa première prestation pour ce projet" **supprimé**. DPAE requise pour **chaque** affectation CDD/intermittent. CDI seuls exemptés. Aligné avec W-9 de la session 20.
128. **R-3 (CRITIQUE)** → `06` Décision #12 : `User.accountStatus` → **`Collaborateur.accountStatus`** (GHOST/ACTIVE/INACTIF). Note explicite : `User.role` reste toujours `MEMBER`. Aligné avec W-7 de la session 20.
129. **R-4** → `06` Règle #16 : `accountStatus: GHOST` → `Collaborateur.accountStatus = GHOST`. Note explicite sur `User.role = MEMBER` invariant. Aligné avec W-7.
130. **R-5** → `06` Règle #12 + Décision #9 : iCal aligné avec W-8 — **modal 2 options** : (a) snapshot `.ics` statique, (b) lien d'abonnement dynamique. Décision #9 : ajout route `/mon-planning/subscribe.ics`.
131. **R-6** → `06` Règle #31 : ajout route `PATCH /api/affectations/[id]/relancer` (remet `relanceSentAt` à `null` pour permettre une nouvelle relance cron). Aligné avec W-6 de la session 20.

### Session 20 (03/03/2026 — passe senior workflows — 10 bugs corrigés dans 03 + 1 dans 15)
116. **W-1** → `03` §5.2 : `colorCode` absent du formulaire création projet. Ajouté avec note Règle #34 (palette fixe 12 couleurs, usage planning global).
117. **W-2** → `03` §5.4 : postes sans équipes nommées — incohérent avec wireframe §6.3. Workflow restructuré en 3 étapes : (1) créer équipes + chef de poste, (2) définir postes avec `isCritique` (Règle #33), (3) associer collaborateurs.
118. **W-3** → `03` §5.5 : comportement conflit d'affectation non défini. Précisé : avertissement ⚠️ dans le dropdown (tooltip), pas de blocage dur, l'affectation est créée avec flag visuel + alerte planning global inter-projets.
119. **W-4** → `03` §5.6 : ajout de dates après un premier email non spécifié. Ajouté CAS D : email complémentaire sur les nouvelles dates uniquement (détection via `relanceSentAt` sur affectations existantes du même projet).
120. **W-5** → `03` §5.6 : fallback token expiré (7j) avant représentation non défini. Ajouté CAS E : token expiré → page d'erreur avec contact régisseur (§11.2), affectation reste EN_ATTENTE, pas de passage automatique à REFUSEE.
121. **W-6** → `03` §5.6 : route API "renvoyer le lien" manquante. Ajoutée : `PATCH /api/affectations/[id]/relancer` — génère nouveau token CONFIRMATION 7j, invalide l'ancien.
122. **W-7 (CRITIQUE)** → `03` §5.7 + §5.17 §ÉTAPE 2 : confusion `User.role = GHOST` vs `Collaborateur.accountStatus = GHOST`. Clarifié dans les deux endroits : `User.role` vaut toujours MEMBER, c'est `Collaborateur.accountStatus` qui passe de GHOST à ACTIVE lors de l'activation.
123. **W-8** → `03` §5.8 : workflow décrit 2 options (snapshot + abonnement) mais wireframe §6.5 montrait 1 bouton. Aligné : le bouton ouvre un modal présentant les 2 options. Note d'alignement ajoutée dans `03`.
124. **W-9 (CRITIQUE)** → `03` §5.9 : "CDD dont c'est la première prestation" — incorrect. DPAE requise à CHAQUE engagement CDD/intermittent. Corrigé avec note explicite sur l'exemption CDI.
125. **W-10 (CRITIQUE)** → `03` §5.16 : `ActivityLog: MEMBER_INVITED` → `EMAIL_CHANGED`. Corrigé dans `03`. `EMAIL_CHANGED` ajouté à l'enum `ActivityLogAction` dans `15`.

### Session 19 (03/03/2026 — passe senior UX — 10 bugs corrigés dans 04)
106. **Bug UX-1** → `04` §6.1 : KPI "DPAE à faire" visible par tous → restreinte à RH/Directeur. Tableau des KPIs par rôle ajouté. KPIs rendues cliquables (→ pages correspondantes). Bannière organisation ajoutée (trial J-3, lecture seule, suspension).
107. **Bug UX-2** → `04` §6.1 Dashboard collab : affectations EN_ATTENTE sans CTA. Bannière "2 dates attendent votre confirmation [Répondre →]" ajoutée. Badge 🟠 sur les dates du calendrier. Tableau des badges par statut.
108. **Bug UX-3** → `04` §6.2 : filtre `[Toutes ▾]` → `[Statut ▾]`. `colorCode` ajouté comme bande gauche sur les cards. Vue Liste wireframée (tableau avec pastille colorCode, clic → projet).
109. **Bug UX-4 (MAJEUR)** → `04` §6.3 : onglet "Équipe & Postes" jamais wireframé. Ajouté : équipes groupées, postes avec nb requis + isCritique, assigner collaborateurs, importer depuis projet existant, actions [⋯] renommer/supprimer équipe.
110. **Bug UX-5** → `04` §6.3 onglet Représentations : clic sur une ligne sans action définie. Ajouté menu contextuel : "Voir la grille" / "Ouvrir la FDR" / "Annuler-Reporter".
111. **Bug UX-6** → `04` §6.3 onglet RH/Paie : "🟡 ENC." → "🟡 Envoyée" (cohérent avec enum DpaeStatus).
112. **Bug UX-7** → `04` §6.5 : vue Liste non wireframée + badge EN_ATTENTE absent. Vue Liste ajoutée avec `[Confirmer]` inline. Badge 🟠 sur vue Mois. Export iCal limité aux CONFIRMEES uniquement (correction logique).
113. **Bug UX-8** → `04` §6.6 : filtre "par projet" présent dans §5.10 mais absent du wireframe. Ajouté `[Tous les projets ▾]`.
114. **Bug UX-9** → `04` §6.8 DPAE : passage à CONFIRMEE sans confirmation. Ajouté tooltip de confirmation obligatoire avec note "action irréversible dans l'app".
115. **Bug UX-10** → `04` §6.9 : pas de feedback post-téléchargement. Toast ajouté "Export_Mars2026.csv téléchargé (N lignes)". §11.2 : page token expiré wireframée (contact régisseur affiché depuis JWT claims sans vérification signature). §11.4 : état vide onglet Représentations + état vide `/rh/export` filtre sans résultats.

### Session 18 (03/03/2026 — wireframes /rh/dpae §6.8 + /rh/export §6.9 + empty states §11.4)
103. **Nouveau §6.8 `/rh/dpae`** → `04` : tableau de suivi DPAE (RH / Directeur), bandeau alerte J-1, transitions de statut (À faire → Envoyée → Confirmée) via bouton [✓], filtres période/projet/statut, 3 routes API (GET liste, PATCH statut, GET export CSV)
104. **Nouveau §6.9 `/rh/export`** → `04` : page export paie — sélecteurs période/projets/type contrat/statut DPAE, aperçu 5 lignes (N°SS masqué), 9 colonnes CSV documentées, règle CDI sans cachet unitaire, route API `GET /api/rh/export.csv`
105. **Nouveau §11.4 États vides** → `04` : 7 états vides spécifiés (`/projets`, `/equipe`, `/planning`, `/rh/dpae`, `/notifications`, `/mon-planning`, `/mes-contrats`) — icône + titre + texte + CTA conditionnel (rôle). Règles transverses : filtres actifs → message dédié + "Effacer les filtres", pas d'état vide sur la grille d'affectation.
- Numérotation mise à jour : `§6.8` DPAE · `§6.9` Export · `§6.10` Mes contrats
- Table master routes mise à jour avec références §6.8 et §6.9
- `CLAUDE_MEMORY` : compteur lignes `04` mis à jour (~1000)

### Session 17 (02/03/2026 — planning global §6.4 — wireframes complets + nouveaux champs schéma)
98. **Refonte §6.4 `/planning` dans `04`** — Section entièrement réécrite : droits d'accès par rôle (DIRECTEUR/RH = tout · REGISSEUR = lecture seule autres projets + édition les siens via `ProjetMembre`) · card événement (code projet, heure, ratio 8/10, statut 🟢🟡🔴) · empilage vertical si plusieurs projets le même jour · vue Mois wireframée · vue Semaine Gantt (colonnes = jours, lignes = projets) avec alerte de conflit inter-projets · panel latéral (Drawer) au clic avec résumé équipes + statuts confirmation + CTA "Gérer le planning" (masqué si non responsable) · filtres (projets, lieux, statut) · routes API `/api/planning/global?month=` et `?week=`.
99. **Nouveau champ `Projet.colorCode String @default("#6366F1")`** — `05` et `15`. Palette fixe 12 couleurs, choisie à la création. Usage exclusif : planning global.
100. **Nouveau champ `PosteRequis.isCritique Boolean @default(false)`** — `05` et `15`. Défini par le régisseur. Alimente le statut 🔴 vs 🟡 du planning global.
101. **Règle #33** → `06` : calcul statut visuel représentation (🟢/🟡/🔴 selon `isCritique`), recalculé côté serveur sans cache.
102. **Règle #34** → `06` : palette couleur projet fixe, pas de hex libre.

### Session 16 (02/03/2026 — passe senior #2 — corrections architecture + emails templates + workflows collaborateur)
91. **Bug CRITIQUE `23`** — `organizationPlan` déclaré utilisé dans `useFeature()` hook (§23.4) mais absent du JWT NextAuth (§23.1). Corrigé : `organizationPlan: OrganizationPlan | null` ajouté dans `Session.user` et `JWT` dans `types/next-auth.d.ts`, callback `jwt()` et `session()` mis à jour (include `organization.plan` dans les deux branches), `useFeature` note ⚠️ remplacée par ✅.
92. **Gap CRITIQUE `23`** — `requireOrgSession()` ne vérifiait jamais si l'organisation était suspendue ou en lecture seule. Corrigé : nouvelle signature avec `OrgSessionOptions { minRole?, write? }` (rétrocompatible), fetch léger `{ suspendedAt, isReadOnly }` sur l'organisation à chaque appel, codes d'erreur dédiés `ORG_SUSPENDED` et `ORG_READ_ONLY`. Import `prisma` ajouté dans `lib/auth.ts`.
93. **Gap CRITIQUE `23` — anti-IDOR** — aucun helper pour vérifier que la ressource appartient à l'organisation de la session courante. Ajouté : `verifyOwnership(entityOrgId, sessionOrgId): NextResponse | null` avec JSDoc d'usage. Illustration dans l'exemple de route PATCH du §23.1.
94. **Bug IMPORTANT `15`** — `ActivityLog.userId String` était non-nullable, bloquant les crons et webhooks Stripe qui n'ont pas d'auteur humain. Corrigé : `userId String?` (nullable) + `user User?` (relation optionnelle) + commentaire `SYSTEM_ACTOR_ID` constant. Note récapitulative ajoutée dans l'en-tête du fichier.
95. **Nouveau fichier `24-emails-templates.md`** — catalogue exhaustif de 16 templates Resend : auth (magic link connexion, activation GHOST, changement email, invitation membre), affectations (confirmation, refus, annulation, remplacement urgent), représentations (FDR publiée, annulation/report), accès (document magic link, planning magic link), Stripe (trial ending J-7/J-3, trial expiré, paiement échoué), RGPD (avertissement anonymisation J-30), DPAE (confirmation envoi). Pour chaque template : fichier `.tsx`, sujet email, déclencheur, variables avec types, contenu principal. `lib/email.ts` wrapper Resend documenté. `EmailLayout` composant base. Règles transverses (erreurs, internationalisation, prévisualisation React Email).
96. **Gap IMPORTANT `03` §5.16** — Flux `pendingEmail` (changement d'email) entièrement absent des workflows. Ajouté : saisie nouvelle adresse → validation unicité → `User.pendingEmail` en base → email de confirmation vers la NOUVELLE adresse (MagicLinkToken `EMAIL_CHANGE` 24h) → confirmation swap `email ↔ pendingEmail` → nettoyage token. Règles #26 (bannière en attente) et #27 (un seul pendingEmail simultané). Note sur ActivityLogAction.
97. **Gap IMPORTANT `03` §5.17** — Cycle de vie Collaborateur jamais documenté (création, activation GHOST, désactivation). Ajouté : modèle de données User↔Collaborateur, 3 cas de création (CAS A User existant, CAS B User GHOST nouveau, CAS C contact RH pur sans compte), flux activation GHOST, flux désactivation avec conservation historique. Règles #28 (suppression org ≠ suppression User), #29 (collab sans userId = hard delete), #30 (impossible supprimer avec affectations futures confirmées). Tableau récapitulatif des 4 états `accountStatus`.
- README version 11.0 → 12.0, ajout de `24` dans la table, chemin back-end mis à jour.

### Session 15 (02/03/2026 — architecture technique — nouveau fichier 23 + 3 corrections critiques)
87. **Nouveau fichier `23-architecture-technique.md`** — 7 sections manquantes qui bloquaient le démarrage du coding : (1) contexte session multi-org avec `organizationId` dans le JWT NextAuth + helper `requireOrgSession` ; (2) Prisma Client Extension pour le soft delete automatique (injection `deletedAt: null`) + accès intentionnel via `prismaBase` pour les cas admin ; (3) format d'erreur API unifié (`ApiError` type + codes standardisés `UNAUTHORIZED`/`FORBIDDEN`/`NOT_FOUND`/`QUOTA_EXCEEDED`/`CONFLICT`/`STRIPE_ERROR` + helpers `forbidden()`/`notFound()`/etc.) ; (4) `lib/plans.ts` entièrement spécifiée avec `PLAN_LIMITS`, `canAddCollaborateur`, `canAddProjet`, `hasFeature`, `canUploadDocument` ; (5) conventions de nommage routes API + structure dossiers ; (6) SSE — format des événements (`event:`, `data:`, types exhaustifs) + implémentation serveur + note infra Vercel Edge ; (7) upload S3 — flux presigned URL + types MIME autorisés + validation serveur.
88. **Bug CRITIQUE `15`** — `ActivityLog.action` était `String` libre → risque d'incohérence entre devs. Remplacé par enum `ActivityLogAction` avec 26 valeurs exhaustives couvrant toutes les actions documentées dans la spec (affectations, représentations, projets, remplacements, FDR, Stripe, organisation, RGPD, admin). Index ajouté sur `action`.
89. **Bug IMPORTANT `15`** — `MagicLinkPurpose` manquait `LOGIN` (magic link du signup §5.1) et `EMAIL_CHANGE` (changement d'adresse §22). Ajoutés avec durées d'expiration documentées dans l'enum (LOGIN 15 min, DOCUMENT_ACCESS 1h, EMAIL_CHANGE 24h, les autres 7 jours).
90. **Gap CRITIQUE `18`** — Flux de création du `stripeCustomerId` entièrement absent. Ajouté §18.0 "Flux de souscription initiale" : route `POST /api/billing/checkout`, création du Stripe Customer avant la Checkout Session, sauvegarde immédiate en base, ActivityLog `STRIPE_CUSTOMER_CREATED`, redirect Checkout, retour via webhook `subscription.updated`. Garde contre création double. Route `GET /api/billing/portal` mentionnée.
- README version 10.0 → 11.0, ajout de `23` dans la table et dans "Accès rapide back-end".

### Session 14 (02/03/2026 — suppression distinctions v1/v2 — spec version unique)
86. **Refactoring v1/v2** → 15 fichiers mis à jour : toute mention "en v1", "Déféré v2", "Module v2 — non inclus en v1", "périmètre v1" etc. supprimée. La spec est désormais une version unique définitive. Détail fichier par fichier :
    - `01` : "périmètre v1" → "Ce que ce n'est PAS" / dark mode et SMS restent exclus mais sans marqueur v1
    - `05` : locale, transportInfo, Module Tournée — labels v1/v2 retirés
    - `06` : décisions #5 et #7 nettoyées
    - `11` : section Transport entièrement réécrite, "Module Tournée — Non inclus en v1" → intégration naturelle au §19, §11.9 renommé "Spécifications complémentaires", toutes les fonctionnalités (FDR mutualisée, PWA) marquées ✅ Inclus
    - `12` : "en v1" retiré, "Questions ouvertes (v2)" → "Questions ouvertes"
    - `13` : idem
    - `14` : idem
    - `15` : locale, transportInfo, bloc Module Tournée — labels v1/v2 retirés, modèles tournée à intégrer lors de l'implémentation
    - `16` : pays fixe, type string, country FR, plans, Questions ouvertes v2 → Questions ouvertes + "Déféré v2" → "À spécifier"
    - `17` : périmètre, 2FA SUPER_ADMIN rendu obligatoire (au lieu de "Recommandé en v1"), stats à la volée, Questions ouvertes v2 nettoyées
    - `18` : Option A RECOMMANDÉE, handler trial_will_end clarifié, Questions ouvertes v2 nettoyées
    - `19` : "Module v2 — non inclus dans le périmètre v1" supprimé — Module Tournée est un module standard
    - `20` : note trial Stripe, Questions ouvertes v2 → Questions ouvertes
    - `21` : note trial Stripe
    - `22` : 2FA "optionnel v1" → "optionnel", langue
    - `README` : "dark mode v1" → "dark mode"

### Session 13 (02/03/2026 — audit workflows — passe senior — 7 bugs corrigés)
79. **Bug W1 (MOYEN)** → `03` §5.3 : liste des types de représentation incomplète — 5 types listés au lieu de 7. Ajoutés : `Intervention` et `Événement` (cohérent avec enum `Representation.type` dans `15`).
80. **Bug W2 (IMPORTANT)** → `03` §5.15 Option A + `12` §12.4 Option A : "Toutes les confirmations remises à `EN_ATTENTE`" — **incorrect pour les CDI/CDD** dont `confirmationStatus = NON_REQUISE`. Corriger leur status en `EN_ATTENTE` et leur envoyer un magic link de reconfirmation serait une erreur de comportement. Fix dans `03` et `12` : distinction explicite INTERMITTENTS (reset → EN_ATTENTE + magic link) vs CDI/CDD (NON_REQUISE conservé + notification informative uniquement). Wireframe `12` §12.4 mis à jour en même temps.
81. **Bug W3 (MOYEN)** → `03` §5.7 ÉTAPE 4 : "Si GHOST + aucune affectation depuis 3 ans → anonymisation directe" — **incorrect**. Le cron §21.5 n'applique aucun filtre sur `accountStatus` : il envoie d'abord un email d'avertissement J-30 à TOUS les comptes inactifs (GHOST inclus), puis anonymise 30 jours plus tard si toujours inactif. Corrigé pour refléter le comportement réel du cron §21.5.
82. **Bug W4 (MINEUR)** → `03` §5.4 : formulaire "Ajouter un poste" ne mentionnait pas `defaultStartTime` / `defaultEndTime` alors que la **Règle #19** les utilise pour pré-remplir `Affectation.startTime/endTime`. Ces champs sont architecturalement importants. Ajoutés au formulaire.
83. **Bug W5 (MINEUR)** → `03` §5.12 CAS A : `ActivityLog: AFFECTATION_ANNULEE` présent dans CAS B (annulation tardive) mais absent de CAS A (annulation simple). Ajouté pour cohérence — toute annulation doit être tracée.
84. **Bug W6 (MINEUR)** → `03` §5.1 : `Organization.stripeCustomerId` non mentionné lors de l'onboarding. Or il reste `NULL` pendant tout le trial — information critique pour les crons, webhooks Stripe et le super-admin. Ajouté comme commentaire inline dans le bloc de création de l'Organisation.
85. **Bug W7 (MINEUR)** → `03` §5.15 Option A : `Representation.reporteeVersId` (présent dans `12` §12.4 et dans le schéma `15`) absent du workflow §5.15. Ajouté.

### Session 12 (02/03/2026 — audit pass 5 — passe senior — 6 bugs corrigés)
73. **Bug 30 (IMPORTANT)** → `11` §11.8 + `04` API routes : `POST /api/feuille-de-route/[id]/copier-depuis` absente des deux tables de routes alors que §11.9.3 est désormais **"v1 ✅ Recommandé"** (fix Bug 28). Route ajoutée dans `11` §11.8 et dans `04` section "API & exports".
74. **Bug 31 (MOYEN)** → `05` `Collaborateur` : `→ Affectations[], Documents[]` — notation `Documents[]` trompeuse après fix Bug 29. Remplacée par un avertissement explicite sur le pattern polymorphique (`entityType + entityId`) et la requête correcte.
75. **Bug 32 (IMPORTANT)** → `05` : champs `deletedAt: DateTime?` absents sur `Projet`, `Representation`, et `Affectation` alors que `15-schema-prisma.md` les a correctement et que CLAUDE_MEMORY les mentionne comme décision architecturale. Ajoutés dans les trois modèles de `05`.
76. **Bug 33 (MINEUR)** → `README.md` : deux erreurs — (1) compteur `06` "21 décisions" → "22 décisions" (décision #22 JWT enrichi existe dans `06` depuis session 3) ; (2) date stale "28/02/2026" → "02/03/2026" dans le header et le footer. Corrigé.
77. **Bug 34 (MINEUR)** → `06` règle 5 — soft delete mentionné uniquement sur "représentations et affectations", oubliait `Projet` et `Document` qui ont aussi `deletedAt`. Règle étendue + ajout de la mention `WHERE deletedAt IS NULL` pour les requêtes.
78. **Bug 35 (MINEUR)** → `CLAUDE_MEMORY.md` table fichiers : `06` toujours indiqué "21 décisions" → corrigé en "22 décisions".

### Session 11 (02/03/2026 — audit pass 5 — 22 fichiers lus — 5 bugs + 1 typo corrigés)
67. **Bug 25 (MOYEN)** → `09` §9.6 + `21` §21.7 : notification "Poste non pourvu J-2" mentionnée dans §9.6 mais aucun cron ne la déclenchait (§21.7 ne checkait qu'à J-7). §21.7 étendu pour inclure une **Étape 2** (J-2, CRITIQUE, email urgent au régisseur + chef de poste) et une **Étape 3** (archivage FDR — voir Bug 27). Titre de §21.7 mis à jour. Table de vue d'ensemble mise à jour.
68. **Bug 26 (IMPORTANT)** → `21` §21.3 CAS B : trial expiré + nbCollabs > 3 settait `isReadOnly = true` mais **oubliait `Organization.plan = FREE`**. L'org restait en plan PRO avec isReadOnly, incohérent avec `18` §18.4 Option A (`plan = FREE` puis `isReadOnly = true`). Corrigé : CAS B ajoute désormais `Organization.plan = FREE` avant `isReadOnly = true`.
69. **Bug 27 (MOYEN)** → `11` §11.6 : "passage automatique en ARCHIVEE à J+1" promis mais aucun cron ne le faisait. Corrigé en ajoutant l'**Étape 3** dans §21.7 (cron quotidien 8h00) qui archive les FDR publiées dont la représentation est passée. §11.6 mis à jour avec référence explicite à `§21.7 Étape 3`.
70. **Bug 28 (MINEUR)** → `11` §11.9 table : "Feuille de route mutualisée" marquée `v2 — à décider` mais le verdict de §11.9.3 disait déjà **"Recommandé en v1"**. Contradiction interne. Table mise à jour : `v1 ✅ Recommandé`.
71. **Bug 29 (CRITIQUE)** → `15` : `Collaborateur.documents Document[]` était une **relation Prisma brisée** — `Document` utilise un pattern polymorphique (`entityType + entityId`) sans FK vers `Collaborateur`, ce qui fait échouer `prisma generate`. Ligne supprimée et remplacée par un commentaire expliquant la requête polymorphique correcte : `prisma.document.findMany({ where: { entityType: 'COLLABORATEUR', entityId: id } })`.
72. **Typo** → `11` §11.9.4 : "Notificaitons" → "Notifications".

### Session 10 (01/03/2026 — audit pass 4 — fichiers 07/08/09/11/14/16/17/19/21/22 — 5 bugs corrigés)
62. **Bug 20 (CRITIQUE)** → `17` §17.5.1 : workflow admin "Changer le plan" écrivait d'abord `Organization.plan` en base PUIS appelait `stripe.subscriptions.update`, violant le principe "Stripe source de vérité" de §18. Corrigé : CAS A (stripeCustomerId != null) → update Stripe d'abord, webhook met à jour le plan ; CAS B (stripeCustomerId IS NULL, trial/FREE sans souscription) → écriture directe acceptable, exception documentée.
63. **Bug 21 (MOYEN, résiduel)** → `21` §21.3 : note résiduelle incorrecte "le webhook Stripe `customer.subscription.trial_will_end` gère aussi J-3 — les deux peuvent coexister". Contradisait §18.7. Remplacée par note claire : ce cron est le **seul mécanisme** de J-3 en v1.
64. **Bug 22 (MOYEN)** → `16` §16.5 : section Facturation appelait `stripe.invoices.list({ customer: org.stripeCustomerId })` et `stripe.billingPortal.sessions.create` sans guard `stripeCustomerId IS NULL`. Pendant le trial, ces appels échoueraient. Ajout de guards explicites avec états vides.
65. **Bug 23 (MOYEN)** → `22` §22.3 : chemin S3 avatar `org_id/users/user_id/avatar.*` incorrect — l'avatar est cross-org (`User.avatarUrl` unique par utilisateur). Corrigé en `users/[user_id]/avatar.*`. Également `07` §7.2 : `org_id/users/user_id/documents/` harmonisé avec règle #29 → `[org_id]/[user_id]/documents/`.
66. **Bug 24 (MINEUR)** → `09` §9.5 : référence "section 15" pour le workflow remplacement urgent → corrigé en "section 10 (`10-remplacements-urgents.md`)".

### Session 7 (28/02/2026 — audit 4 — 22 fichiers lus, 5 bugs corrigés)
39. **Bug A** → `16` : ENTERPRISE stockage `Illimité + SLA` → `50 Go` (aligné sur `20` + `lib/plans.ts`)
40. **Bug B** → `03` §5.2 : `Lieu principal (optionnel à ce stade)` supprimé (pas de salle fixe par projet — Décision #3)
41. **Bug C** → `14` §14.9 : question ouverte #1 "trial" marquée ✅ Décidé (déjà dans `20` + Décision #20)
42. **Bug D** → `11` : §11.4 Transport v1 (texte libre) ajouté — comblait le saut 11.3 → 11.5
43. **Bug E** → `10` : footer obsolète "Prochaine étape : schéma Prisma" supprimé

### Session 6 (28/02/2026 — audit 3 + corrections bugs 1–8)
31. **Bug 1** → `User.name` → `firstName + lastName` dans `05`, `15`, `22`
32. **Bug 2** → `Document.deletedAt DateTime?` ajouté dans `15`
33. **Bug 3** → `contractType` → `contractTypeUsed` dans cron DPAE `21`
34. **Bug 4** → `/settings/facturation` → ancre `#facturation` dans `/settings/organisation` (`04`)
35. **Bug 5** → §22.8 : annotation "À ajouter" supprimée (champs déjà dans le schéma)
36. **Bug 6** → `Collaborateur.cachetHabituel: Int?` ajouté dans `05` et `15`
37. **Bug 7** → Double `---` supprimé dans `04`
38. **Bug 8** → `/admin/plans` → vraies routes back-office (`/admin/organisations/[id]`, `/admin/admins`, `/admin/logs`) dans `04`

### Session 5 (28/02/2026 — correction des 6 bugs post-audit)
25. **Fix `05`** → `plan: FREE` (was STARTER), `isReadOnly` ajouté à Organization, User + 6 champs (timezone/icalToken/emailPreferences/pendingEmail/anonymizedAt/rgpdWarningAt), Affectation + `relanceSentAt`, Document + `deletedAt`
26. **Fix `16`** → STARTER→FREE, prix PRO 79€→49€, ENTERPRISE "Sur devis"→149€, limites membres (5→3 FREE, illimité→20 PRO), stockage PRO 10Go→5Go, note hypothèses retirée
27. **Fix `17`** → FREE partout (wireframe chart, alerte système, liste orgs, filtre plan)
28. **Fix `18` §18.4** → "dégradation douce → STARTER" → "dégradation douce → FREE", décision tranchée (plus "à trancher")
29. **Fix `README`** → "32 règles + 21 décisions" (était "27 règles + 17 décisions")
30. **Fix `CLAUDE_MEMORY`** → compteurs + "#1 → #21"

### Session 4 (28/02/2026 — décisions finales + modules manquants)
16. **Plans tarifaires (20)** → `docs/20-plans-tarifaires.md` créé — 3 tiers FREE/PRO/ENTERPRISE, limites par plan, trial 14j PRO, règle de blocage, `lib/plans.ts`, champs Prisma (`isReadOnly`)
17. **Cron jobs (21)** → `docs/21-cron-jobs.md` créé — 7 jobs compilés : relance confirmation, DPAE J-1, expiration trial, nettoyage tokens, RGPD anonymisation, archivage projets, postes non pourvus J-7 · `vercel.json` config
18. **Paramètres compte (22)** → `docs/22-settings-compte.md` créé — 4 onglets : Profil, Sécurité (mdp/2FA optionnel), Préférences (fuseau horaire, notifs email), iCal (token révocable)
19. **Mise à jour `06`** → 5 nouvelles règles (#28-#32) + 4 nouvelles décisions techniques (#18-#21 : Resend, Vercel+Railway, plans, crons)
20. **Mise à jour `04`** → Multi-org switcher UI (§11.3), wireframe `/rh/remuneration` (§6.7), wireframe `/mes-contrats` (§6.8), nouvelles routes settings
21. **Mise à jour `07`** → Modal upload documents depuis fiche collab (avec règles S3), page `/equipe/[id]/historique` (§7.6), routes API documents
22. **Mise à jour `15`** → `OrganizationPlan: FREE/PRO/ENTERPRISE` (renommé depuis STARTER), `Organization.isReadOnly`, `User.timezone/icalToken/emailPreferences/pendingEmail/anonymizedAt/rgpdWarningAt`, `Affectation.relanceSentAt`
23. **Mise à jour `18`** → Trial 14j PRO défini, §18.7 enrichi, checklist mise à jour, `STARTER` → `FREE` partout
24. **README** → v10.0, stack finalisée (Resend + Vercel + Railway), 3 nouveaux modules listés, décisions plans tarifaires ajoutées

### Session 3 (28/02/2026 — peaufinage)
14. **Enrichissement `03-workflows.md`** → 5.1 enrichi (wizard + magic link), 5 nouveaux workflows : 5.11 Remplacement urgent, 5.12 Annulation affectation, 5.13 Annulation représentation, 5.14 Annulation projet, 5.15 Report représentation
15. **Audit cross-modules** → 11 bugs/incohérences détectés et corrigés :
    - `05` : `Projet.status` + `ANNULE`, `Organization` + `onboardingCompletedAt`, `Notification` model complet (body/readAt/actionLabel/priority/groupId/archivedAt/+2 types)
    - `15` : `NotificationType` + `REPRESENTATION_REPORTEE` + `PROJET_ANNULE`, `NotificationPriority` enum ajouté, `Notification` model synchro, `Organization` + `onboardingCompletedAt`
    - `10` : `confirmationStatus` enum complet (ANNULEE manquait)
    - `12 §12.4` : ambiguïté report résolue (ancienne = REPORTEE, nouvelle créée, lien reporteeVersId)
    - `04` : routes nettoyées (annuler/reporter → API uniquement, FDR route corrigée vers `/planning/`, API annulations ajoutées)
    - `01` : `Projet.status` + Annulé
    - `08`, `09`, `10` : numérotation sections corrigée (13.x→8.x, 14.x→9.x, 15.x→10.x)

### Session 31 (07/03/2026 — audits 06, 02, 01 + corrections Checklist/Roadmap)

#### Fichiers audités
187. **Clean `06-regles-decisions.md`** → 34 règles métier + 22 décisions techniques — aucune incohérence détectée, alignement parfait avec v11.0
188. **Clean `02-roles-permissions.md`** → 3 niveaux RBAC (plateforme/org/équipe), 6 rôles, matrice permissions 6×13 — documentation précise et cohérente
189. **Bug V01-1 `01-vision-concepts.md`** → DPAE definition (§Concepts métier clés) : "Déclaration Préalable À l'Embauche — obligatoire en France pour **chaque prestation**" (était "première prestation") + ajout "(Règle #3)"

#### Fichiers racine corrigés
190. **Corrections `Checklist Audit md.md`** :
    - Magic Links : "expirent après 24h" → "expirent bien après usage unique : LOGIN 15min, EMAIL_CHANGE 24h, CONFIRMATION/ACTIVATION/PLANNING_VIEW 7 jours"
    - Numéro règle : "Règle #30" → "Règle #26" (annulation représentation)
    - Notification : "notifie tous les collaborateurs CONFIRMÉS" → "notifie tous les collaborateurs affectés, quel que soit leur statut de confirmation"

191. **Correction `Roadmap de Lancement.md`** :
    - DPAE reminder timing : "à J-2" → "à J-1 (cron §21.2 — veille de la représentation)"

#### Features/Décisions confirmées de session 30
192. **heuresContrat (Int?)** → ajouté à Affectation model (`15`), documenté en `05` (Affectation §Champs), intégré aux workflows `03` §5.10, Pôle Emploi + Caisse des Congés Spectacles

### Session 32 (07/03/2026 — passe senior 04 — 5 bugs corrigés)
193. **B04-1 (IMPORTANT)** → `04` route table §"Espace organisation" : `/planning` rôle minimum "Directeur / RH" → **"Régisseur"**. §6.4 droits d'accès précise explicitement que REGISSEUR a accès à tous les projets (lecture seule pour ceux dont il n'est pas responsable). Régisseur = rôle minimum, pas Directeur.
194. **B04-2 (MOYEN)** → `04` table master API : `PATCH /api/affectations/[id]/relancer` absent. Route présente dans `03` §5.6 CAS F + `06` Règle #31, mais oubliée dans la table de référence `04`. Ajoutée avec note "(remet `relanceSentAt` à null)".
195. **B04-3 (MOYEN)** → `04` table master API : `GET /api/notifications/unread-count` absent. Route ajoutée dans `13` §13.8 (session 26 N-5 — polling badge 30s). Oubliée dans `04`. Ajoutée.
196. **B04-4 (MOYEN)** → `04` Espace collaborateur : `/mon-planning/subscribe.ics` absent. Route créée dans `06` Décision #9 (session 21 R-5 — abonnement iCal dynamique, token dans URL, sans session). Ajoutée dans la section Espace collaborateur avec note "Décision #9".
197. **B04-5 (MINEUR)** → `04` table master API : `POST /api/billing/checkout` et `GET /api/billing/portal` absents. Routes créées en session 15 (§18.0 — flux souscription Stripe). Ajoutées dans la table API & exports.

### Session 33 (07/03/2026 — passe senior 07, 08, 09 — 3 bugs corrigés)
198. **B07-1 (MINEUR)** → `07` §7.5 : titre "Nouveau modèle de données — CollaborateurSpecialite" stale. Ces champs (`specialites`, `yearsExperience`, `availableForTour`) sont des champs directs sur `Collaborateur` dans `15` (lignes 364-366), pas une entité séparée. Titre corrigé en "Extension du modèle Collaborateur — Spécialités" + note explicite vers `15`.
199. **B08-1 (IMPORTANT)** → `08` §8.5 + `15` `PosteRequisTemplate` : `isCritique Boolean @default(false)` absent. `PosteRequis.isCritique` existe (Règle #33 — statut 🔴 si non pourvu). Lors de l'import d'un template, tous les postes seraient créés `isCritique = false`, rendant silencieusement une représentation critique 🟡 au lieu de 🔴. Ajouté dans les deux fichiers.
200. **B09-1 (MOYEN)** → `09` §9.2 + §9.5 : bouton `[Trouver un remplaçant →]` pour un poste non pourvu pointait vers le workflow §10 (remplacement urgent). Or §10 nécessite une `affectationId` (collaborateur confirmé qui annule). Pour un poste jamais affecté, il n'y a pas d'affectation existante. Corrigé : `[Affecter d'urgence →]` + note explicite que le workflow §10 ne s'applique qu'aux annulations de confirmés.

### Session 34 (07/03/2026 — passe senior 11, 14, 16 — 5 bugs corrigés)
201. **B11-1 (MOYEN)** → `11` §11.6 flux de publication : `ActivityLog` entièrement absent. Pattern obligatoire de la spec : chaque action métier déclenche un log. `FEUILLE_DE_ROUTE_PUBLIEE` et `FEUILLE_DE_ROUTE_MODIFIEE` existent dans l'enum `ActivityLogAction` de `15` (lignes 629-630) mais n'étaient jamais appelés. Ajouté : `FeuilleDeRoute.statut = PUBLIEE + publishedAt = now() + ActivityLog: FEUILLE_DE_ROUTE_PUBLIEE` dans le flux publication, note `ActivityLog: FEUILLE_DE_ROUTE_MODIFIEE` pour les modifications post-publication.
202. **B14-1 (IMPORTANT)** → `14` §14.1 : `"Compte User créé avec role: MEMBER et accountStatus: ACTIVE"` — `accountStatus` n'existe **pas** sur `User` depuis session 22 (migré sur `Collaborateur`). Le Directeur créateur d'une organisation n'a pas de `Collaborateur` record associé. Corrigé : `role: MEMBER` uniquement, avec note explicite `(pas d'accountStatus sur User — voir Collaborateur.accountStatus)`.
203. **B14-2 (IMPORTANT)** → `14` §14.5 : page de connexion affichait `"lien valable 1 heure"`. `MagicLinkPurpose.LOGIN` expire en **15 minutes** (session 15, entrée 89). Corrigé : `"15 minutes"`.
204. **B16-1 (IMPORTANT)** → `15` `OrganizationMembership.joinedAt: DateTime @default(now())` — valeur non-nullable incompatible avec la détection des invitations en attente documentée dans `16` §16.4.1 (`"aucun joinedAt"` → invitation en attente). Avec `@default(now())`, `joinedAt` est toujours non-null à la création → impossible de distinguer "vient d'être invité" de "membre actif". Corrigé : `DateTime?` avec commentaire explicatif.
205. **B16-2 (MOYEN)** → `16` §16.4.1 + §16.4.3 workflow : membres en attente détectés via `accountStatus: GHOST` sur `User`. `accountStatus` est sur `Collaborateur`, pas sur `User`. Les membres staff (Régisseur, RH, Directeur) invités n'ont pas de `Collaborateur` record. Critère correct : `OrganizationMembership.joinedAt IS NULL`. Corrigé dans les deux endroits.

### Session 35 (07/03/2026 — passe senior 17, 19, 20, 22, 24 — 10 bugs corrigés)
206. **B15-extra (IMPORTANT)** → `15` enum `ActivityLogAction` : `FEUILLE_DE_ROUTE_MODIFIEE` absent. Ajouté dans `11` §11.6 en session 34 (B11-1) mais oublié dans l'enum `15`. Ajouté. Également `ROOMING_LIST_ENVOYEE` absent (§19.1.5) — ajouté. Total enum enrichi de 2 valeurs.
207. **B17-1 (MINEUR)** → `17` §17.8 : note "À appliquer dans `05` et `15`" stale — `suspendedAt`/`suspendedReason` présents depuis session 3. Corrigée : "✅ Déjà présents".
208. **B17-2 (MOYEN)** → `17` §17.5.1 : `ActivityLog: PLAN_CHANGED` pour une action admin → devait être `ADMIN_PLAN_OVERRIDE` (valeur distincte dans l'enum `15` ligne 652 : "SUPER_ADMIN change le plan manuellement"). `PLAN_CHANGED` = webhook Stripe normal. Corrigé.
209. **B17-3 (MOYEN)** → `17` §17.5 wireframe membres : colonne "Statut: GHOST" pour un Régisseur non activé. `accountStatus` est sur `Collaborateur`, les membres staff n'ont pas de `Collaborateur` record. Correct : `joinedAt IS NULL` → "En attente". Même architectural fix que B16-2 (session 34). Note explicative ajoutée sous le wireframe.
210. **B19-1 (MOYEN)** → `19` §19.5 : `Hebergement.checkIn/checkOut: DateTime` + `ChambreOccupant.nuitDu: DateTime` → doit être `Date` (date sans heure). Fix appliqué sur `05` en session 22 (DM-6) mais non répercuté dans `19`. Corrigé.
211. **B19-2 (IMPORTANT)** → `19` §19.1.5 + `15` : `ActivityLog: ROOMING_LIST_ENVOYEE` absent de l'enum `ActivityLogAction` dans `15`. Valeur ajoutée dans `15` (section Module Tournée). `19` documentait le log mais l'enum ne l'avait pas.
212. **B20-1 (MOYEN)** → `20` §20.5 Upgrade workflow : "Redirection vers le Stripe Customer Portal" → incorrect. Pour un premier abonnement (FREE → PRO), c'est une **Checkout Session** (`POST /api/billing/checkout` — cf. `18` §18.0). Le Customer Portal gère les abonnements existants. Corrigé avec note explicative distinguant les deux.
213. **B22-1 (IMPORTANT)** → `22` §22.8 : `accountStatus AccountStatus @default(GHOST)` listé comme champ `User` → `accountStatus` est sur `Collaborateur` depuis session 22 (DM-1), absent du modèle `User` dans `15` (vérifié lignes 273-302). Supprimé, remplacé par un commentaire explicatif.
214. **B24-1 (IMPORTANT)** → `24` §24.3.4 "Remplacement urgent" : `Purpose MagicLinkToken: CONFIRMATION (7 jours)` → incorrect. Le workflow §10 utilise `PropositionRemplacement.propositionToken` (token maison — DM-7 session 22), pas un `MagicLinkToken`. Les URLs `confirmUrl`/`refuserUrl` portent ce token. Corrigé.
215. **B24-2 (MOYEN)** → `24` §24.6.2 "Trial expiré" : déclencheur `Webhook Stripe customer.subscription.trial_will_end` → impossible en v1 (trial 100% app-side, `stripeCustomerId IS NULL`). Même bug que session 9 Bug 16 (corrigé dans `18.7` et `20.3` mais oublié dans `24`). Corrigé : "Cron `§21.3 Étape 2`".

### Session 36 (07/03/2026 — Phase 0 : socle technique code)
216. **`lib/notifications.ts`** → Catalogue complet des 16 types `NotificationType` (schéma Prisma), canaux `IN_APP | EMAIL | IN_APP_AND_EMAIL`, priorités `CRITIQUE | URGENT | INFO`, labels d'affichage, labels d'action (CTA), helpers `createInAppNotification` + `broadcastNotification`.
217. **`app/globals.css`** → Tailwind base + utilitaires `.sidebar-scroll` et `.scrollbar-hide`.
218. **`app/providers.tsx`** → `SessionProvider` NextAuth avec `refetchOnWindowFocus: false`.
219. **`app/(public)/layout.tsx`** → Layout minimal pages publiques (login, signup) — header logo + contenu centré.
220. **`components/layout/OrgSwitcher.tsx`** → Switcher multi-org client : dropdown avec liste des orgs, changement via `update({ organizationId })` + `router.refresh()`. Masqué si une seule org (nom fixe).
221. **`components/layout/NotificationBell.tsx`** → Cloche + badge (polling 30s `GET /api/notifications/unread-count`) + dropdown (chargement lazy, marquer lu, navigation `actionUrl`, horodatage relatif).
222. **`components/layout/Sidebar.tsx`** → Navigation par rôle (DIRECTEUR/REGISSEUR/RH vs COLLABORATEUR), liens actifs, OrgSwitcher intégré, profil utilisateur + bouton déconnexion.
223. **`app/(app)/layout.tsx`** → Shell authentifié Server Component : vérif session, redirection SUPER_ADMIN → `/admin`, guard onboarding, chargement orgs (joinedAt not null), rendu Sidebar + topbar + NotificationBell.
224. **Corrections cohérence schéma** : `logo` (pas `logoUrl`) sur `Organization`, `INFO` (pas `NORMAL`) dans `NotificationPriority`, enum `NotificationType` aligné sur `schema.prisma` (ajout `AFFECTATION_CREEE/MODIFIEE/ANNULEE`, suppression types non définis).

### Session 37 (07/03/2026 — audit Phase 0 + validation roadmap)
225. **Fix `Sidebar.tsx`** → Import `UserRole` inutilisé supprimé + variable `userRole` jamais consommée dans le JSX retirée. Import réduit à `OrganizationRole` uniquement.
226. **Fix `NotificationBell.tsx`** → Variable `priorityColor` (dead code) supprimée — seul `dotColor` est utilisé dans le rendu. Commentaire mis à jour.
227. **Roadmap `Roadmap de Lancement.md`** → Phase 0 entièrement cochée : 9/9 items `[ ]` → `[x]`, statut section mis à jour en `✅ (Complète — Session 36)`, références aux fichiers produits ajoutées.

### Session 38 (07/03/2026 — Phase 1 : Auth & Onboarding — code complet)

#### Nouveaux fichiers créés (23 fichiers)

**Auth & Magic Links**
228. **`lib/slug.ts`** → Utilitaire slug : `toSlug(name)` normalise accents/lowercase/dashes + `generateUniqueOrgSlug(name)` vérifie unicité DB avec compteur auto.
229. **`app/api/auth/signup/route.ts`** → `POST /api/auth/signup` — transaction Prisma : User + Organization (plan PRO, trialEndsAt now+14j) + OrganizationMembership (DIRECTEUR). Génère MagicLinkToken LOGIN (15min), envoie email Resend. 409 si email existe.
230. **`app/api/auth/magic-link/send/route.ts`** → `POST /api/auth/magic-link/send` — révoque les tokens LOGIN précédents non utilisés avant d'en créer un nouveau. Retourne toujours 200 (anti-énumération).
231. **`app/api/auth/magic-link/verify/route.ts`** → `GET /api/auth/magic-link/verify?token=xxx` — valide le token avant redirect. Échec → `/login?error=...`, succès → `/login/verify?token=xxx`.
232. **`app/api/auth/switch-org/route.ts`** → `POST /api/auth/switch-org` — valide membership + retourne OK. Le client appelle `session.update({ organizationId })` pour rafraîchir le JWT.

**Pages publiques Auth**
233. **`app/(public)/signup/page.tsx`** → Formulaire signup : prénom, nom, email pro, nom structure, type structure (7 options). Confirmation "vérifiez votre email" après succès. Erreur 409 si email existant.
234. **`app/(public)/login/page.tsx`** → Flux principal magic link (email → `POST /api/auth/magic-link/send`). Flux secondaire mot de passe via `signIn('credentials', ...)` (toggle bouton). Mapping erreurs NextAuth.
235. **`app/(public)/login/verify/page.tsx`** → Client component : appelle `signIn('magic-link', { token })` au mount. États : chargement spinner → succès (redirect `/dashboard`) → erreur (message).

**Wizard Onboarding**
236. **`app/(app)/onboarding/layout.tsx`** → Server Component : vérifie session + redirect `/dashboard` si `onboardingCompletedAt` défini. Layout minimal sans sidebar.
237. **`app/(app)/onboarding/page.tsx`** → Redirect `/onboarding/organisation`.
238. **`app/(app)/onboarding/organisation/page.tsx`** → Étape 1/3 : saisie ville (logo placeholder). Appelle `POST /api/onboarding/organisation`.
239. **`app/(app)/onboarding/premier-projet/page.tsx`** → Étape 2/3 : titre, type (9 ProjetType), dateDebut/dateFin. Bouton "Passer cette étape". Appelle `POST /api/onboarding/premier-projet`.
240. **`app/(app)/onboarding/equipe/page.tsx`** → Étape 3/3 : jusqu'à 3 invitations (email + rôle REGISSEUR/RH/COLLABORATEUR). "Terminer" → equipe API + `POST /api/onboarding/complete`. "Passer" → complete directement.

**Routes API Onboarding**
241. **`app/api/onboarding/organisation/route.ts`** → Met à jour `Organization.city`.
242. **`app/api/onboarding/premier-projet/route.ts`** → Crée `Projet` avec `title` (pas `titre`), `startDate/endDate` (pas `dateDebut/dateFin`), couleur aléatoire palette 12 (Règle #34), `regisseurId = session.user.id`.
243. **`app/api/onboarding/equipe/route.ts`** → Crée comptes GHOST (`contractType: 'INTERMITTENT'` — requis non-nullable), membership `joinedAt: null`, envoie magic link ACTIVATION (7j).
244. **`app/api/onboarding/complete/route.ts`** → Set `Organization.onboardingCompletedAt = new Date()`.

**Routes publiques**
245. **`app/(public)/affectation/[token]/confirmer/page.tsx`** → Page publique sans auth. Fetch affectation via `GET /api/affectations/confirmer?token=xxx`. Boutons confirmer/refuser → `POST`. Gère état déjà-confirmé/refusé.
246. **`app/api/affectations/confirmer/route.ts`** → GET : lit affectation via token CONFIRMATION (non invalidé — multi-use). POST : met à jour `confirmationStatus` atomiquement (Règle #15), token CONFIRMATION NOT invalidé.
247. **`app/(public)/mon-planning/view/[token]/page.tsx`** → Vue planning public via token PLANNING_VIEW. Affectations à venir avec badges statut, code couleur projet.
248. **`app/api/planning/view/route.ts`** → Token PLANNING_VIEW non invalidé (lecture seule réutilisable). Filtre : dates futures, non-annulées. Champs corrects : `projet.title`, `posteRequis.name`, `remuneration`.
249. **`app/(public)/documents/view/[token]/page.tsx`** → Ouvre automatiquement le document dans un nouvel onglet via signed URL.
250. **`app/api/documents/view/route.ts`** → Token DOCUMENT_ACCESS usage unique (invalidé après utilisation — Règle #17). Appelle `getDownloadPresignedUrl(s3Key)`.

**Middleware**
251. **`middleware.ts`** (modifié) → Matcher étendu pour exclure les routes API publiques : `api/auth/signup`, `api/auth/magic-link`, `api/affectations/confirmer`, `api/planning/view`, `api/documents/view`.

#### Bugs/corrections schema découverts pendant Phase 1
- `Projet.titre` → **`Projet.title`** (champ réel dans schema.prisma)
- `Projet.dateDebut/dateFin` → **`Projet.startDate/endDate`**
- `PosteRequis.intitule` → **`PosteRequis.name`**
- `Affectation.cachetCents` → **`Affectation.remuneration`**
- `getSignedDownloadUrl` → **`getDownloadPresignedUrl`** (nom réel dans lib/upload.ts)
- `Collaborateur.contractType` est non-nullable → valeur par défaut `'INTERMITTENT'` à passer à la création GHOST

---

## Ce qui reste à faire (backlog spec)

| Priorité | Item | Notes |
|----------|------|-------|
| ✅ Fait | **Schéma Prisma complet** | `docs/15-schema-prisma.md` — prêt à migrer |
| ✅ Fait | **Plans tarifaires** | `docs/20-plans-tarifaires.md` — FREE/PRO/ENTERPRISE, trial 14j, blocage |
| ✅ Fait | **Cron jobs** | `docs/21-cron-jobs.md` — 7 jobs compilés, vercel.json |
| ✅ Fait | **Paramètres compte** | `docs/22-settings-compte.md` — profil, sécurité, iCal |
| ✅ Fait | **Décisions tech** | Resend, Vercel+Railway — finalisées dans `06` et README |
| ✅ Fait | **Onboarding organisation** | Section 14 — /signup, wizard 3 étapes, checklist, états vides |
| ✅ Fait | **Paramètres organisation** | `docs/16-settings-organisation.md` — profil, membres, Stripe, danger zone |
| ✅ Fait | **Notifications in-app** | Section 13 — catalogue 16 types, groupement, priorités, SSE/polling |
| ✅ Fait | **Back-office SUPER_ADMIN** | `docs/17-back-office-super-admin.md` — dashboard, orgs, plans, logs |
| ✅ Fait | **Webhooks Stripe** | `docs/18-webhooks-stripe.md` — 6 événements, handlers, checklist Stripe |
| ✅ Fait | **Wireframes UI annulations** | Section 12 complétée — modals 12.1, 12.3, page RH 12.6, routes API 12.8 |
| ✅ Fait | **Module Tournée** | `docs/19-module-tournee.md` — hébergement, rooming list, flotte, préférences |

---

## Conventions de la spec

- **Wireframes ASCII** dans chaque fichier module, PAS dans `04`
- **Routes** → dans le fichier du module (contexte) ET dans `04` table master (référence exhaustive)
- **Règles métier** → numérotées dans `06`, référencées ailleurs avec `(Règle #X)`
- **Décisions techniques** → dans `06`, numérotées `#1 → #22`
- **Questions ouvertes v2** → section `X.9` à la fin de chaque module
- **Version doc** → dans le README (actuellement v10.0)
- **Ne pas remettre CHEF_POSTE dans OrganizationMembership.role** — c'est dans EquipeMembre.role

---

## Fichiers audités en mode senior (à jour session 31)

| Fichier | Session | Bugs corrigés |
|---------|---------|---------------|
| `05-data-models.md` | 22 | 7 |
| `15-schema-prisma.md` | 23 | 6 |
| `23-architecture-technique.md` | 24 | 6 |
| `21-cron-jobs.md` | 25 | 7 |
| `13-notifications.md` | 26 | 5 |
| `18-webhooks-stripe.md` | 27 | 6 |
| `10-remplacements-urgents.md` | 28 | 4 |
| `12-annulations-reports.md` | 29 | 5 |
| `03-workflows.md` | 30 | 7 + 1 feature |
| `06-regles-decisions.md` | 31 | ✅ Clean |
| `02-roles-permissions.md` | 31 | ✅ Clean |
| `01-vision-concepts.md` | 31 | 1 (V01-1: DPAE def) |
| `Checklist Audit md.md` (root) | 31 | 3 (Magic Links, Règle #, statut) |
| `Roadmap de Lancement.md` (root) | 31 | 1 (DPAE timing J-1) |
| `04-pages-interfaces-ux.md` | 32 | 5 (B04-1→5: routes) |
| `07-annuaire-collaborateurs.md` | 33 | 1 (B07-1: titre §7.5) |
| `08-templates-projets.md` | 33 | 1 (B08-1: isCritique manquant) |
| `09-chef-de-poste-dashboard.md` | 33 | 1 (B09-1: bouton affecter vs remplacer) |
| `11-feuille-de-route-logistique.md` | 34 | 1 (B11-1: ActivityLog publication) |
| `14-onboarding.md` | 34 | 2 (B14-1: accountStatus User + B14-2: magic link 15min) |
| `15-schema-prisma.md` | 34 | +1 (B16-1: joinedAt nullable) — total cumulé : 8 |
| `16-settings-organisation.md` | 34 | 2 (B16-1: joinedAt IS NULL + B16-2: accountStatus check) |
| `17-back-office-super-admin.md` | 35 | 3 (B17-1: note stale + B17-2: ADMIN_PLAN_OVERRIDE + B17-3: GHOST→En attente) |
| `19-module-tournee.md` | 35 | 2 (B19-1: DateTime→Date + B19-2: ROOMING_LIST_ENVOYEE enum) |
| `20-plans-tarifaires.md` | 35 | 1 (B20-1: Checkout vs Portal) |
| `22-settings-compte.md` | 35 | 1 (B22-1: accountStatus sur User) |
| `24-emails-templates.md` | 35 | 2 (B24-1: MagicLinkToken remplacement + B24-2: trial webhook) |
| `15-schema-prisma.md` | 35 | +2 enum (FEUILLE_DE_ROUTE_MODIFIEE + ROOMING_LIST_ENVOYEE) — total cumulé : 10 |

**Tous les fichiers `docs/` ont été audités en mode senior. ✅**

---

## Phase 0 — Code produit (session 36)

| Fichier | Statut |
|---------|--------|
| `app/globals.css` | ✅ Créé |
| `app/providers.tsx` | ✅ Créé |
| `app/(public)/layout.tsx` | ✅ Créé |
| `app/(app)/layout.tsx` | ✅ Créé — Server Component, guard onboarding, OrgSwitcher data |
| `components/layout/Sidebar.tsx` | ✅ Créé — navigation par rôle, liens actifs · Fix s37: import UserRole supprimé |
| `components/layout/OrgSwitcher.tsx` | ✅ Créé — multi-org, update() JWT |
| `components/layout/NotificationBell.tsx` | ✅ Créé — polling 30s, dropdown, mark read · Fix s37: dead code priorityColor supprimé |
| `lib/notifications.ts` | ✅ Créé — 16 types, canaux, helpers create/broadcast |
| `lib/prisma.ts` | ✅ Fait session précédente |
| `lib/auth.ts` | ✅ Fait session précédente |
| `lib/plans.ts` | ✅ Fait session précédente |
| `lib/email.ts` | ✅ Fait session précédente |
| `lib/upload.ts` | ✅ Fait session précédente |
| `lib/event-bus.ts` | ✅ Fait session précédente |
| `lib/api-response.ts` | ✅ Fait session précédente |
| `middleware.ts` | ✅ Fait session précédente — étendu en session 38 (routes publiques API) |
| `prisma/schema.prisma` | ✅ Fait session précédente — 809 lignes |
| `app/api/auth/[...nextauth]/route.ts` | ✅ Fait session précédente |

## Phase 1 — Code produit (session 38)

| Fichier | Statut |
|---------|--------|
| `lib/slug.ts` | ✅ Créé — toSlug + generateUniqueOrgSlug |
| `app/api/auth/signup/route.ts` | ✅ Créé — POST signup, transaction User+Org+Membership, magic link LOGIN |
| `app/api/auth/magic-link/send/route.ts` | ✅ Créé — envoi magic link, révocation anciens tokens, anti-énumération |
| `app/api/auth/magic-link/verify/route.ts` | ✅ Créé — validation token + redirect |
| `app/api/auth/switch-org/route.ts` | ✅ Créé — validation membership, refresh JWT côté client |
| `app/(public)/signup/page.tsx` | ✅ Créé — formulaire + confirmation email |
| `app/(public)/login/page.tsx` | ✅ Créé — magic link + mot de passe (toggle) |
| `app/(public)/login/verify/page.tsx` | ✅ Créé — signIn magic-link au mount + états |
| `app/(app)/onboarding/layout.tsx` | ✅ Créé — guard onboardingCompletedAt, layout minimal |
| `app/(app)/onboarding/page.tsx` | ✅ Créé — redirect étape 1 |
| `app/(app)/onboarding/organisation/page.tsx` | ✅ Créé — étape 1/3, ville |
| `app/(app)/onboarding/premier-projet/page.tsx` | ✅ Créé — étape 2/3, titre/type/dates + skip |
| `app/(app)/onboarding/equipe/page.tsx` | ✅ Créé — étape 3/3, 3 invitations max + skip |
| `app/api/onboarding/organisation/route.ts` | ✅ Créé — update Organization.city |
| `app/api/onboarding/premier-projet/route.ts` | ✅ Créé — create Projet (title, startDate, endDate, colorCode palette) |
| `app/api/onboarding/equipe/route.ts` | ✅ Créé — GHOST users, membership, magic link ACTIVATION |
| `app/api/onboarding/complete/route.ts` | ✅ Créé — set onboardingCompletedAt |
| `app/(public)/affectation/[token]/confirmer/page.tsx` | ✅ Créé — confirmation atomique publique |
| `app/api/affectations/confirmer/route.ts` | ✅ Créé — GET+POST, token CONFIRMATION multi-use |
| `app/(public)/mon-planning/view/[token]/page.tsx` | ✅ Créé — planning public collaborateur |
| `app/api/planning/view/route.ts` | ✅ Créé — token PLANNING_VIEW réutilisable |
| `app/(public)/documents/view/[token]/page.tsx` | ✅ Créé — ouverture document signed URL |
| `app/api/documents/view/route.ts` | ✅ Créé — token DOCUMENT_ACCESS usage unique, getDownloadPresignedUrl |
| `types/next-auth.d.ts` | ✅ Fait session précédente |
| `types/api.ts` | ✅ Fait session précédente |
| `hooks/useFeature.ts` | ✅ Fait session précédente |

**Phase 0 ✅ (s37) — Phase 1 ✅ (s38) — Phase 2 ✅ (s39) — Phase 3 ✅ (codé) — Phase 4 ✅ (codé) — Phase 5 : débogage runtime ✅ (s40-41)**

## Phase 2 — Code produit (session 39)

| Fichier | Statut |
|---------|--------|
| `app/(app)/page.tsx` | ✅ Créé — redirect `/dashboard` |
| `app/(app)/dashboard/page.tsx` | ✅ Créé — Server Component, double vue admin/collab, KPIs, DPAE, représentations, postes critiques |
| `app/(app)/projets/page.tsx` | ✅ Créé — Server Component, fetch projets + membres, sérialisation dates |
| `app/(app)/projets/ProjetsClient.tsx` | ✅ Créé — toggle grille/liste, filtres, modal création (9 types, palette 12 couleurs) |
| `app/(app)/projets/[id]/page.tsx` | ✅ Créé — Server Component, fetch complet avec equipes/représentations/membres |
| `app/(app)/projets/[id]/ProjetDetailClient.tsx` | ✅ Créé — 4 onglets avec URL sync `?onglet=`, header colorCode, canEdit/canSeeRH |
| `app/(app)/projets/[id]/onglets/OngletResume.tsx` | ✅ Créé — stats, prochaine représentation, équipes, infos projet |
| `app/(app)/projets/[id]/onglets/OngletRepresentations.tsx` | ✅ Créé — table, menu contextuel, modals unique + série (joursActifs) |
| `app/(app)/projets/[id]/onglets/OngletEquipePostes.tsx` | ✅ Créé — liste équipes, postes, modals équipe + poste (isCritique, defaultTimes) |
| `app/(app)/projets/[id]/onglets/OngletPlanning.tsx` | ✅ Créé — grille affectation SSE temps réel, modal affectation CDI/CDD/INTERMITTENT |
| `app/(app)/planning/page.tsx` | ✅ Créé — Server Component, fetch projets actifs |
| `app/(app)/planning/PlanningClient.tsx` | ✅ Créé — calendrier mois, navigation, chips colorés, filtre projet, légende |
| `app/globals.css` | ✅ Modifié — `.label-field` et `.input-field` ajoutés via `@layer components` |

### Notes techniques session 39

- **Server Components + Client Components** : toutes les pages font les requêtes Prisma côté serveur, passent des JSON sérialisés aux Client Components (dates `.toISOString()`)
- **SSE temps réel** : `OngletPlanning` ouvre un `EventSource` vers `/api/planning/[projetId]/stream`, refresh la grille sur `affectation_created/updated/deleted`
- **Grille d'affectation** : une ligne par slot (`requiredCount` lignes par poste), `[+]` sur les slots vides → modal affectation
- **Règle #33 statut visuel** : calculé dans `page.tsx` pour la liste des représentations + via l'API pour la grille
- **Bug corrigé** : `poste.nom` → `poste.name` dans `dashboard/page.tsx` (champ réel Prisma)
- **Phases 3 & 4 codées** — voir tableaux ci-dessous


## Phase 3 — Code produit

| Fichier | Contenu |
|---------|---------|
| `app/(app)/equipe/page.tsx` | ✅ Annuaire organisation — Server Component |
| `app/(app)/equipe/EquipeClient.tsx` | ✅ Liste collabs, filtres, inviter |
| `app/(app)/equipe/[id]/page.tsx` | ✅ Fiche collaborateur détaillée |
| `app/(app)/mon-equipe/page.tsx` | ✅ Vue chef de poste — mes équipes |
| `app/(app)/mon-planning/page.tsx` | ✅ Planning personnel collab — liste chrono |
| `app/(app)/notifications/page.tsx` | ✅ Centre notifications — pagination infinie |
| `app/api/collaborateurs/route.ts` | ✅ GET liste + POST créer collaborateur |
| `app/api/collaborateurs/inviter/route.ts` | ✅ POST inviter GHOST + magic link ACTIVATION |
| `app/api/collaborateurs/[id]/route.ts` | ✅ GET + PATCH + soft delete |
| `app/api/mon-equipe/route.ts` | ✅ GET membres de mes équipes |
| `app/api/mon-planning/route.ts` | ✅ GET affectations futures du collab connecté |
| `app/api/notifications/route.ts` | ✅ GET liste + PATCH marquer lu |
| `app/api/notifications/unread-count/route.ts` | ✅ GET count non lus (polling 30s) |
| `app/api/notifications/read-all/route.ts` | ✅ POST tout marquer lu |
| `app/api/ical/[token]/route.ts` | ✅ GET flux iCal dynamique (token dans URL) |

## Phase 4 — Code produit

| Fichier | Contenu |
|---------|---------|
| `app/(app)/rh/page.tsx` | ✅ Dashboard RH — guard RH/Directeur |
| `app/(app)/rh/RhDashboardClient.tsx` | ✅ Suivi DPAE, filtres, transitions statut |
| `app/(app)/settings/compte/page.tsx` | ✅ Paramètres compte — Server Component |
| `app/(app)/settings/compte/CompteSettingsClient.tsx` | ✅ Profil, sécurité, préférences, token iCal |
| `app/(app)/settings/organisation/page.tsx` | ✅ Paramètres org — Server Component |
| `app/(app)/settings/organisation/OrganisationSettingsClient.tsx` | ✅ Profil org, membres, facturation Stripe |
| `app/(app)/templates/page.tsx` | ✅ Bibliothèque templates — Régisseur/Directeur |
| `app/admin/page.tsx` | ✅ Back-office SUPER_ADMIN |
| `app/api/rh/route.ts` | ✅ GET tableau DPAE |
| `app/api/rh/[affectationId]/dpae/route.ts` | ✅ PATCH transition statut DPAE |
| `app/api/rh/export-csv/route.ts` | ✅ GET export paie CSV |
| `app/api/settings/organisation/route.ts` | ✅ GET + PATCH profil org |
| `app/api/settings/organisation/membres/route.ts` | ✅ GET membres + POST inviter membre staff |
| `app/api/settings/organisation/membres/[userId]/route.ts` | ✅ PATCH role + DELETE retirer membre |
| `app/api/me/route.ts` | ✅ GET + PATCH profil utilisateur |
| `app/api/me/preferences/route.ts` | ✅ PATCH preferences (timezone, notifs) |
| `app/api/me/change-email/route.ts` | ✅ POST changement email (pendingEmail + magic link EMAIL_CHANGE 24h) |
| `app/api/me/ical/regenerate/route.ts` | ✅ POST regenerer token iCal |
| `app/api/templates/route.ts` | ✅ GET liste + POST creer template |
| `app/api/templates/[id]/apply/route.ts` | ✅ POST appliquer template a un projet |
| `app/api/billing/checkout/route.ts` | ✅ POST Stripe Checkout Session |
| `app/api/billing/portal/route.ts` | ✅ GET Stripe Customer Portal |
| `app/api/webhooks/stripe/route.ts` | ✅ POST handler webhooks Stripe (6 evenements) |
| `app/api/admin/stats/route.ts` | ✅ GET stats plateforme |
| `app/api/admin/organisations/route.ts` | ✅ GET liste orgs |
| `app/api/admin/organisations/[id]/route.ts` | ✅ GET fiche org |
| `app/api/admin/organisations/[id]/plan/route.ts` | ✅ PATCH changer plan (ADMIN_PLAN_OVERRIDE) |
| `app/api/admin/organisations/[id]/suspendre/route.ts` | ✅ POST suspendre org |
| `app/api/admin/organisations/[id]/reactiver/route.ts` | ✅ POST reactiver org |
| `app/api/admin/logs/route.ts` | ✅ GET logs activite plateforme |
| `app/api/affectations/route.ts` | ✅ POST creer affectation (conflit -> hasConflict, DPAE auto) |
| `app/api/affectations/[id]/route.ts` | ✅ GET + PATCH + DELETE affectation |
| `app/api/affectations/[id]/relancer/route.ts` | ✅ PATCH relancer confirmation (nouveau token) |
| `app/api/planning/global/route.ts` | ✅ GET planning global (mois/semaine) |

### Session 40 (11/03/2026 — débogage runtime pass 1 — 7 bugs corrigés)

#### Contexte
Première session de test runtime de l'application complète. Navigation page par page avec Chrome, correction des erreurs 500 et crashes.

252. **Bug RT-1** → `app/api/collaborateurs/route.ts` : `prisma.collaborateur.findMany({ where: { organizationId } })` — `Collaborateur` n'a **pas** de champ `organizationId`. Fix : récupérer d'abord les `OrganizationMembership` de l'org, puis filtrer par `userId: { in: memberUserIds }`.

253. **Bug RT-2** → `app/(app)/settings/organisation/page.tsx` : `prisma.organization.findUnique({ where: { id, deletedAt: null } })` — `Organization` n'a **pas** de `deletedAt` (pas de soft delete sur Organization). `findUnique` n'accepte que les champs uniques dans `where`. Fix : `where: { id: orgId }` uniquement.

254. **Bug RT-3** → même fichier + `OrganisationSettingsClient.tsx` + `api/settings/organisation/route.ts` : champ `ville` utilisé partout → le champ Prisma s'appelle `city`. Fix : renommage global `ville` → `city` dans les 3 fichiers.

255. **Bug RT-4** → `app/(app)/equipe/[id]/page.tsx` : `prisma.collaborateur.findFirst({ where: { id, organizationId } })` — même bug `organizationId` absent. Fix : `where: { id, user: { memberships: { some: { organizationId } } } }`.

256. **Bug RT-5** → `app/api/collaborateurs/[id]/route.ts` (GET + PATCH) : `verifyOwnership(collab.organizationId, ...)` crash — pas de `organizationId` sur `Collaborateur`. Aussi `collab.numeroCongesSpectacles` → champ réel = `congesSpectaclesNumber`. Fix : requête avec membership filter, suppression `verifyOwnership`, correction nom de champ.

257. **Bug RT-6** → `lib/notifications.server.ts` : (a) `title` champ requis dans le modèle Prisma `Notification` mais absent du type `CreateNotificationInput` et des appels `create`. (b) `actionUrl` → champ réel = `link`. (c) `relatedEntityId` n'existe pas dans le schéma. Fix : réécriture complète du fichier avec les vrais noms de champs.

258. **Bug RT-7** → `app/api/collaborateurs/inviter/route.ts` : `findFirst({ where: { userId, organizationId } })` + `create({ data: { ..., organizationId } })` — `Collaborateur` n'a pas de `organizationId`. Fix : `findFirst({ where: { userId } })` et suppression de `organizationId` dans `create`.

### Session 41 (11/03/2026 — débogage runtime pass 2 — 5 bugs corrigés)

259. **Bug RT-8** → `app/api/rh/[affectationId]/dpae/route.ts` : `actionUrl: '/rh'` et `relatedEntityId: affectation.id` passés à `createInAppNotification` — anciens noms supprimés lors de la réécriture de `notifications.server.ts`. Fix : `link: '/rh'`, suppression de `relatedEntityId`.

260. **Bug RT-9** → `app/api/webhooks/stripe/route.ts` : les 4 appels à `createInAppNotification` utilisaient une **signature positionnelle** (ancienne API). La fonction attend désormais un objet `CreateNotificationInput`. Fix : conversion en objet avec `{ userId, organizationId, type, title, body, link, actionLabel }`.

261. **Bug RT-10** → `components/layout/NotificationBell.tsx` : type local `Notification` avait `actionUrl: string | null` et le handler utilisait `notif.actionUrl` → champ Prisma réel = `link`. Fix : `link: string | null` dans le type + `notif.link` dans le handler.

262. **Bug RT-11** → `app/api/collaborateurs/inviter/route.ts` (logique invitation) : un user déjà invité mais non activé (`joinedAt: null`) recevait `409 ALREADY_MEMBER` au lieu d'un renvoi d'invitation. Fix : distinction `joinedAt !== null` (membre actif → 409) vs `joinedAt === null` (en attente → renvoyer email + `200 "Invitation renvoyée"`).

---

## ⚠️ Patterns d'erreur connus — NE JAMAIS REPRODUIRE

> Ces erreurs ont toutes été rencontrées et corrigées en sessions de débogage runtime. À mémoriser absolument.

### 1. `Collaborateur` n'a PAS de `organizationId`

```typescript
// ❌ JAMAIS ça
prisma.collaborateur.findMany({ where: { organizationId } })
prisma.collaborateur.findFirst({ where: { id, organizationId } })
prisma.collaborateur.create({ data: { userId, organizationId, ... } })
verifyOwnership(collab.organizationId, organizationId) // crash

// ✅ Toujours filtrer via la relation membership
const memberships = await prisma.organizationMembership.findMany({
  where: { organizationId },
  select: { userId: true },
})
const memberUserIds = memberships.map((m) => m.userId)
prisma.collaborateur.findMany({ where: { userId: { in: memberUserIds } } })

// Ou pour un seul collab
prisma.collaborateur.findFirst({
  where: { id, user: { memberships: { some: { organizationId } } } },
})
```

### 2. `Organization` n'a PAS de `deletedAt`

```typescript
// ❌ JAMAIS ça
prisma.organization.findUnique({ where: { id, deletedAt: null } }) // crash Prisma

// ✅ Organization n'a pas de soft delete
prisma.organization.findUnique({ where: { id } })
```

### 3. `findUnique` n'accepte que les champs uniques dans `where`

```typescript
// ❌ JAMAIS ça (deletedAt n'est pas un champ unique)
prisma.organization.findUnique({ where: { id, deletedAt: null } })

// ✅ Utiliser findFirst pour les filtres composites
prisma.projet.findFirst({ where: { id, organizationId, deletedAt: null } })
```

### 4. Champs Prisma réels sur `Collaborateur`

| Mauvais nom utilisé | Nom réel dans schema.prisma |
|--------------------|-----------------------------|
| `numeroCongesSpectacles` | `congesSpectaclesNumber` |
| `organizationId` | *(n'existe pas)* |
| `accountStatus` | `accountStatus` ✅ (sur `Collaborateur`, pas sur `User`) |

### 5. Champs Prisma réels sur `Notification`

| Mauvais nom utilisé | Nom réel dans schema.prisma |
|--------------------|-----------------------------|
| `actionUrl` | `link` |
| `relatedEntityId` | *(n'existe pas)* |
| `title` absent | `title String` — **requis**, utiliser `NOTIFICATION_LABELS[type]` comme fallback |

### 6. `createInAppNotification` — signature objet obligatoire

```typescript
// ❌ Ancienne signature positionnelle (SUPPRIMÉE)
createInAppNotification(userId, orgId, type, title, body, url, label)

// ✅ Signature objet actuelle (lib/notifications.server.ts)
createInAppNotification({
  userId, organizationId, type,
  title?: string,   // fallback = NOTIFICATION_LABELS[type]
  body: string,
  link?: string,    // était actionUrl — NOM PRISMA
  actionLabel?: string,
  groupId?: string,
})
```

### 7. Champs Prisma réels sur `Organization`

| Mauvais nom utilisé | Nom réel dans schema.prisma |
|--------------------|-----------------------------|
| `ville` | `city` |
| `deletedAt` | *(n'existe pas — pas de soft delete sur Organization)* |

### 8. Invitation collaborateur — distinguer membre actif vs en attente

```typescript
// ✅ Pattern correct pour l'invitation
const existing = await prisma.organizationMembership.findUnique({ ... })
if (existing) {
  if (existing.joinedAt !== null) {
    return 409 // membre actif — bloquer
  }
  // joinedAt === null → invitation en attente → renvoyer email
  return 200 // "Invitation renvoyée"
}
```

---

## Préférences de Sam

- Répond en français abrégé / texto ("oui grave", "bonne ideer", "on avance")
- Veut de la qualité et de la propreté — pas du bâclé
- Valide par questions avant de partir dans une direction
- Reporte les décisions floues ("je ne sais pas") — ne pas insister, noter en backlog
- Aime qu'on propose la prochaine étape logique à la fin
