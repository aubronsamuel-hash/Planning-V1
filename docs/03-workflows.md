# 🔄 Workflows principaux
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

## Workflows principaux

> **Ce fichier contient les 15 workflows en version condensée.** Pour chaque workflow complexe, un document dédié approfondit les détails (états vides, edge cases, implémentation).

### 🗺️ Mapping Workflow → Documentation détaillée

| Workflow | Section ici | Doc détaillée | Règles associées |
|----------|-------------|---------------|-----------------|
| Onboarding organisation | §5.1 | [14 — Onboarding](./14-onboarding.md) | — |
| Créer un projet | §5.2 | [04 — Pages & UX §projet](./04-pages-interfaces-ux.md) | Règle #34 (couleur) |
| Ajouter des représentations | §5.3 | [04 — Pages & UX](./04-pages-interfaces-ux.md) | Règle #22 (cross-minuit) |
| Affecter un collaborateur | §5.4 | [09 — Dashboard Chef](./09-chef-de-poste-dashboard.md) | Règles #2, #18, #19, #20 |
| Confirmation intermittent | §5.5 | [06 — Règles #14, #15](./06-regles-decisions.md) | Règles #14, #15 |
| Inviter un collaborateur | §5.6 | [07 — Annuaire](./07-annuaire-collaborateurs.md) | Règle #16 (GHOST) |
| Remplacement urgent | §5.7 | [10 — Remplacements](./10-remplacements-urgents.md) | Règle #23 (seuil 48h) |
| Annulation représentation | §5.8 | [12 — Annulations](./12-annulations-reports.md) | Règles #24, #26, #27 |
| Report de représentation | §5.9 | [12 — Annulations §12.3](./12-annulations-reports.md) | Règle #25 |
| Export CSV paie | §5.10 | [06 — Décision #2](./06-regles-decisions.md) | Règle #11 |
| Export iCal | §5.11 | [06 — Décision #9](./06-regles-decisions.md) | Règle #12 |
| Notifications | §5.12 | [13 — Notifications](./13-notifications.md) | Règle #26 |
| DPAE | §5.13 | [06 — Règle #3](./06-regles-decisions.md) | Règles #3, #27 |
| Facturation & plans | §5.14 | [20 — Plans tarifaires](./20-plans-tarifaires.md) | Règles #28, #32 |
| RGPD — Anonymisation | §5.15 | [21 — Cron Jobs §21.5](./21-cron-jobs.md) | Règle #13 |

---

### 5.1 Onboarding — Nouvelle organisation

> Version condensée. Détail complet (wizard 3 étapes, états vides, checklist) → `14-onboarding.md`

```
[Directeur sur /signup]
    → Saisie : prénom, nom, email pro, nom de la structure, type
    → Soumission :
        → User créé (role: MEMBER, accountStatus: ACTIVE)
        → Organization créée (plan: PRO, trialEndsAt: now() + 14 jours,
                              stripeCustomerId: NULL)  ← restera NULL pendant tout le trial
        → OrganizationMembership créée (role: DIRECTEUR)
        → Magic link de connexion envoyé par email (pas de mot de passe)
        → Redirection vers le wizard /onboarding

[Wizard de configuration — 3 étapes, toutes optionnelles sauf étape 1]
    → Étape 1 : Nom de la structure · Ville · Logo (optionnel)
    → Étape 2 : Créer le premier projet (nom, type, dates)
               ["Passer cette étape" → pas de projet créé]
    → Étape 3 : Inviter jusqu'à 3 personnes (email + rôle)
               → Comptes GHOST créés + magic links envoyés

    → [Terminer] → Organization.onboardingCompletedAt = now()
    → Redirection vers /dashboard avec checklist de démarrage (5 items)
```

---

### 5.2 Créer un projet

```
[Directeur ou Régisseur connecté]
    → Clic sur "+ Nouveau projet"
    → Formulaire :
        - Titre (ex: "Peter Pan")
        - Sous-titre / édition (ex: "Saison 2026")
        - Type : Théâtre | Comédie musicale | Concert | Opéra | Danse | Cirque
                  | Maintenance | Événement | Autre
        - Couleur (`colorCode`) : sélecteur palette fixe 12 couleurs (Règle #34)
          → Utilisée pour identifier le projet dans le planning global (§6.4)
        - Régisseur responsable (choix dans la liste des régisseurs)
        - Date de début / fin prévisionnelles
        - Affiche / visuel (upload image, optionnel)
        - Statut initial : En préparation
    → [Créer]
        → Projet créé
        → Redirection vers la page du projet
        → Prompt : "Voulez-vous ajouter des représentations maintenant ?"
```

---

### 5.3 Ajouter des représentations à un projet

```
[Régisseur ou Directeur sur la page d'un projet]
    → Onglet "Représentations" → "+ Ajouter"
    → OPTION A — Représentation unique :
        - Date
        - Heure de début / fin
        - Lieu (salle, ville, adresse)
        - Type : Représentation | Répétition | Filage | Générale | Avant-première
                  | Intervention | Événement
        - Notes internes
    → OPTION B — Série de représentations (ex: "40 dates") :
        - Date de début / date de fin
        - Jours de la semaine concernés (Lu Ma Me Je Ve Sa Di)
        - Heure fixe pour toutes
        - Lieu fixe ou variable
        - Exclusions manuelles (ex: "pas le 24 déc.")
        → Prévisualisation : "Cela va créer 40 représentations. Confirmer ?"
    → [Valider]
        → Représentations créées et affichées dans le planning
```

---

### 5.4 Constituer les équipes d'un projet

```
[Régisseur sur la page d'un projet → onglet "Équipe & Postes"]

    ─────────────────────────────────────────────────────
    ÉTAPE 1 — Créer les équipes (groupes de postes)
    ─────────────────────────────────────────────────────
    → "+ Nouvelle équipe"
        - Nom de l'équipe (ex: "Technique", "Salle", "Billetterie")
        - Chef de poste : sélection dans l'annuaire (EquipeMembre.role = CHEF)
          → Le chef de poste voit son équipe dans /mon-equipe (§9)
    → Possibilité d'importer la structure d'un projet existant (cf. §11.1C)

    ─────────────────────────────────────────────────────
    ÉTAPE 2 — Définir les postes dans chaque équipe
    ─────────────────────────────────────────────────────
    → "+ Ajouter un poste" (dans une équipe)
        - Nom du poste (ex: Éclairagiste, Machiniste, Artiste, Régisseur son)
        - Nombre de personnes requises par représentation (ex: 2 éclairagistes)
        - Poste critique ? (isCritique : ☑ / ☐)
          → Si ☑ et non pourvu : statut 🔴 dans le planning global (Règle #33)
          → Si ☐ et non pourvu : statut 🟡
        - Type de contrat attendu : CDI | CDD | Intermittent | Indifférent
        - Heure d'arrivée par défaut (defaultStartTime — ex: "19h30")  ← pré-remplit les affectations (Règle #19)
        - Heure de fin par défaut (defaultEndTime — ex: "23h00")       ← ajustable poste par poste

    ─────────────────────────────────────────────────────
    ÉTAPE 3 — Associer des collaborateurs aux postes
    ─────────────────────────────────────────────────────
    → Recherche dans l'annuaire de l'organisation (filtre par spécialité)
    → OU inviter un nouveau collaborateur (email → lien d'invitation)
        → Vérification : cet email existe-t-il déjà sur la plateforme ?
            → OUI : on réutilise le compte existant
            → NON : compte GHOST créé automatiquement (Lazy Auth — cf. workflow 5.7)
        → Email d'invitation envoyé avec magic link (pas de mot de passe requis)
        → Il est rattaché au projet avec son poste
```

---

### 5.5 Affecter des collaborateurs aux représentations

```
[Régisseur — vue Planning de le projet]
    → Affichage : grille avec représentations en colonnes, postes en lignes
    → Pour chaque cellule (représentation × poste) :
        → Clic → Dropdown des collaborateurs disponibles
            → Disponibilité vérifiée : croisement `Affectation.startTime/endTime`
              sur la même `Representation.date`
            → Si conflit détecté → collaborateur affiché avec ⚠️ dans le dropdown
              + tooltip "Déjà affecté sur [Projet X] ce jour-là (20h30→23h00)"
              → Le régisseur PEUT quand même affecter malgré le ⚠️ (pas de blocage dur)
              → L'affectation est créée avec un flag visuel de conflit dans la grille
              → Alerte dans le planning global inter-projets (§6.4 vue Semaine)
            → Couleur indiquant le type de contrat : CDI 🔵 | CDD 🟡 | Intermittent 🟠
        → Sélection → Affectation créée
            → Notification envoyée à TOUS les collaborateurs (CDI, CDD, Intermittent)
            → Pour les INTERMITTENTS uniquement :
                → Statut de l'affectation = "En attente de confirmation" ⏳
                → Email envoyé avec bouton "Confirmer ma disponibilité"
                → Le régisseur voit l'affectation en attente dans la grille
            → Pour les CDI et CDD :
                → Affectation directement validée ✅ (pas de confirmation requise)
                ⚠️  CHAMPS À PASSER EXPLICITEMENT à la création (les @default Prisma sont incorrects pour CDI/CDD) :
                    • confirmationStatus = NON_REQUISE  (non EN_ATTENTE)
                    • dpaeStatus = NON_REQUISE si CDI    (non A_FAIRE)
                    • dpaeStatus = A_FAIRE    si CDD     (DPAE requise — règle #3)
                    • dpaeStatus = A_FAIRE    si INTERMITTENT (DPAE requise — règle #3)
    → Alertes visuelles dans la grille :
        🔴 Poste non pourvu (aucun collaborateur affecté)
        🟡 Poste partiellement pourvu ou en attente de confirmation
        ✅ Poste complet et confirmé
```

---

### 5.6 Workflow côté Collaborateur — Réception et confirmation d'une affectation

```
[TOUS les collaborateurs — CDI, CDD, Intermittent]
    → Email envoyé à la création de chaque affectation
    → Si compte ACTIF : notification in-app également
    → Si compte GHOST : email uniquement (pas d'espace connecté actif)

════════════════════════════════════════════════════
CDI et CDD — confirmation automatique
════════════════════════════════════════════════════
    → Affectation directement validée ✅
    → Email informatif simple :
      "Vous êtes planifié(e) sur Peter Pan — Samedi 14 mars 20h30
       Poste : Régisseur son | Lieu : Théâtre du Châtelet"
    → Pas d'action requise

════════════════════════════════════════════════════
INTERMITTENTS — confirmation atomique (date par date)
════════════════════════════════════════════════════
    → Email de groupe envoyé quand le régisseur affecte l'intermittent
      sur plusieurs dates d'un même projet :

      "Bonjour Alice — Théâtre du Nord vous propose des dates sur Peter Pan"

      ☐ Sam 14/03 · 20h30 · Théâtre du Châtelet · 185,00 €
      ☐ Dim 15/03 · 15h00 · Théâtre du Châtelet · 185,00 €
      ☐ Mar 17/03 · 20h30 · Théâtre du Châtelet · 185,00 €
      ☐ Sam 21/03 · 20h30 · Théâtre du Châtelet · 185,00 €
      ☐ Dim 22/03 · 15h00 · Théâtre du Châtelet · 185,00 €

      → Chaque ligne a deux boutons : ✅ Dispo  |  ❌ Indispo
      → Pas de validation globale : chaque clic est immédiatement traité
        (confirmation atomique — sans rechargement de page)

    → EFFET IMMÉDIAT dans la grille du régisseur :
        Chaque réponse met à jour la cellule en temps réel :
        ✅ Vert   → confirmée
        ❌ Rouge  → refusée, poste à repourvoir → alerte régisseur
        ⏳ Gris   → en attente (pas encore répondu)

    → RÉCAPITULATIF affiché à l'intermittent après ses réponses :
      "Vous avez confirmé 4 dates ✅
       Vous avez signalé 1 indisponibilité ❌
       Le régisseur en a été informé automatiquement."

    → Puis proposition discrète en bas de page :
      "Retrouvez toutes vos dates et votre rémunération prévisionnelle
       en activant votre espace personnel. → [Créer mon accès]"

    → CAS C — Pas de réponse sous 48h :
        → Rappel automatique par email (une seule relance — cron §21.1)
        → Alerte dans le dashboard du régisseur : "⏳ Alice M. n'a pas répondu"
        → Le régisseur peut renvoyer le lien manuellement :
            PATCH /api/affectations/[id]/relancer
            → Génère un nouveau MagicLinkToken { purpose: CONFIRMATION, expiresAt: +7j }
            → Invalide l'ancien token (usedAt = now())
            → Email renvoyé à l'intermittent
        → OU affecter quelqu'un d'autre (annuler l'affectation EN_ATTENTE + réaffecter)

    → CAS D — Dates ajoutées après un premier email :
        → Si le régisseur affecte l'intermittent sur des dates SUPPLÉMENTAIRES
          après qu'un premier email de groupe a déjà été envoyé :
            → Email complémentaire envoyé (pas un nouvel email groupé complet)
              "Nouvelles dates ajoutées à votre planning Peter Pan :"
              [liste uniquement des nouvelles dates]
            → Les dates déjà confirmées/refusées restent intactes
        → Route : POST /api/affectations — l'email complémentaire est déclenché
          si `Affectation.relanceSentAt IS NOT NULL` sur d'autres affectations
          du même collaborateur + même projet (indicateur qu'un premier email a été envoyé)

    → CAS E — Token de confirmation expiré (7 jours) avant que la représentation soit passée :
        → Le collaborateur clique un lien expiré → page d'erreur avec contact régisseur
          (cf. §11.2 wireframe "Token expiré")
        → L'affectation reste EN_ATTENTE en base
        → Le régisseur voit toujours "⏳ En attente" dans la grille
        → Solution : le régisseur utilise "Renvoyer le lien" (CAS C)
          ou annule et réaffecte quelqu'un d'autre
        → ⚠️ Un token expiré ne passe PAS automatiquement l'affectation à REFUSEE
          (le collaborateur n'a peut-être juste pas eu le temps de répondre)
```

---

### 5.7 Cycle de vie du compte collaborateur (Lazy Auth)

```
ÉTAPE 1 — Création du compte fantôme
    [Régisseur saisit l'email d'un nouveau collaborateur]
        → Vérification : cet email existe-t-il déjà dans le système ?
            → OUI : on réutilise le compte existant (l'intermittent travaille déjà
                    pour une autre org sur la plateforme, ou a déjà été invité)
            → NON : compte GHOST créé automatiquement
                    accountStatus: GHOST | passwordHash: null
        → Email d'invitation envoyé :
          "Théâtre du Nord vous a ajouté sur la plateforme.
           Consultez vos dates → [Voir mes dates] (lien magique, 7 jours)"

ÉTAPE 2 — Accès via lien magique (sans mot de passe)
    [Intermittent clique sur le lien dans son email]
        → Page de confirmation / planning accessible sans login
        → Il peut : confirmer ses dates, voir son planning, télécharger ses docs
        → Chaque action sensible génère un nouveau magic link (purpose spécifique)
        → Le compte reste GHOST — aucun mot de passe requis
        ⚠️ "GHOST" ici = Collaborateur.accountStatus = GHOST
           (pas User.role — User.role vaut toujours MEMBER, jamais GHOST)

ÉTAPE 3 — Activation volontaire (optionnelle)
    [L'intermittent clique sur "Créer mon accès"]
        → Formulaire minimal : choisir un mot de passe (email déjà connu)
        → Collaborateur.accountStatus passe à ACTIVE (pas User.role qui reste MEMBER)
        → Il accède maintenant à son espace complet :
            • Historique de toutes ses projets (toutes orgs confondues)
            • Récapitulatif de rémunération multi-employeurs
            • Documents centralisés
            • Notifications in-app

ÉTAPE 4 — Cas du compte inactif (RGPD — §21.5)
    [Cron mensuel — s'applique à GHOST et ACTIVE sans distinction]
        → Si aucune affectation depuis 3 ans → email d'avertissement J-30 :
          "Votre compte sera anonymisé dans 30 jours en raison d'inactivité"
        → Si toujours inactif après 30 jours supplémentaires → anonymisation :
            • Nom / prénom → "Collaborateur anonymisé"
            • Email, N°SS, IBAN, téléphone effacés
            • Affectations conservées mais déliées de toute identité personnelle
        ⚠️  Le statut GHOST ne court-circuite pas l'avertissement — le cron §21.5
            n'applique aucun filtre sur accountStatus.
```

---

### 5.8 Export iCal — Abonnement de planning

```
[Collaborateur connecté — page /mon-planning]
    → Bouton "📅 Exporter iCal" → ouvre un modal avec deux options :
        A. Télécharger le fichier .ics (snapshot instantané)
           → Import manuel dans Google / Apple / Outlook
        B. Copier le lien d'abonnement (URL permanente avec token, se met à jour)
           → Coller dans l'appli calendrier
           → Le calendrier se synchronise automatiquement
              à chaque mise à jour du planning
           → Token révocable depuis /settings/ical (génère une nouvelle URL)
    ⚠️ Le wireframe §6.5 montre un bouton unique "Exporter iCal" — au clic,
       ce modal s'ouvre pour présenter les deux options.
    → Format de chaque événement :
        SUMMARY    : "Peter Pan — Éclairagiste"
        DTSTART    : heure de début de l'affectation (startTime)
        DTEND      : heure de fin de l'affectation (endTime)
        LOCATION   : "Théâtre du Châtelet, Paris"
        DESCRIPTION: "Cachet prévu : 185,00 € | Statut : Confirmée"
                     + lien vers la page de l'affectation
    → Seules les affectations CONFIRMEES et NON_REQUISES
      sont incluses (pas les EN_ATTENTE)
    → L'URL d'abonnement inclut un token sécurisé unique
      par collaborateur (révocable depuis les paramètres)
```

---

### 5.9 Suivi des DPAE (intermittents & CDD)

```
[RH / Admin paie — vue DPAE]
    → Liste de toutes les affectations nécessitant une DPAE
      (intermittents + CDD — DPAE requise à CHAQUE engagement, pas uniquement le premier.
       Seuls les CDI sont exemptés : dpaeStatus = NON_REQUISE à la création.)
    → Statut par affectation :
        ⬜ À faire     → pas encore envoyée
        🟡 En cours    → envoyée, en attente de confirmation
        ✅ Confirmée   → DPAE validée
    → Action : marquer comme envoyée / confirmée
    → Alerte : toute affectation sans DPAE confirmée à J-1 remonte en rouge
    → Export CSV générique pour transmission à SAGE, Cegid, ou tout logiciel de paie
      Colonnes exportées : Nom | Prénom | N°SS | Type contrat | Date | Projet
                           Poste | Cachet HT | DPAE statut
```

---

### 5.10 Vue rémunération du Collaborateur

```
[Collaborateur connecté → onglet "Ma rémunération"]
    → Sélecteur de période : mois en cours | mois précédent | par projet
    → Tableau :
        Date         | Projet    | Poste        | Type         | Heures | Montant prévu
        14/03/2026   | Peter Pan | Éclairagiste | Intermittent | 4h     | 185,00 €
        15/03/2026   | Peter Pan | Éclairagiste | Intermittent | 4h     | 185,00 €
        ...
        ──────────────────────────────────────────────────────────────────────────────
        TOTAL MARS                                               28h       | 1 480,00 €
    → Colonne "Heures" = Affectation.heuresContrat (null → "—" pour les CDI)
    → Note : "Ces montants sont prévisionnels. Le bulletin officiel est émis
               par votre gestionnaire de paie."

---

### 5.11 Remplacement urgent

> Déclenché par une annulation tardive (≤ 48h). Détail complet → `10-remplacements-urgents.md`

```
[Régisseur ou Chef de poste — grille planning]
    → Clic sur une cellule confirmée → [⚠️ Signaler une annulation tardive]
    → Raison optionnelle → [Confirmer l'annulation]

    → EFFET IMMÉDIAT :
        → Affectation.confirmationStatus = ANNULEE_TARDIVE
        → Affectation.cachetAnnulation = A_DECIDER
        → Cellule devient 🔴 dans la grille
        → Notification CRITIQUE envoyée au Régisseur + Chef de poste
        → Dashboard "Remplacements urgents" s'ouvre automatiquement

[Moteur de suggestion — scoring automatique]
    → Analyse l'annuaire de l'organisation :
        +4 pts  → A déjà travaillé sur CE projet
        +3 pts  → A travaillé sur un projet du même type
        +2 pts  → A déjà occupé CE poste
        +1 pt   → Type de contrat compatible (intermittent préféré)
        -10 pts → Conflit horaire sur cette date (éliminatoire)
        -5 pts  → Historique de non-réponse
    → Les 5 meilleurs candidats sont affichés

[Régisseur clique sur "Proposer le remplacement" — candidat sélectionné]
    → Email urgent envoyé au candidat :
        "Peter Pan · Éclairagiste · Sam 14/03 · 20h30
         [ ✅ Je suis disponible ]  [ ❌ Je ne suis pas disponible ]
         Lien valable 4 heures."
    → Grille : cellule → 🟡 "Proposition envoyée à Frank D."

    → Si le candidat accepte (< 4h) :
        → Affectation créée automatiquement (CONFIRMEE)
        → Notification au Régisseur + Chef de poste
        → Cellule → ✅ vert

    → Si refus ou pas de réponse (4h) :
        → PropositionRemplacement.status = REFUSEE | EXPIREE
        → Cellule repasse 🔴
        → Alerte : proposer le candidat suivant en un clic
```

---

### 5.12 Annulation d'une affectation

> Deux sous-cas selon le délai. Détail wireframes → `12-annulations-reports.md §12.1`

```
[Régisseur — grille planning]
    → Clic sur une cellule → Menu contextuel → [Annuler cette affectation]
    → Calcul : now() vs Representation.date + showStartTime

    CAS A — Annulation simple (> 48h avant) :
        → Modal informatif → [Confirmer l'annulation]
        → Affectation.confirmationStatus = ANNULEE
        → Affectation.annulationRaison = [raison saisie, peut être null]
        → Affectation.annulationDate = now()
        → Notification au collaborateur (email + in-app si compte ACTIF)
        → Poste redevient vacant 🔴 sur la grille
        → Pas d'implication cachet (cachetAnnulation reste null)
        → Régisseur peut déclencher un remplacement manuellement
        → ActivityLog: AFFECTATION_ANNULEE

    CAS B — Annulation tardive (≤ 48h avant) :
        → Modal avec bandeau ⚠️ "Cachet possiblement dû — le RH tranchera"
        → [Confirmer l'annulation]
        → Affectation.confirmationStatus = ANNULEE_TARDIVE
        → Affectation.annulationRaison = [raison saisie, peut être null]
        → Affectation.annulationDate = now()
        → Affectation.cachetAnnulation = A_DECIDER
        → Notification au collaborateur
        → Déclenchement automatique du workflow Remplacement urgent (§5.11)
        → ActivityLog: AFFECTATION_ANNULEE_TARDIVE
```

---

### 5.13 Annulation d'une représentation

> Acte grave — touche tous les collaborateurs affectés. Détail → `12-annulations-reports.md §12.2`

```
[Régisseur — page représentation ou grille planning]
    → [⚠️ Annuler cette date]
    → Modal récapitulatif :
        → Liste des collaborateurs affectés (avec statut confirmation + cachet)
        → Alerte si des DPAE ont déjà été soumises (régularisation URSSAF manuelle)
        → Raison optionnelle → [Confirmer]

    → Representation.status = ANNULEE
    → Representation.annulationReason = [raison] | annulationAt = now()
    → Toutes les affectations futures :
        > 48h → confirmationStatus = ANNULEE
        ≤ 48h → confirmationStatus = ANNULEE_TARDIVE
    → Affectations confirmées → cachetAnnulation = A_DECIDER
    → Notification à tous les collaborateurs affectés :
        "❌ Peter Pan · Sam 14/03 est annulée."
    → Feuille de route publiée (si présente) → ARCHIVEE automatiquement
    → Dashboard RH : bandeau "Cachets à valider" avec total A_DECIDER
    → ActivityLog: REPRESENTATION_ANNULEE (representationId, nbAffectationsImpactees)
```

---

### 5.14 Annulation d'un projet

> Décision de direction uniquement. Détail → `12-annulations-reports.md §12.3`

```
[Directeur — Paramètres du projet → Zone de danger → [Annuler ce projet]]
    → Modal récapitulatif :
        → Nb représentations futures concernées
        → Nb affectations futures concernées
        → Nb collaborateurs à notifier
        → Alerte DPAE soumises (régularisation manuelle hors app)
    → Raison optionnelle → [Confirmer l'annulation]

    → Projet.status = ANNULE
    → Représentations passées (date ≤ now()) : inchangées
    → Représentations futures (date > now()) :
        → status = ANNULEE | annulationAt = now() | annulationReason = [raison]
    → Affectations futures confirmées :
        → confirmationStatus = ANNULEE_TARDIVE si ≤ 48h, ANNULEE sinon
        → cachetAnnulation = A_DECIDER
    → Notification Régisseurs + Chefs de poste + Collaborateurs affectés
    → ActivityLog: PROJET_ANNULE

    ⚠️ Règle #24 : seul le Directeur peut annuler un projet.
    ⚠️ Distinct de "Archiver" (fin normale, Projet.status = ARCHIVE,
       aucune représentation ni affectation touchée).
```

---

### 5.15 Report d'une représentation

> Déplace une date, ne l'annule pas. Détail → `12-annulations-reports.md §12.4`

```
[Régisseur — page représentation → [Modifier la date]]
    → Sélection de la nouvelle date
    → Si des collaborateurs sont déjà affectés :

    OPTION A — Maintenir les affectations :
        → Représentation.date = nouvelle date
        → Représentation.status = REPORTEE (ancienne) + nouvelle créée
        → Représentation.reporteeVersId = [id de la nouvelle représentation]
        → Représentation.annulationAt = now() (horodatage du report)
        → Vérification de conflits sur la nouvelle date :
            → Si conflit détecté → choix : exclure le collaborateur | maintenir avec ⚠️

        ┌─ Pour les INTERMITTENTS (confirmationStatus ≠ NON_REQUISE) ──────────────
        │   → confirmationStatus = EN_ATTENTE
        │   → Nouveau magic link de reconfirmation envoyé
        │   → Notification : "🔄 Peter Pan reportée au 21/03 — reconfirmez votre présence."
        └────────────────────────────────────────────────────────────────────────────

        ┌─ Pour les CDI / CDD (confirmationStatus = NON_REQUISE) ───────────────────
        │   → confirmationStatus reste NON_REQUISE  ← pas de magic link, pas de reconfirmation
        │   → Notification informative uniquement :
        │     "🔄 Peter Pan est reportée au 21/03. Votre présence est maintenue."
        └────────────────────────────────────────────────────────────────────────────

    OPTION B — Repartir de zéro :
        → Toutes les affectations → ANNULEE
        → Représentation créée sur la nouvelle date (sans affectations)
        → Notification d'annulation aux collaborateurs concernés

    → ActivityLog: REPRESENTATION_REPORTEE (ancienneRepresentationId, nouvelleRepresentationId)

    ⚠️ Règle #25 : si "Maintenir" est choisi, la vérification de conflits
    est obligatoire. Un conflit non résolu reste affiché ⚠️ dans le
    planning du collaborateur.
```

---

### 5.16 Changement d'email (pendingEmail)

> Flux de modification de l'adresse email d'un utilisateur avec confirmation double opt-in.

```
[Utilisateur — Paramètres > Mon compte → [Changer mon adresse email]]
    → Saisit la nouvelle adresse souhaitée

    → Validation immédiate :
        → Vérifier que la nouvelle adresse n'est pas déjà utilisée par un autre User
        → Vérifier format email valide (RFC 5322)
        → Si erreur → message d'erreur, stop

    → Écriture en base :
        → User.pendingEmail = nouvelle adresse (l'ancienne reste active)
        → User.email inchangé — connexion toujours possible avec l'ancienne adresse

    → Envoi email de confirmation vers la NOUVELLE adresse :
        → MagicLinkToken { userId, purpose: EMAIL_CHANGE, expiresAt: now + 24h }
        → Template : emails/email-change-confirm.tsx
        → Objet : "Confirmez votre nouvelle adresse email"

    → L'utilisateur clique le lien de confirmation dans le délai de 24h :
        GET /api/auth/verify?token=…&purpose=EMAIL_CHANGE
            → Vérifier token valide + non expiré
            → User.email = User.pendingEmail
            → User.pendingEmail = null
            → MagicLinkToken.usedAt = now()
            → Redirection : /dashboard?message=email_changed
            → ActivityLog: { action: EMAIL_CHANGED, metadata: { oldEmail, newEmail } }
              ✅ `EMAIL_CHANGED` est présent dans l'enum `ActivityLogAction` de `15-schema-prisma.md`.

    → Si le lien expire sans confirmation :
        → User.pendingEmail reste en base (visible dans les settings comme "en attente")
        → L'utilisateur peut relancer une nouvelle demande (génère un nouveau token,
          invalide l'ancien)

    ⚠️ Règle #26 : tant que pendingEmail est non null, la bannière
    "Confirmation d'adresse en attente" est affichée dans les paramètres.
    ⚠️ Règle #27 : un User ne peut pas avoir plus d'un pendingEmail simultané.
    Toute nouvelle demande remplace le token précédent.
```

---

### 5.17 Cycle de vie d'un Collaborateur

> Relation entre `User` (compte plateforme) et `Collaborateur` (profil dans une organisation).

#### Modèle de données

```
User                         Collaborateur
────────────────────         ─────────────────────────────────
id                     ←──  userId (nullable)
email                        organizationId
role: MEMBER                 prenom / nom
                             contractType
                             confirmationMode
                             accountStatus
```

- Un `Collaborateur` est **toujours rattaché à une organisation** (via `organizationId`).
- Un `Collaborateur` peut exister **sans User** (`userId = null`) — c'est un contact RH pur (non invité à la plateforme).
- Un `Collaborateur` lié à un User peut être `accountStatus: GHOST` (invité mais pas encore activé) ou `ACTIVE` (compte activé).
- Un `User` peut être `Collaborateur` dans **plusieurs organisations** (ex: régisseur freelance).

#### ÉTAPE 1 — Création d'un Collaborateur

```
[REGISSEUR ou RH — Annuaire → [Nouveau collaborateur]]
    → Saisie : prénom, nom, email, contractType, confirmationMode
    → Recherche : un User existe-t-il déjà avec cet email ?

    CAS A — User existant trouvé :
        → Collaborateur { userId: user.id, accountStatus: ACTIVE ou GHOST selon user }
        → OrganizationMembership créé : { userId: user.id, organizationId, role: COLLABORATEUR }
        → Email de notification : "Vous avez été ajouté à {{organizationName}}"

    CAS B — Aucun User existant :
        → User créé : { email, role: MEMBER }  ← ⚠️ jamais role: GHOST — GHOST est Collaborateur.accountStatus
        → Collaborateur { userId: user.id, accountStatus: GHOST }
        → OrganizationMembership créé : { userId, organizationId, role: COLLABORATEUR }
        → Email d'activation envoyé → template emails/activation.tsx
          (MagicLinkToken purpose: ACTIVATION, expires: 7j)

    CAS C — Collaborateur RH pur (sans compte plateforme, sans email) :
        → Collaborateur { userId: null, accountStatus: GHOST }
        → Pas d'OrganizationMembership
        → Pas d'email envoyé
        → Le collaborateur peut être affecté à des représentations
          mais ne peut pas confirmer/refuser via magic link
          (confirmationMode = NON_REQUISE forcé)
```

#### ÉTAPE 2 — Activation du compte GHOST

```
[Collaborateur GHOST reçoit l'email d'activation → clique le lien]
    GET /activate?token=…
        → Token valide + purpose: ACTIVATION + non expiré
        → Collaborateur.accountStatus = ACTIVE  (GHOST → ACTIVE)
          ⚠️ User.role reste MEMBER inchangé — ce n'est pas lui qui passe à ACTIVE.
             Le statut GHOST est porté par Collaborateur.accountStatus, pas User.role.
        → MagicLinkToken.usedAt = now()
        → Redirection : /onboarding (§14)
```

#### ÉTAPE 3 — Désactivation / suppression d'un Collaborateur

```
[DIRECTEUR ou REGISSEUR — Annuaire → [Désactiver / Supprimer le collaborateur]]
    → Collaborateur.accountStatus = INACTIF (soft disable)
    → OrganizationMembership supprimé (hard delete — la relation n'a plus de sens)
    → Les affectations passées sont conservées (historique)
    → Les affectations futures en statut EN_ATTENTE → ANNULEE
    → Notification email : "Votre accès à {{organizationName}} a été révoqué"

    ⚠️ Règle #28 : la suppression d'un Collaborateur dans une org
    ne supprime PAS le User sous-jacent (qui peut appartenir à d'autres orgs).
    ⚠️ Règle #29 : un Collaborateur avec userId = null peut être supprimé
    (hard delete) sans impact sur un User.
    ⚠️ Règle #30 : impossible de supprimer un Collaborateur avec des
    affectations CONFIRMEE à venir — forcer l'annulation d'abord.
```

#### Résumé des états

| `accountStatus` | `userId` | Description |
|-----------------|----------|-------------|
| `GHOST` | non null | Invité, email envoyé, pas encore activé |
| `GHOST` | null | Contact RH pur, pas de compte plateforme |
| `ACTIVE` | non null | Compte activé, accès à la plateforme |
| `INACTIF` | non null ou null | Désactivé, accès révoqué |

---

