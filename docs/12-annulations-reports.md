# ❌ Annulations & Reports
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

## Annulations & Reports

---

### Concept

L'annulation est l'un des événements les plus courants — et les plus douloureux — dans le spectacle vivant. Une salle qui se décommande, une jauge qui ne se remplit pas, une contamination dans l'équipe artistique. L'app doit gérer ces situations sans perdre la traçabilité des engagements pris (confirmations, DPAE, cachets dus).

**Quatre niveaux d'annulation :**

| Niveau | Déclencheur | Impact |
|--------|-------------|--------|
| Affectation | Un collaborateur est retiré d'une date | Notification individuelle, éventuel remplacement |
| Représentation | Toute une date est annulée | Toutes les affectations tombent, alerte DPAE |
| Projet | Le projet est abandonné | Toutes les représentations futures annulées |
| Report | La date est déplacée | Affectations maintenues ou recréées |

---

### 12.1 Annulation d'une affectation

L'annulation d'une affectation unique est distincte du remplacement urgent (§10) : elle peut être planifiée (> 48h) ou tardive (≤ 48h).

**Deux sous-cas :**

**a) Annulation simple (> 48h avant la représentation)**
- Statut : `ANNULEE`
- Le collaborateur est notifié
- Le poste redevient vacant sur la grille (badge 🔴)
- Pas d'implication sur le cachet
- Le régisseur peut déclencher manuellement un remplacement

**b) Annulation tardive (≤ 48h avant la représentation)**
- Statut : `ANNULEE_TARDIVE`
- Déclenche automatiquement le workflow Remplacement Urgent (§10)
- Le cachet peut être dû selon convention — marqué `cachetAnnulation: A_DECIDER` → RH tranche

**Point d'entrée — menu contextuel sur la grille planning :**

```
┌─────────────────────────────────────┐
│  ✅ David R.   Machiniste           │  ← cellule affectation (clic droit ou [⋯])
│  11:00 → 16:00 · 185 €             │
└─────────────────────────────────────┘
          ↓
┌─────────────────────────────────────┐
│  Voir la fiche                      │
│  Modifier les horaires              │
│  ─────────────────────────────────  │
│  Annuler cette affectation      ❌  │
└─────────────────────────────────────┘
```

**Modal — Annulation simple (> 48h avant la représentation) :**

```
┌──────────────────────────────────────────────────────────────────┐
│  Annuler l'affectation de David R. ?                   [✕]       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  👤 David R. — Machiniste                                        │
│  🎭 Peter Pan · Samedi 14 mars 2026 · 11:00 → 16:00             │
│                                                                  │
│  Délai : 8 jours avant la représentation                         │
│                                                                  │
│  Raison (optionnel)                                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  David R. sera notifié par email et notification in-app.         │
│  Le poste redeviendra vacant sur la grille.                      │
│                                                                  │
│                        [ Annuler ]  [ Confirmer l'annulation ]   │
└──────────────────────────────────────────────────────────────────┘
```

**Modal — Annulation tardive (≤ 48h avant la représentation) :**

```
┌──────────────────────────────────────────────────────────────────┐
│  Annuler l'affectation de David R. ?                   [✕]       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  👤 David R. — Machiniste                                        │
│  🎭 Peter Pan · Samedi 14 mars 2026 · 11:00 → 16:00             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  ⚠️  Annulation tardive — dans moins de 48h              │    │
│  │  Selon votre convention, le cachet peut être dû.         │    │
│  │  Le RH devra trancher. Un remplacement urgent            │    │
│  │  sera automatiquement proposé.                           │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Raison (optionnel)                                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│                        [ Annuler ]  [ Confirmer l'annulation ]   │
└──────────────────────────────────────────────────────────────────┘
```

**Workflow :**
```
[Régisseur — grille planning]
    → Clic sur l'affectation → Menu contextuel → [Annuler cette affectation]
    → Calcul : now() vs Representation.date + showStartTime
        > 48h → modal "annulation simple"
        ≤ 48h → modal "annulation tardive" avec bandeau ⚠️
    → [Confirmer l'annulation]
    → Affectation.confirmationStatus = ANNULEE | ANNULEE_TARDIVE
    → Affectation.annulationRaison = [raison saisie, peut être null]
    → Affectation.annulationDate = now()
    → Si ANNULEE_TARDIVE : cachetAnnulation = A_DECIDER
    → Notification au collaborateur
    → Si ANNULEE_TARDIVE → déclenchement workflow Remplacement Urgent (§10)
    → ActivityLog: AFFECTATION_ANNULEE         ← si > 48h (annulation simple)
               ou AFFECTATION_ANNULEE_TARDIVE  ← si ≤ 48h (annulation tardive)
```

---

### 12.2 Annulation d'une représentation

L'annulation d'une représentation entière est un acte grave qui touche tous les collaborateurs affectés.

**Workflow :**
```
[Régisseur — page représentation ou grille planning]
    → [⚠️ Annuler cette date]
    → Modal d'annulation :
      ┌─────────────────────────────────────────────────────┐
      │  ❌ Annuler Peter Pan · Samedi 14 mars 2026         │
      │                                                     │
      │  Raison (optionnel) :                               │
      │  [____________________________________________]     │
      │                                                     │
      │  Délai : 8 jours avant la représentation           │
      │                                                     │
      │  Collaborateurs affectés (12) :                     │
      │  ✅ David R. — confirmé · cachet 185€               │
      │  ✅ Alice M. — confirmée · cachet 185€              │
      │  ⏳ Bob K.  — en attente                            │
      │  … (9 autres)                                       │
      │                                                     │
      │  ⚠️ 3 DPAE ont été soumises pour cette date.       │
      │     Leur annulation doit être régularisée           │
      │     manuellement auprès de l'URSSAF.               │
      │                                                     │
      │  Les cachets seront à valider individuellement      │
      │  par le RH après annulation.                        │
      │                                                     │
      │  [ Annuler sans confirmation ]  [ ✔ Confirmer ]    │
      └─────────────────────────────────────────────────────┘
    → Representation.status = ANNULEE
    → Representation.annulationReason = [raison saisie]
    → Representation.annulationAt = maintenant
    → Toutes les affectations → ANNULEE ou ANNULEE_TARDIVE (si ≤ 48h)
    → Toutes les affectations confirmées → cachetAnnulation: A_DECIDER
    → Notification à tous les collaborateurs affectés :
      "❌ Peter Pan · Sam 14/03 est annulée. Votre régisseur vous contactera."
    → Feuille de route (si publiée) → ARCHIVEE automatiquement
    → ActivityLog: REPRESENTATION_ANNULEE (representationId, nbAffectationsImpactees)
```

**Après annulation — tableau de bord RH :**

Le RH voit une liste des affectations impactées avec le statut de cachet à trancher :

```
❌ Peter Pan · 14/03 — ANNULÉE
┌──────────────────┬──────────┬──────────────┬────────────────────────────┐
│ Collaborateur    │ Cachet   │ DPAE         │ Décision cachet            │
├──────────────────┼──────────┼──────────────┼────────────────────────────┤
│ David R.         │ 185,00 € │ ✅ Soumise   │ [✔ Dû] [✖ Annulé]         │
│ Alice M.         │ 185,00 € │ ✅ Soumise   │ [✔ Dû] [✖ Annulé]         │
│ Bob K.           │ 185,00 € │ ❌ Non soumise│ [✔ Dû] [✖ Annulé]         │
│ Carol L.         │  92,50 € │ ❌ Non soumise│ [✔ Dû] [✖ Annulé]         │
└──────────────────┴──────────┴──────────────┴────────────────────────────┘
  * DPAE soumises : régularisation URSSAF à faire manuellement hors app
```

---

### 12.3 Annulation d'un projet

L'annulation d'un projet est une décision de direction. Elle distingue l'**archivage** (fin normale) de l'**annulation** (abandon).

**Deux actions distinctes dans les paramètres du projet :**

| Action | Effet | Usage |
|--------|-------|-------|
| **Archiver** | `Projet.status = ARCHIVE` — lecture seule, historique conservé | Projet terminé proprement |
| **Annuler** | `Projet.status = ANNULE` — représentations futures annulées | Projet abandonné en cours de route |

**Point d'entrée :** Paramètres du projet → Zone de danger → `[Annuler ce projet]`

**Modal — Annulation d'un projet :**

```
┌──────────────────────────────────────────────────────────────────┐
│  Annuler le projet Peter Pan ?                         [✕]       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⚠️  Cette action va annuler toutes les représentations futures. │
│  Les représentations passées et leurs données sont conservées.   │
│                                                                  │
│  Impact immédiat :                                               │
│  • 5 représentations futures seront annulées                     │
│  • 38 affectations futures seront annulées                       │
│  • 18 collaborateurs seront notifiés                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  🔴  4 DPAE déjà soumises sur ces dates                  │    │
│  │  La régularisation doit être faite manuellement          │    │
│  │  auprès de l'URSSAF. L'app ne peut pas le faire.         │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Raison de l'annulation (optionnel)                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Les cachets des collaborateurs confirmés seront à valider       │
│  par le RH dans l'onglet Annulations du projet.                  │
│                                                                  │
│                      [ Annuler ]  [ Confirmer l'annulation ]     │
└──────────────────────────────────────────────────────────────────┘
```

**Workflow :**
```
[Directeur confirme]
    → Représentations passées : inchangées
    → Représentations futures (date > now()) : status = ANNULEE
        + annulationReason = [raison saisie]
        + annulationAt = now()
    → Affectations futures confirmées → ANNULEE_TARDIVE si ≤ 48h, ANNULEE sinon
    → Affectations futures confirmées → cachetAnnulation = A_DECIDER
    → Projet.status = ANNULE
    → Notification régisseurs + chefs de poste :
      "❌ Le projet Peter Pan a été annulé. [Raison]"
    → Notification collaborateurs affectés sur dates futures
    → ActivityLog: PROJET_ANNULE
```

> **Note :** Seul le Directeur peut annuler un projet. Le Régisseur peut annuler des représentations individuelles.

---

### 12.4 Report d'une représentation

Un report déplace la date d'une représentation. C'est différent d'une annulation : la date existe toujours, elle est juste déplacée.

**Workflow :**
```
[Régisseur — page représentation → [Modifier la date]]
    → Sélecteur de nouvelle date
    → Si des collaborateurs sont déjà affectés :
      ┌────────────────────────────────────────────────────────┐
      │  🔄 Reporter Peter Pan · 14/03 → 21/03               │
      │                                                        │
      │  12 collaborateurs sont affectés à cette date.        │
      │  Que faire de leurs affectations ?                    │
      │                                                        │
      │  ○ Maintenir les affectations sur la nouvelle date    │
      │    (intermittents → reconfirmation / CDI-CDD : info)  │
      │                                                        │
      │  ○ Annuler toutes les affectations                    │
      │    (repartir de zéro pour la nouvelle date)           │
      └────────────────────────────────────────────────────────┘
    → Ancienne Representation : status = REPORTEE, reporteeVersId = [id nouvelle]
    → Ancienne Representation : annulationAt = now() (horodatage du report)
    → Nouvelle Representation créée avec la nouvelle date, status = PLANIFIEE
    → Lien de traçabilité : ancienne.reporteeVersId → nouvelle.id
    → ActivityLog: REPRESENTATION_REPORTEE (ancienneRepresentationId, nouvelleRepresentationId)
```

**Deux options de report :**

**Option A — Maintenir les affectations :**
- La représentation change de date, les affectations sont conservées
- Vérification automatique des conflits sur la nouvelle date

Pour les **INTERMITTENTS** (`confirmationStatus ≠ NON_REQUISE`) :
- `confirmationStatus` → `EN_ATTENTE`
- Nouveau magic link de reconfirmation envoyé
- Notification : "🔄 Peter Pan a été reportée au 21/03. Merci de reconfirmer votre présence. [Lien]"

Pour les **CDI / CDD** (`confirmationStatus = NON_REQUISE`) :
- `confirmationStatus` reste `NON_REQUISE` — aucun magic link, aucune reconfirmation requise
- Notification informative uniquement : "🔄 Peter Pan est reportée au 21/03. Votre présence est maintenue."

**Option B — Repartir de zéro :**
- Toutes les affectations passent en `ANNULEE`
- La représentation est créée avec la nouvelle date et aucune affectation
- Le régisseur repart du planning vierge

**Résolution de conflits lors du maintien :**

Si un collaborateur a déjà une autre affectation sur la nouvelle date :
```
⚠️ Conflit détecté pour 2 collaborateurs sur le 21/03 :
│ David R.   — affecté sur "Macbeth · 21/03" (même créneau)
│ Carol L.   — affecté sur "Macbeth · 21/03" (même créneau)
│
│ Que faire pour ces collaborateurs ?
│ ○ Les exclure de la date reportée (laisser le poste vacant)
│ ○ Les maintenir (ils verront un conflit dans leur planning)
```

---

### 12.5 Statuts et modèles de données

**Nouveaux statuts sur `Representation` :**

```
Representation
├── status: PLANIFIEE | CONFIRMEE | ANNULEE | REPORTEE
│   → PLANIFIEE  : état par défaut à la création
│   → CONFIRMEE  : tous les postes requis sont pourvus et confirmés
│   → ANNULEE    : date annulée (voir annulationAt + annulationReason)
│   → REPORTEE   : date déplacée (voir reporteeVersId)
├── annulationReason: String?     ← raison saisie par le régisseur
├── annulationAt:     DateTime?   ← horodatage de l'annulation
└── reporteeVersId:   String?     ← id de la nouvelle représentation si reportée
```

**`Affectation.confirmationStatus` complet (mise à jour) :**

```
EN_ATTENTE        ← invitation envoyée, en attente de réponse
CONFIRMEE         ← collaborateur a confirmé via magic link
REFUSEE           ← collaborateur a refusé
NON_REQUISE       ← confirmation automatique (CDI ou décision régisseur)
ANNULEE           ← annulation simple (> 48h) — pas d'implication cachet
ANNULEE_TARDIVE   ← annulation ≤ 48h — cachet possiblement dû
```

**Nouveau champ `Affectation.cachetAnnulation` :**

```
Affectation
└── cachetAnnulation: A_DECIDER | DU | ANNULE    ← null si affectation non annulée
    → A_DECIDER  : annulation récente, RH n'a pas encore tranché
    → DU         : RH a validé que le cachet est dû malgré l'annulation
    → ANNULE     : RH a confirmé que le cachet n'est pas dû
```

> Ce champ n'est renseigné que lorsque `confirmationStatus = ANNULEE | ANNULEE_TARDIVE`.

**Alerte DPAE — logique de détection :**

Au moment de l'annulation d'une représentation, l'app interroge :
```
Affectation.dpaeStatus IN ('ENVOYEE', 'CONFIRMEE')
WHERE representationId = [id annulée]
```
Si au moins une DPAE est soumise → affiche le bandeau d'alerte rouge dans le modal de confirmation.
La régularisation elle-même est hors app (démarche URSSAF manuelle).

---

### 12.6 Affichage dans les interfaces

**Grille de planning (vue régisseur) :**

| Situation | Affichage |
|-----------|-----------|
| Représentation annulée | Ligne ~~barrée~~, fond grisé, badge 🚫 ANNULÉE |
| Représentation reportée | Badge 🔄 REPORTÉE → voir [nouvelle date] |
| Affectation annulée | Cellule grisée, badge ❌ |
| Affectation annulation tardive | Cellule rouge pâle, badge ⚠️ |

**Vue grille — exemple d'une date annulée :**

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Peter Pan                                              [+ Affectation]    │
├────────────────────┬──────────────────────────┬──────────────────────────-┤
│  POSTE             │  ~~Sam 14/03~~ 🚫        │  Dim 15/03                │
├────────────────────┼──────────────────────────┼───────────────────────────┤
│  Machiniste (×2)   │  ░░ ANNULÉE ░░░░░░░░░░   │  ✅ David R.              │
│                    │  ░░░░░░░░░░░░░░░░░░░░░░  │  ✅ Carol L.              │
├────────────────────┼──────────────────────────┼───────────────────────────┤
│  Régisseur son     │  ░░ ANNULÉE ░░░░░░░░░░   │  ✅ Bob K.                │
├────────────────────┼──────────────────────────┼───────────────────────────┤
│  Éclairagiste      │  ░░ ANNULÉE ░░░░░░░░░░   │  ⏳ Alice M.              │
└────────────────────┴──────────────────────────┴───────────────────────────┘
                               ↑
              [Raison : Jauge insuffisante — décision salle]
```

**Vue mobile collaborateur (mon planning) :**

```
┌──────────────────────────────────────────┐
│  ~~🎭 Peter Pan · Sam 14 mars~~          │
│  ❌ ANNULÉE                              │
│  Contactez votre régisseur pour          │
│  plus d'informations.                    │
└──────────────────────────────────────────┘
```

**Dashboard chef de poste :**

Les représentations annulées disparaissent de la grille des 14 jours roulants.
Un bandeau en haut de page liste les annulations récentes (< 7 jours) pour mémoire.

---

**Page RH — Suivi des annulations (`/projets/[id]/annulations`) :**

Accessible via l'onglet "Annulations" dans la page projet. Visible par RH et Directeur uniquement.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Peter Pan — Annulations & Cachets                                            │
├───────────────────────────────────────────────────────────────────────────────┤
│  [Toutes les dates ▾]   [Tous statuts cachet ▾]                              │
├───────────────────────────────────────────────────────────────────────────────┤
│  ❌ Sam 14/03 — Annulation simple (8 jours avant)                            │
│  Raison : "Jauge insuffisante — décision salle"                               │
├──────────────────┬──────────┬──────────────┬───────────────┬─────────────────┤
│  Collaborateur   │ Contrat  │ Cachet prévu │ DPAE          │ Décision cachet │
├──────────────────┼──────────┼──────────────┼───────────────┼─────────────────┤
│  David R.        │ Intermit.│   185,00 €   │ ✅ Soumise    │ [✔ Dû][✖ Annul]│
│  Alice M.        │ Intermit.│   185,00 €   │ ✅ Soumise    │ [✔ Dû][✖ Annul]│
│  Bob K.          │ Intermit.│   185,00 €   │ ❌ Non soumise│ [✔ Dû][✖ Annul]│
│  Carol L.        │ CDD      │    —         │ ❌ Non soumise │  —  (CDI/CDD)  │
├──────────────────┴──────────┴──────────────┴───────────────┴─────────────────┤
│  ⚠️  2 DPAE soumises → régularisation URSSAF à faire manuellement            │
│  💰  Total cachets A_DECIDER : 555,00 €                                       │
├───────────────────────────────────────────────────────────────────────────────┤
│  ⚠️  Dim 15/03 — Annulation tardive (18h avant)          [ Voir les détails ]│
│  3 collaborateurs · cachet A_DECIDER · Remplacement en cours                 │
└───────────────────────────────────────────────────────────────────────────────┘
  [ Exporter CSV — annulations du projet ]
```

**Règles d'affichage de la page RH :**
- Seules les affectations avec `confirmationStatus = ANNULEE | ANNULEE_TARDIVE` apparaissent.
- CDI et CDD : colonne "Décision cachet" affiche `—` (pas d'implication cachet pour eux). ⚠️ La colonne DPAE reste active pour les CDD (Règle #3 : DPAE requise pour toute affectation INTERMITTENT ou CDD).
- Boutons `[✔ Dû]` / `[✖ Annulé]` : action immédiate → `PATCH /api/affectations/[id]/cachet` → met à jour `cachetAnnulation = DU | ANNULE`.
- Une fois tranchée, la décision s'affiche en texte statique : `✔ Cachet dû` ou `✖ Cachet annulé` (non modifiable sans action explicite).
- Export CSV : colonnes `nom, prénom, contrat, poste, date_repré, cachet_prévu, dpae_status, décision_cachet`.

**Bandeau d'alerte — dashboard RH (`/rh`) :**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  💰 Cachets à valider suite aux annulations                             [→]  │
│  Peter Pan · 3 décisions en attente · Total : 555,00 €                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### 12.7 Nouvelles règles métier

**Règle #23 — Seuil annulation tardive**
L'annulation tardive est définie comme : annulation dans les **48 heures** précédant le début de la représentation (`showStartTime`). Ce seuil est configurable au niveau de l'organisation dans une version future.

**Règle #24 — Cascade d'annulation de projet**
Seules les représentations **futures** (date > aujourd'hui) sont annulées lors de l'annulation d'un projet. Les représentations passées restent intactes pour l'historique et la paie.

**Règle #25 — Conflit de date lors d'un report**
Si l'option "Maintenir les affectations" est choisie lors d'un report, une vérification de conflits est obligatoire. Un conflit non résolu (statut "maintenir quand même") est affiché à l'état ⚠️ dans le planning du collaborateur concerné.

**Règle #26 — Notification d'annulation**
Toute annulation (affectation, représentation, projet) déclenche une notification immédiate à tous les collaborateurs concernés, quel que soit leur statut de confirmation (y compris EN_ATTENTE et REFUSEE).

**Règle #27 — DPAE et annulation**
L'app ne soumet jamais de DPAE corrective. Elle détecte les DPAE soumises sur les représentations annulées et affiche une alerte. La démarche de régularisation auprès de l'URSSAF est toujours manuelle et hors app.

---

### 12.8 Routes

**Pages :**

| Route | Page | Rôle minimum |
|-------|------|:---:|
| `/projets/[id]/annulations` | Page RH — suivi cachets & annulations | RH |

**API :**

| Méthode | Route | Action | Rôle |
|---------|-------|--------|------|
| PATCH | `/api/affectations/[id]/annuler` | Annuler une affectation (simple ou tardive) | REGISSEUR |
| PATCH | `/api/representations/[id]/annuler` | Annuler une représentation | REGISSEUR |
| PATCH | `/api/representations/[id]/reporter` | Reporter une représentation | REGISSEUR |
| PATCH | `/api/projets/[id]/annuler` | Annuler un projet | DIRECTEUR |
| PATCH | `/api/affectations/[id]/cachet` | Trancher le cachet (`DU` ou `ANNULE`) | RH |
| GET | `/api/projets/[id]/annulations` | Lister les affectations annulées + statuts cachets | RH |
| GET | `/api/projets/[id]/annulations/export` | Export CSV des annulations du projet | RH |

---

### 12.9 Questions ouvertes

| # | Question | Impact |
|---|----------|--------|
| 1 | **Seuil configurable** : le délai d'annulation tardive (48h par défaut) devrait-il être paramétrable par organisation ? Certaines conventions collectives ont des seuils différents | Paramètre org |
| 2 | **Indemnité d'annulation** : calculer et afficher automatiquement l'indemnité due (% du cachet selon délai) | Règles métier complexes |
| 3 | **Motifs prédéfinis** : liste de raisons d'annulation standardisées (force majeure, décision salle, annulation artistique…) pour produire des statistiques | Analytics |
| 4 | **Annulation partielle d'un projet** : annuler uniquement certaines dates d'une tournée, pas toutes | UX complexe |
