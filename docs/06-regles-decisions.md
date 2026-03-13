# 📋 Règles métier & Décisions techniques
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

> 🔐 **Matrice des permissions** — Ce document définit les règles métier et techniques. Pour la matrice complète (QUI peut QUOI par rôle), voir [`02-roles-permissions.md`](./02-roles-permissions.md). Pour l'implémentation technique des rôles (JWT, helpers), voir `02-roles-permissions.md §3.7` et la décision #22 ci-dessous.

## Règles métier importantes

1. **Multi-tenant strict :** Chaque organisation est totalement isolée. Un collaborateur peut être invité dans plusieurs organisations (ex: un intermittent qui travaille pour deux théâtres différents).

2. **Conflit de planning :** Le système **ne bloque pas** l'affectation en cas de conflit horaire — il affiche un **avertissement ⚠️** dans le dropdown de sélection du collaborateur (tooltip détaillant le conflit). L'affectation peut être enregistrée malgré le conflit, mais un flag `hasConflict = true` est posé sur l'enregistrement `Affectation`. La détection s'effectue sur l'ensemble des affectations du collaborateur, toutes équipes et tous projets confondus (voir règle #20 pour le calcul cross-minuit).

3. **DPAE obligatoire :** Toute affectation d'un intermittent ou d'un CDD sur une représentation génère automatiquement un item "DPAE à faire" dans le tableau de bord RH — **sans exception, pour chaque engagement**, qu'il s'agisse de la première ou d'une prestation ultérieure pour le même projet. Seuls les CDI sont exemptés (leur contrat couvre l'ensemble des représentations). La DPAE doit être déclarée avant le début de chaque représentation concernée.

4. **Rémunération prévisionnelle :** Le montant affiché est calculé sur la base du cachet / taux horaire saisi lors de l'affectation. Il n'a pas valeur de bulletin de paie officiel.

5. **Suppression douce :** Les projets, représentations, affectations et documents supprimés sont archivés (soft delete — champ `deletedAt`) et conservés pour l'historique. Un collaborateur garde l'historique de ses représentations passées. Toutes les requêtes filtrent `WHERE deletedAt IS NULL` pour n'exposer que les entités actives.

6. **Annulation d'une représentation :** Quand une représentation est annulée, toutes les affectations associées sont notifiées automatiquement par email et in-app.

7. **Dernier Directeur :** On ne peut pas rétrograder le seul Directeur d'une organisation sans en désigner un autre.

8. **Invitation collaborateur :** Un intermittent ou CDD externe peut être invité uniquement pour un projet donné. Il n'a pas accès aux autres projets de l'organisation.

9. **Données sensibles :** Le numéro de sécurité sociale et les informations bancaires (IBAN) sont chiffrés en base (AES-256). Seul le rôle RH peut les consulter. Les clés de chiffrement sont stockées séparément des données (AWS KMS ou équivalent).

10. **Stockage des pièces jointes :** Tous les documents (contrats scannés, pièces jointes) sont stockés sur **AWS S3**, jamais en base de données. Les URLs d'accès sont des signed URLs temporaires (expiration 1 heure) pour éviter toute exposition publique.

11. **Export CSV paie :** Le fichier exporté par le RH contient les colonnes : Nom, Prénom, N° Sécurité Sociale (masqué partiellement), Type contrat, Date représentation, Projet, Poste, Cachet HT, Statut DPAE. Compatible avec les logiciels SAGE, Cegid, et tout outil acceptant le CSV standard.

12. **Export iCal :** Le fichier `.ics` généré pour un collaborateur contient un événement par représentation (titre = projet + poste, lieu = salle + ville, description = rémunération prévue), limité aux affectations `CONFIRMEE`. L'export est déclenché depuis `/mon-planning` via une **modal proposant deux options** : (a) **Snapshot** — téléchargement direct du fichier `.ics` statique à l'instant T ; (b) **Lien d'abonnement** — URL de flux iCal dynamique à copier dans l'application calendrier, mis à jour automatiquement à chaque changement d'affectation.

13. **RGPD — Anonymisation après 3 ans :** Tout collaborateur sans activité (aucune affectation) depuis 3 ans est automatiquement anonymisé : son nom et prénom sont remplacés par "Collaborateur anonymisé", son email, N° SS, IBAN et téléphone sont effacés. Les affectations et données du projet sont conservées à des fins d'historique mais déliées de toute identité personnelle. Un job cron mensuel effectue cette vérification. Le collaborateur reçoit un email d'avertissement 30 jours avant l'anonymisation.

14. **Confirmation d'affectation — Token sécurisé :** Le lien de confirmation envoyé à l'intermittent contient un token UUID unique valable 7 jours. La page de confirmation (`/affectation/[token]/confirmer`) est accessible sans connexion pour faciliter la réponse. Passé 7 jours, le lien expire et l'affectation reste "En attente" — un nouveau lien peut être renvoyé par le régisseur.

15. **Confirmation atomique :** Chaque date est confirmée ou refusée indépendamment, sans validation globale. Dès qu'un intermittent coche une réponse, la cellule correspondante dans la grille du régisseur se met à jour en temps réel. Il n'y a pas d'état "formulaire en cours de remplissage" côté serveur — chaque clic est une action complète et immédiate.

16. **Compte fantôme (Lazy Auth) :** Un collaborateur invité par un régisseur obtient automatiquement un compte avec `Collaborateur.accountStatus = GHOST` et aucun mot de passe. Il peut interagir avec le système entièrement via des liens magiques temporaires (confirmation, consultation planning, téléchargement documents). L'activation d'un vrai compte avec mot de passe est volontaire et optionnelle — elle fait passer `Collaborateur.accountStatus` de `GHOST` à `ACTIVE`. **`User.role` reste toujours `MEMBER`** quel que soit le statut du compte. La règle d'or : **jamais un formulaire d'inscription entre l'intermittent et sa réponse au régisseur.**

17. **Magic links — Sécurité :** Chaque lien magique est à usage unique par action (un token par purpose). Un token de confirmation d'affectation ne peut pas être réutilisé pour accéder aux documents. Les tokens sont invalidés après usage ou expiration. Ils sont générés côté serveur (crypto.randomUUID) et jamais dérivés d'informations prévisibles.

18. **Chef de poste — Périmètre strict :** Un chef de poste ne peut voir, modifier ou exporter que les données de son équipe sur son projet. Il n'a aucune visibilité sur les autres équipes, même au sein du même projet. Cette isolation est appliquée au niveau de l'API (filtre sur `equipeId`), pas uniquement côté interface.

19. **Héritage des horaires :** Quand un chef de poste (ou régisseur) affecte un collaborateur à une représentation, les champs `startTime` et `endTime` de l'affectation sont pré-remplis depuis `PosteRequis.defaultStartTime/EndTime`. Le régisseur ou chef peut les ajuster ponctuellement sans modifier les valeurs par défaut du poste.

20. **Conflits inter-équipes :** La détection de conflit s'effectue sur l'ensemble des affectations du collaborateur, toutes équipes et tous projets confondus. Si Alice est en équipe Technique sur Peter Pan de 11h à 16h le 14 mars, elle ne peut pas être affectée par une autre équipe ou un autre projet aux mêmes horaires.

21. **Architecture des rôles — 3 niveaux distincts :** Les autorisations sont vérifiées à trois niveaux indépendants. (1) `User.role: SUPER_ADMIN` → accès back-office plateforme. (2) `OrganizationMembership.role` → ce que l'utilisateur peut faire dans une organisation donnée (DIRECTEUR, REGISSEUR, RH, COLLABORATEUR). (3) `EquipeMembre.role: CHEF` → accès chef de poste sur une équipe spécifique d'un projet. Un COLLABORATEUR peut être CHEF sur une équipe sans changer son rôle d'organisation. Les middlewares API vérifient ces trois niveaux selon l'action demandée.

22. **Conflit de planning — calcul cross-minuit :** La détection de conflit convertit `Representation.date + Affectation.startTime/endTime` en DateTime complets. Si `endTime < startTime` (ex: startTime "23:00", endTime "01:00"), on ajoute 24h à endTime pour le calcul. Deux affectations sont en conflit si leurs intervalles `[date+start, date+end]` se chevauchent.

23. **Seuil annulation tardive :** Une annulation d'affectation ou de représentation est qualifiée de "tardive" si elle intervient dans les **48 heures** précédant le début de la représentation (`showStartTime`). Ce seuil déclenche le workflow Remplacement Urgent et marque le cachet comme `A_DECIDER`.

24. **Cascade d'annulation de projet :** Lors de l'annulation d'un projet, seules les représentations **futures** (date > aujourd'hui) sont annulées. Les représentations passées restent intactes (statut inchangé) pour la traçabilité et la paie.

25. **Conflit de date lors d'un report :** Si un report de représentation est choisi avec l'option "Maintenir les affectations", une vérification de conflits est obligatoire avant d'enregistrer. Un conflit non résolu est signalé ⚠️ dans les plannings des collaborateurs concernés — jamais bloqué silencieusement.

26. **Notification systématique d'annulation :** Toute annulation (affectation, représentation ou projet) déclenche une notification immédiate à tous les collaborateurs concernés, quel que soit leur statut de confirmation (EN_ATTENTE, CONFIRMEE, REFUSEE inclus).

27. **DPAE et annulations — responsabilité hors app :** L'app détecte les DPAE déjà soumises sur les représentations annulées et affiche une alerte. Elle ne soumet jamais de déclaration corrective. La régularisation auprès de l'URSSAF est toujours une démarche manuelle hors app.

28. **Plans et blocage quota :** Quand une action dépasserait le quota du plan actuel (ex : inviter un 4ème collaborateur sur plan FREE), l'action est bloquée proprement avec un message d'information et un lien vers `/settings/organisation#facturation`. Aucune donnée n'est jamais supprimée pour respecter un quota. Un downgrade qui dépasse les limites passe l'organisation en lecture seule (`Organization.isReadOnly = true`) — les données restent intactes. Voir détail → `20-plans-tarifaires.md`

29. **Uploads de fichiers — contraintes :** Tous les fichiers uploadés (documents, contrats, avatars, logos) sont limités à **5 Mo** par fichier. Formats acceptés : **PDF, JPG, PNG**. Les fichiers sont stockés sur AWS S3 avec structure `org_id/user_id/[type]/[filename]`. Les avatars et logos acceptent en plus le SVG avec une limite de 2 Mo. Les URLs sont des signed URLs temporaires (expiration 1h — cf. règle #10).

30. **Navigation multi-organisation :** Un utilisateur peut être membre de plusieurs organisations (ex : un intermittent qui travaille pour deux théâtres). Un switcher d'organisation est affiché en haut de la sidebar sous forme de dropdown. Cliquer sur une organisation change le contexte actif (store global + cookie de session). Les données affichées (projets, planning, rémunération) sont toujours scoped à l'organisation active. Les notifications sont filtrées par organisation active.

31. **Relances automatiques — une seule par affectation :** Le cron de relance (§21.1) n'envoie qu'une seule relance par affectation (tracé par `Affectation.relanceSentAt`). Si l'intermittent ne répond toujours pas après la relance, c'est au régisseur d'agir manuellement : soit renvoyer un nouveau lien via `PATCH /api/affectations/[id]/relancer` (remet `relanceSentAt` à `null` pour permettre une nouvelle relance cron), soit affecter un autre collaborateur.

32. **Trial — passage en lecture seule :** Si le trial PRO expire et que l'organisation a plus de 3 collaborateurs (limite FREE), elle passe en mode lecture seule (`Organization.isReadOnly = true`). Toute création ou modification est bloquée. Les données sont conservées 30 jours avant suspension. Voir détail → `20-plans-tarifaires.md §20.3`

33. **Statut visuel planning global — calcul par représentation :** Le statut affiché sur chaque card du planning global (`/planning`) est calculé côté serveur à la volée pour chaque représentation. Logique : **🟢 Vert** = tous les postes requis sont pourvus (ratio 100%) · **🟡 Jaune** = des postes manquants mais aucun `PosteRequis.isCritique = true` n'est non pourvu · **🔴 Rouge** = au moins un `PosteRequis.isCritique = true` est non pourvu. Ce calcul est exposé dans `GET /api/planning/global` via le champ `hasPosteCritiqueManquant`. Il n'est **pas** mis en cache — recalculé à chaque requête sur la base de l'état actuel des affectations.

34. **Couleur de projet — palette fixe :** Chaque projet possède un `colorCode` hexadécimal (`Projet.colorCode`) choisi à la création depuis une palette fixe de 12 couleurs prédéfinies. L'utilisateur ne peut pas saisir un hex libre — la palette garantit un contraste suffisant sur fond blanc et entre projets simultanés. La couleur est utilisée uniquement dans le planning global pour différencier visuellement les projets. Elle n'a aucune signification sémantique (statut, urgence, etc.).

---

## Décisions techniques validées

Toutes les décisions structurantes ont été tranchées. Ce tableau fait foi pour le développement.

| # | Sujet | Décision retenue | Impact |
|---|-------|-----------------|--------|
| 1 | **Modèle économique** | Abonnement mensuel par organisation | `Organization.plan` + Stripe |
| 2 | **Export paie** | CSV générique (SAGE, Cegid, Excel) | Route `/rh/export` |
| 3 | **Salles par projet** | Variables par représentation (pas de salle fixe sur la prod) | `Representation.venueName/City/Address` |
| 4 | **Confirmation affectation** | Oui pour les intermittents / Non pour CDI-CDD / Tous notifiés | `Affectation.confirmationStatus` + token email |
| 5 | **Dark mode** | ❌ Non — gain de temps de dev, CSS light-mode uniquement | CSS light-mode uniquement |
| 6 | **Stockage PJ** | AWS S3 + signed URLs temporaires (1h) | `Document.s3Key` + AWS SDK |
| 7 | **Langue** | Français uniquement — PMF marché local avant internationalisation | `locale: 'fr'` fixe |
| 8 | **Notifications SMS** | ❌ Non — email + in-app suffisent. Canal déterminé à l'envoi par la logique applicative, pas stocké en base | `lib/notifications.ts` (constante TypeScript, pas un champ Prisma) |
| 9 | **Export calendrier** | iCal (`.ics`) — compatible Google/Apple/Outlook. Modal 2 options : snapshot statique (téléchargement direct) + lien d'abonnement dynamique | Route `/mon-planning/export.ics` (snapshot) + `/mon-planning/subscribe.ics` (abonnement) |
| 10 | **RGPD — rétention données** | Anonymisation après 3 ans d'inactivité | `Collaborateur.anonymizedAt` + cron mensuel |
| 11 | **Confirmation partielle** | Atomique — chaque date confirmée/refusée indépendamment, effet immédiat dans la grille | `Affectation.confirmationStatus` mis à jour en temps réel |
| 12 | **Compte collaborateur** | Lazy Auth — compte fantôme (GHOST) par défaut, activation volontaire (ACTIVE). `User.role` reste toujours `MEMBER` | `Collaborateur.accountStatus` (GHOST/ACTIVE/INACTIF) + `MagicLinkToken` |
| 13 | **Sous-équipes** | Équipes libres par projet avec chef de poste nommé — isolation stricte des données | `Equipe` + `EquipeMembre.role: CHEF/MEMBRE` |
| 14 | **Créneaux horaires** | Get-in / Warmup / Show / Get-out définis par représentation, heures par collaborateur | `Representation.getInTime…getOutTime` + `Affectation.startTime/endTime` |
| 15 | **Type de projet** | 9 types (Théâtre, Concert, Cirque, Maintenance…) — adapte le vocabulaire et les champs | `Projet.type` enum |
| 16 | **Mises à jour temps réel** | Server-Sent Events (SSE) — la grille du régisseur reçoit les confirmations en push sans polling | Route `/api/planning/[projetId]/stream` (SSE endpoint) |
| 17 | **Architecture des rôles** | Rôle plateforme sur `User.role` (SUPER_ADMIN/MEMBER) · Rôle org sur `OrganizationMembership.role` · Rôle équipe sur `EquipeMembre.role` (CHEF/MEMBRE) — 3 niveaux distincts | Filtre API : vérifier les 3 niveaux selon l'action |
| 18 | **Provider email** | **Resend** — intégration native Next.js, DX excellente, SDK TypeScript first-party | `resend.emails.send()` + templates React Email |
| 19 | **Hébergement** | **Vercel** (front + API Next.js) + **Railway** (PostgreSQL managé) — ou Supabase si on préfère le tout-en-un managé | `DATABASE_URL` Railway · `NEXTAUTH_URL` Vercel |
| 20 | **Plans tarifaires** | 3 tiers : FREE (0€, 3 collabs), PRO (49€, 20 collabs), ENTERPRISE (149€, illimité) — trial 14j PRO à l'inscription | Voir `20-plans-tarifaires.md` · `lib/plans.ts` |
| 21 | **Cron jobs** | Vercel Cron Jobs (7 jobs) — relances, DPAE J-1, trial expiration, RGPD, nettoyage tokens | Voir `21-cron-jobs.md` · `vercel.json` |
| 22 | **Auth — contexte utilisateur enrichi** | À la connexion (NextAuth JWT callback), on pré-calcule le contexte complet : `orgRole` (depuis `OrganizationMembership`) + `chefEquipes: string[]` (depuis `EquipeMembre WHERE role = CHEF`). Stocké dans le JWT/session, disponible dans toutes les routes API sans requête DB supplémentaire. Un helper `lib/auth/getUserContext.ts` expose `canAffecter(session, equipeId)`, `canVoirRH(session)`, etc. | `lib/auth/getUserContext.ts` · callback `jwt` NextAuth · voir `02-roles-permissions.md §3.7` |

---