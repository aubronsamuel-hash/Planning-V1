# 🖥️ Pages, Interfaces & UX
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

## Pages & Interfaces

### 6.1 Dashboard (`/dashboard`)

Vue d'accueil différente selon le rôle.

**Pour Directeur / Régisseur / RH :**

> ⚠️ Les KPIs sont différenciées par rôle — voir tableau ci-dessous. Chaque KPI est cliquable et redirige vers la page correspondante.

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│              │ ⚠️ Votre période d'essai se termine dans 3 jours.         │
│              │    [Voir les offres →]                          [✕]      │
│   SIDEBAR    ├──────────────────────────────────────────────────────────┤
│              │  Bonjour Sam 👋  —  Vendredi 27 fév. 2026               │
│ 🏠 Dashboard ├──────────────┬──────────────┬──────────────┬────────────┤
│ 🎭 Projets   │  Projets     │Représentations│Collaborateurs│DPAE à faire│
│ 📅 Planning  │  en cours    │  ce mois     │  actifs      │ (RH seul.) │
│ 👥 Équipe    │     4 →      │    37 →      │    28 →      │   5 🔴 →   │
│ 💶 RH / Paie ├──────────────┴──────────────┴──────────────┴────────────┤
│ ⚙️ Réglages  │ PROCHAINES REPRÉSENTATIONS                               │
│              │  Auj.  20h30  Peter Pan          Théâtre du Châtelet    │
│              │  Dem.  19h00  Garou — Concert    Zénith Paris           │
│              │  01/03 20h30  Peter Pan          Théâtre du Châtelet    │
│              ├─────────────────────────────────────────────────────────┤
│              │ POSTES NON POURVUS 🔴                                    │
│              │  Peter Pan — 03/03 — Machiniste (2 manquants)  →       │
│              │  Garou — 05/03 — Technicien son (1 manquant)   →       │
└──────────────┴─────────────────────────────────────────────────────────┘
```

**KPIs visibles par rôle :**

| KPI | DIRECTEUR | REGISSEUR | RH |
|-----|:---------:|:---------:|:--:|
| Projets en cours → `/projets` | ✅ | ✅ | ✅ |
| Représentations ce mois → `/planning` | ✅ | ✅ | ✅ |
| Collaborateurs actifs → `/equipe` | ✅ | ❌ | ✅ |
| DPAE à faire → `/rh/dpae` | ✅ | ❌ | ✅ |

**Bannière organisation :** affichée en haut du dashboard (fermable ✕, réapparaît au rechargement) selon l'état de l'organisation :
- `trialEndsAt` dans ≤ 3 jours → "Votre période d'essai se termine dans N jours. [Voir les offres →]" (orange)
- `isReadOnly = true` → "Votre organisation est en lecture seule. [Mettre à niveau →]" (rouge, non fermable)
- `suspendedAt IS NOT NULL` → "Votre compte est suspendu. Contactez le support." (rouge, non fermable)

**Pour Collaborateur :**

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│              │  Bonjour Alice 👋                                        │
│   SIDEBAR    ├──────────────────────────────────────────────────────────┤
│              │ 🟠 2 dates attendent votre confirmation  [Répondre →]    │
│ 🏠 Accueil   ├───────────────────────────┬──────────────────────────────┤
│ 📅 Mon plan. │ MES PROCHAINES DATES      │ MA RÉMUNÉRATION (mars)       │
│ 💶 Ma paie   │                           │                              │
│ 📄 Mes cont. │  14/03 · 20h30  ✅        │  Prévisionnel                │
│              │  Peter Pan                │  1 480,00 €                  │
│              │  Éclairagiste             │  8 représentations           │
│              │  Théâtre du Châtelet      │                              │
│              │                           │                              │
│              │  15/03 · 20h30  🟠        │                              │
│              │  Peter Pan        À conf. │                              │
│              │  Éclairagiste             │                              │
└──────────────┴───────────────────────────┴──────────────────────────────┘
```

**Bannière "À confirmer" :** affichée uniquement si des affectations avec `confirmationStatus = EN_ATTENTE` existent. Le lien "Répondre →" redirige vers `/mon-planning` avec filtre pré-appliqué sur les dates EN_ATTENTE. Disparaît quand toutes les affectations sont traitées.

**Badge par date :** ✅ = CONFIRMEE · 🟠 = EN_ATTENTE · ❌ = REFUSEE · *(aucun badge)* = NON_REQUISE (CDI/CDD)

---

### 6.2 Liste des projets (`/projets`)

#### Vue Grille (défaut)

```
┌──────────────┬──────────────────────────────────────────────────────────────┐
│              │  Projets                         [ + Nouveau projet ]        │
│   SIDEBAR    │  🔍 Rechercher...  [Statut ▾]  [2026 ▾]   [≡ Liste | ⊞ Grille]│
│              ├──────────────────────────────────────────────────────────────┤
│              │  ┌──────────────────┐  ┌──────────────────┐                 │
│              │  │▌ Peter Pan       │  │▌ Garou Concert   │  ← bande colorCode
│              │  │ 🎭 Comédie music.│  │ 🎤 Concert       │                 │
│              │  │ 40 représent.    │  │ 4 représent.     │                 │
│              │  │ 28 collabor.     │  │ 12 collabor.     │                 │
│              │  │ fév → juin 2026  │  │ mars 2026        │                 │
│              │  │ ● En cours       │  │ ● En préparation │                 │
│              │  │ Rég: Marc D.     │  │ Rég: Sophie L.   │                 │
│              │  └──────────────────┘  └──────────────────┘                 │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

`▌` = bande verticale gauche colorée avec `Projet.colorCode` — identité visuelle cohérente avec le planning global.

#### Vue Liste

```
┌──────────────┬──────────────────────────────────────────────────────────────┐
│              │  Projets                         [ + Nouveau projet ]        │
│   SIDEBAR    │  🔍 Rechercher...  [Statut ▾]  [2026 ▾]   [≡ Liste | ⊞ Grille]│
│              ├────┬─────────────────┬──────────┬────────┬──────────┬────────┤
│              │    │ Nom             │ Type     │ Dates  │ Statut   │ Rég.   │
│              ├────┼─────────────────┼──────────┼────────┼──────────┼────────┤
│              │ ▌  │ Peter Pan       │ Com. mus.│fév→jun │ En cours │Marc D. │
│              │ ▌  │ Garou Concert   │ Concert  │mars    │ En prép. │Sophie L│
│              │ ▌  │ Carmen 2026     │ Opéra    │avr→mai │ En prép. │Paul V. │
│              └────┴─────────────────┴──────────┴────────┴──────────┴────────┘
```

`▌` = pastille colorCode. Clic sur une ligne → `/projets/[id]`. Vue Liste préférable sur desktop avec beaucoup de projets.

---

### 6.3 Page d'un projet (`/projets/[id]`)

**Onglets : Résumé | Représentations | Équipe & Postes | Planning | RH / Paie**

#### Onglet — Résumé

```
┌──────────────────────────────────────────────────────────────────┐
│  🎭 Peter Pan — Saison 2026                        [Modifier ✏️] │
│  Comédie musicale · fév → juin 2026 · Théâtre du Châtelet       │
│  Régisseur : Marc D.   Statut : ● En cours                      │
├──────────────────┬───────────────────────────────────────────────┤
│ 40 représent.    │ 28 collaborateurs                             │
│ 12 terminées     │ 8 CDI · 6 CDD · 14 Intermittents             │
│ 28 à venir       │                                               │
├──────────────────┴───────────────────────────────────────────────┤
│ Prochaine représentation : Samedi 01/03 — 20h30                  │
│ Postes non pourvus : 2 🔴                                        │
└──────────────────────────────────────────────────────────────────┘
```

#### Onglet — Représentations

```
┌──────────────────────────────────────────────────────────────────────┐
│  Représentations (40)                   [ + Ajouter ] [ + Série ]   │
│  [Toutes ▾]  [Mars 2026 ▾]                                          │
├────────────┬──────────┬──────────────────────────┬────────┬─────────┤
│ Date       │ Heure    │ Lieu                     │ Type   │ Statut  │
├────────────┼──────────┼──────────────────────────┼────────┼─────────┤
│ Sam 01/03  │ 20h30    │ Théâtre du Châtelet      │ Repré. │ 🔴 2 ✗  │
│ Dim 02/03  │ 15h00    │ Théâtre du Châtelet      │ Repré. │ ✅ OK   │
│ Mar 04/03  │ 20h30    │ Théâtre du Châtelet      │ Repré. │ ✅ OK   │
│ Sam 08/03  │ 20h30    │ Théâtre du Châtelet      │ Repré. │ 🟡 1 ✗  │
└────────────┴──────────┴──────────────────────────┴────────┴─────────┘
   ✅ Tous postes pourvus  🟡 Partiel  🔴 Postes manquants
```

**Clic sur une ligne :** ouvre un menu contextuel (3 options) :
- "Voir la grille" → onglet Planning filtré sur cette date
- "Ouvrir la feuille de route" → `/projets/[id]/planning/[repId]/feuille-de-route`
- "Annuler / Reporter" → modal annulation (§12)

#### Onglet — Équipe & Postes

Vue de constitution de l'équipe du projet. Accessible au Régisseur et au Directeur.

```
┌────────────────────────────────────────────────────────────────────────┐
│  Équipe & Postes — Peter Pan          [ + Nouvelle équipe ]            │
│  [ Importer depuis un projet existant ]                                │
├────────────────────────────────────────────────────────────────────────┤
│  🔧 TECHNIQUE                    Chef : David R. [Changer]  [⋯]        │
│  ─────────────────────────────────────────────────────────────────────│
│  Poste              Nb req.  Critique  Collaborateurs assignés         │
│  ─────────────────────────────────────────────────────────────────────│
│  Régisseur son        1       ☑        David R. (CDI)       [✕]       │
│  Éclairagiste         2       ☑        Alice M. · Bob K.    [✕][✕]    │
│  Machiniste           2       ☑        [+ Assigner]                   │
│  [ + Ajouter un poste ]                                                │
├────────────────────────────────────────────────────────────────────────┤
│  🏛️ SALLE                     Chef : Marie T. [Changer]  [⋯]          │
│  ─────────────────────────────────────────────────────────────────────│
│  Ouvreuse             4       ☐        Lucie · Anna · [+] · [+]       │
│  Agent sécu           2       ☐        Frank · Hugo         [✕][✕]    │
│  [ + Ajouter un poste ]                                                │
└────────────────────────────────────────────────────────────────────────┘
```

**Actions disponibles :**
- `[ + Nouvelle équipe ]` → modal : nom de l'équipe + sélection du chef de poste (liste des membres de l'org)
- `[ + Ajouter un poste ]` → modal inline : intitulé, nb requis, isCritique (checkbox), defaultStartTime / defaultEndTime (pré-remplit les affectations)
- `[+ Assigner]` → dropdown de recherche des collaborateurs de l'org (filtre par spécialité)
- `[✕]` sur un collaborateur → retrait de l'équipe (ne supprime pas les affectations existantes — alerte si affectations futures)
- `[Importer depuis un projet existant]` → liste des projets passés → sélection → prévisualisation → import postes + collaborateurs (cf. §11.1C)
- `[⋯]` sur une équipe → Renommer · Supprimer l'équipe (bloqué si affectations futures)

#### Onglet — Planning (vue grille affectations — groupée par équipe)

```
Vue Régisseur (toutes équipes visibles)   Filtre : [Toutes équipes ▾] [Mars 2026 ▾]

                    │ 01/03 Sam │ 02/03 Dim │ 04/03 Mar │ 08/03 Sam │
════════════════════╪═══════════╪═══════════╪═══════════╪═══════════╡
🔧 TECHNIQUE  — Chef : David R.                                      
────────────────────┼───────────┼───────────┼───────────┼───────────┤
Régisseur son  (1)  │ David 🔵  │ David 🔵  │ David 🔵  │ David 🔵  │
Éclairagiste   (2)  │ Alice 🟠  │ Alice 🟠  │ Alice 🟠  │ Alice 🟠  │
                    │ Bob 🟠    │ Bob 🟠    │ Bob 🟠    │ [+] 🔴    │
Machiniste     (2)  │ [+] 🔴    │ Carol 🟡  │ Carol 🟡  │ Carol 🟡  │
                    │ [+] 🔴    │ Eve 🟠    │ Eve 🟠    │ Eve 🟠    │
════════════════════╪═══════════╪═══════════╪═══════════╪═══════════╡
🏛️  SALLE  — Chef : Marie T.                                         
────────────────────┼───────────┼───────────┼───────────┼───────────┤
Ouvreuse       (4)  │ Lucie 🟠  │ Lucie 🟠  │ Lucie 🟠  │ [+] 🔴    │
                    │ Anna 🟠   │ Anna 🟠   │ [+] 🔴    │ [+] 🔴    │
Agent sécu     (2)  │ Frank 🔵  │ Frank 🔵  │ Frank 🔵  │ Frank 🔵  │
                    │ Hugo 🔵   │ Hugo 🔵   │ Hugo 🔵   │ Hugo 🔵   │
════════════════════╪═══════════╪═══════════╪═══════════╪═══════════╡
🎟️  BILLETTERIE  — Chef : Paul L.                                    
────────────────────┼───────────┼───────────┼───────────┼───────────┤
Caissière      (2)  │ Inès 🟡   │ Inès 🟡   │ Inès 🟡   │ Inès 🟡   │
                    │ [+] 🔴    │ [+] 🔴    │ [+] 🔴    │ [+] 🔴    │
════════════════════╧═══════════╧═══════════╧═══════════╧═══════════╛
🔵 CDI   🟡 CDD   🟠 Intermittent   🔴 Poste non pourvu   [+] Affecter

Vue Chef de poste (Technique uniquement — David R. voit seulement son équipe)
🔧 TECHNIQUE  — Mon équipe
────────────────────┬───────────┬───────────┬───────────┬───────────┤
Régisseur son  (1)  │ David 🔵  │ David 🔵  │ David 🔵  │ David 🔵  │
Éclairagiste   (2)  │ Alice 🟠  │ Alice 🟠  │ Alice 🟠  │ Alice 🟠  │
                    │ Bob 🟠    │ Bob 🟠    │ Bob 🟠    │ [+] 🔴    │
Machiniste     (2)  │ [+] 🔴    │ Carol 🟡  │ Carol 🟡  │ Carol 🟡  │
                    │ [+] 🔴    │ Eve 🟠    │ Eve 🟠    │ Eve 🟠    │
────────────────────┴───────────┴───────────┴───────────┴───────────┘
```

#### Onglet — RH / Paie *(visible RH et Directeur uniquement)*

```
┌─────────────────────────────────────────────────────────────────────┐
│  RH & Paie — Peter Pan                         [ Exporter CSV ]    │
├────────────────┬─────────────┬──────────┬──────────┬───────────────┤
│ Collaborateur  │ Type        │ Repré.   │ DPAE     │ Rémun. prév.  │
├────────────────┼─────────────┼──────────┼──────────┼───────────────┤
│ Alice M.       │ Intermittent│  28/40   │ ✅       │  5 180,00 €   │
│ Bob K.         │ Intermittent│  27/40   │ ✅       │  4 995,00 €   │
│ Carol L.       │ CDD         │  38/40   │ ✅       │  3 200,00 €   │
│ David R.       │ CDI         │  40/40   │ —        │  (mensuel)    │
│ Eve P.         │ Intermittent│  30/40   │ 🟡 Envoyée│  5 550,00 €   │
└────────────────┴─────────────┴──────────┴──────────┴───────────────┘
```

---

### 6.4 Planning global (`/planning`)

Vue consolidée de toutes les représentations de tous les projets actifs de l'organisation. Permet d'identifier les surcharges, les jours sans équipe, et les conflits de ressources humaines entre projets.

#### Droits d'accès

| Rôle | Accès | Capacité |
|------|-------|----------|
| DIRECTEUR | ✅ Tous les projets | Lecture + navigation vers chaque projet |
| RH | ✅ Tous les projets | Lecture seule (pas d'affectation depuis cette vue) |
| REGISSEUR | ✅ Tous les projets | Lecture seule pour les projets dont il n'est pas responsable · Accès complet sur les siens |
| COLLABORATEUR | ❌ | N/A — utilise `/mon-planning` |

> Un REGISSEUR est "responsable" d'un projet s'il a une entrée `ProjetMembre` sur ce projet avec le rôle `REGISSEUR_PRINCIPAL` ou `REGISSEUR_ADJOINT`.

---

#### Vue Mois (défaut)

```
┌──────────────┬──────────────────────────────────────────────────────────────┐
│              │  Planning global        < Mars 2026 >    [Mois] [Semaine]    │
│   SIDEBAR    │  [Tous les projets ▾]  [Tous les lieux ▾]  [Toutes équipes ▾]│
│              ├──────┬──────┬──────┬──────┬──────┬──────┬──────┬────────────┤
│              │  LUN │  MAR │  MER │  JEU │  VEN │  SAM │  DIM │            │
│              ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤            │
│              │  2   │  3   │  4   │  5   │  6   │  7   │  8   │            │
│              │      │      │┌────┐│      │      │┌────┐│┌────┐│            │
│              │      │      ││ PP ││      │      ││ PP │││ PP ││            │
│              │      │      ││20h30      │      ││20h30 ││15h00│            │
│              │      │      ││8/10││      │      ││10/10 ││10/10            │
│              │      │      ││ 🔴 ││      │      ││ 🟢  ││ 🟢  │            │
│              │      │      │└────┘│      │      │└────┘│└────┘│            │
│              ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤            │
│              │  9   │  10  │  11  │  12  │  13  │  14  │  15  │            │
│              │      │      │      │      │      │┌────┐│┌────┐│            │
│              │      │      │      │      │      ││ GAR ││ PP ││            │
│              │      │      │      │      │      ││19h00 ││20h30│            │
│              │      │      │      │      │      ││ 5/5 ││10/10│            │
│              │      │      │      │      │      ││ 🟢  ││ 🟢  │            │
│              │      │      │      │      │      │└────┘│└────┘│            │
├──────────────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴────────────┤
│ Légende :  ■ PP = Peter Pan (violet)   ■ GAR = Garou Concert (orange)      │
│            🟢 100% pourvu  🟡 postes non critiques manquants  🔴 poste critique manquant │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Anatomie d'une card événement :**
```
┌──────────┐
│ PP       │  ← code projet (couleur = Projet.colorCode)
│ 20h30    │  ← heure de début
│ 8/10     │  ← postes pourvus / total requis
│  🔴      │  ← statut (voir règle de calcul ci-dessous)
└──────────┘
```

**Règle de calcul du statut visuel (Règle #31) :**
- 🟢 **Vert** — tous les postes pourvus (ratio = 100%)
- 🟡 **Jaune** — des postes manquants, mais aucun `isCritique = true` n'est non pourvu
- 🔴 **Rouge** — au moins un `PosteRequis.isCritique = true` non pourvu

**Superposition :** si plusieurs projets ont une représentation le même jour, leurs cards s'empilent verticalement dans la case. Maximum 3 cards visibles — si plus, un badge `+N` apparaît avec tooltip listant les projets cachés.

---

#### Vue Semaine (Timeline / Gantt simplifié)

Colonnes = les 7 jours de la semaine. Lignes = un projet par ligne. Utile pour visualiser la densité d'une semaine chargée et les périodes de "rush" multi-projets.

```
┌──────────────┬─────────────────────────────────────────────────────────────┐
│              │  Planning global — Sem. 9  < 24 fév → 2 mars >   [Mois][Semaine]│
│   SIDEBAR    │  [Tous les projets ▾]                                        │
│              ├──────────────┬──────┬──────┬──────┬──────┬──────┬──────┬────┤
│              │              │  LUN │  MAR │  MER │  JEU │  VEN │  SAM │DIM │
│              │              │  24  │  25  │  26  │  27  │  28  │   1  │  2 │
│              ├──────────────┼──────┼──────┼──────┼──────┼──────┼──────┼────┤
│              │ ■ Peter Pan  │      │      │      │      │      │┌──┐  │┌──┐│
│              │   (violet)   │      │      │      │      │      ││🔴│  ││🟢││
│              │              │      │      │      │      │      ││20h│  ││15h│
│              │              │      │      │      │      │      │└──┘  │└──┘│
│              ├──────────────┼──────┼──────┼──────┼──────┼──────┼──────┼────┤
│              │ ■ Garou 26   │      │      │      │      │      │┌──┐  │    │
│              │   (orange)   │      │      │      │      │      ││🟢│  │    │
│              │              │      │      │      │      │      ││19h│  │    │
│              │              │      │      │      │      │      │└──┘  │    │
│              ├──────────────┼──────┼──────┼──────┼──────┼──────┼──────┼────┤
│              │ ■ Carmen 26  │      │┌──┐  │      │┌──┐  │      │      │    │
│              │   (vert)     │      ││🟡│  │      ││🟢│  │      │      │    │
│              │              │      ││20h│  │      ││20h│  │      │      │    │
│              │              │      │└──┘  │      │└──┘  │      │      │    │
│              ├──────────────┴──────┴──────┴──────┴──────┴──────┴──────┴────┤
│              │ ⚠️ SAM 1 mars : Peter Pan + Garou Concert — même soir       │
│              │    Vérifier les intermittents partagés entre les deux équipes│
└──────────────┴─────────────────────────────────────────────────────────────┘
```

**Alerte de conflit de ressources** : si deux représentations le même soir appartiennent à des projets distincts, et qu'un collaborateur est affecté aux deux, une bannière d'alerte s'affiche sous la grille semaine (pas sur la vue mois).

---

#### Panel latéral (Drawer) — au clic sur une card

Clic sur n'importe quelle card → panel latéral qui s'ouvre à droite **sans quitter le calendrier**.

```
┌──────────────────────────────────────────────┐
│  ✕  Peter Pan — Samedi 1 mars · 20h30        │
│  Théâtre du Châtelet, Paris                  │
│  ────────────────────────────────────────    │
│  Statut : 🔴 Poste critique non pourvu       │
│  8 / 10 postes pourvus                       │
│  ████████░░  80%                             │
│  ────────────────────────────────────────    │
│  🔧 TECHNIQUE  (Chef : David R.)             │
│    Régisseur son   → David R.  ✅            │
│    Éclairagiste    → Alice M.  🟠 en attente │
│    Machiniste ⚠️   → [non pourvu]  🔴        │
│                                              │
│  🏛️ SALLE  (Chef : Marie T.)                 │
│    Ouvreuse (4)   → Lucie · Anna · +2  ✅   │
│    Agent sécu     → Frank · Hugo       ✅   │
│                                              │
│  🎟️ BILLETTERIE  (Chef : Paul L.)            │
│    Caissière (2)  → Inès · [non pourvu] 🟡  │
│  ────────────────────────────────────────    │
│  [ 🗂️ Gérer le planning du projet → ]        │
└──────────────────────────────────────────────┘
```

- Le bouton **"Gérer le planning du projet"** redirige vers `/projets/[id]` onglet Planning.
- Si le REGISSEUR n'est **pas** responsable de ce projet → le bouton est masqué (lecture seule).
- Le statut de confirmation de chaque collaborateur est affiché : ✅ confirmé · 🟠 en attente · ❌ refusé.

---

#### Filtres disponibles

| Filtre | Valeurs | Comportement |
|--------|---------|--------------|
| Projets | Tous · liste des projets actifs | Masque les cards des projets désélectionnés |
| Lieux | Tous · liste des lieux distincts | Filtre par `Representation.lieu` |
| Statut | Tous · 🟢 OK · 🟡 Partiel · 🔴 Critique | Filtre par statut calculé |

---

#### Routes API associées

| Route | Rôle | Description |
|-------|------|-------------|
| `GET /api/planning/global?month=2026-03` | DIRECTEUR / RH / REGISSEUR | Toutes les représentations du mois avec ratio postes pourvus |
| `GET /api/planning/global?week=2026-W09` | idem | Vue semaine |

La réponse inclut pour chaque représentation : `projetId`, `projetCode`, `projetColorCode`, `date`, `startTime`, `lieu`, `totalPostes`, `pourvus`, `hasPosteCritiqueManquant`.

---

### 6.5 Planning personnel du collaborateur (`/mon-planning`)

#### Vue Mois (défaut)

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│              │  Mon planning   < Mars 2026 >  [Mois | Liste]            │
│ 🏠 Accueil  │                              [ 📅 Exporter iCal ]        │
│ 📅 Mon plan.├──────────────────────────────────────────────────────────┤
│ 💶 Ma paie  │  LUN    MAR    MER    JEU    VEN    SAM    DIM            │
│ 📄 Mes cont.│                                                            │
│              │  2      3      4      5      6      7      8              │
│              │                🎭          🎭    🎭🟠  🎭                 │
│              │              20h30       20h30  20h30  15h00             │
│              │                                                            │
│              │  Clic sur une date → détail :                             │
│              │  ┌────────────────────────────────────────┐              │
│              │  │ Samedi 7 mars — 20h30                  │              │
│              │  │ Peter Pan                              │              │
│              │  │ Poste : Éclairagiste                   │              │
│              │  │ Lieu : Théâtre du Châtelet, Paris      │              │
│              │  │ Durée estimée : 3h                     │              │
│              │  │ Rémunération : 185,00 €                │              │
│              │  │ Statut : 🟠 En attente de confirmation  │              │
│              │  │                                        │              │
│              │  │  [ ✅ Je confirme ]  [ ❌ Conflit ]    │              │
│              │  └────────────────────────────────────────┘              │
└──────────────┴──────────────────────────────────────────────────────────┘
```

**Badge 🟠 sur le calendrier :** indique les dates `confirmationStatus = EN_ATTENTE`. Disparaît dès que le collaborateur confirme ou refuse. Visible uniquement pour les intermittents (CDI/CDD = NON_REQUISE, pas de badge).

**Actions dans le détail :**
- `[ ✅ Je confirme ]` → `PATCH /api/affectations/[id]/confirmer` → statut passe à CONFIRMEE
- `[ ❌ Conflit ]` → `PATCH /api/affectations/[id]/refuser` → statut passe à REFUSEE + champ commentaire optionnel

#### Vue Liste

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│              │  Mon planning   < Mars 2026 >  [Mois | Liste]            │
│ 🏠 Accueil  │                              [ 📅 Exporter iCal ]        │
│ 📅 Mon plan.├──────────┬─────────────┬──────────────┬──────────────────┤
│ 💶 Ma paie  │ Date     │ Projet      │ Poste        │ Statut           │
│ 📄 Mes cont.├──────────┼─────────────┼──────────────┼──────────────────┤
│              │ 04/03 Mer│ Peter Pan   │ Éclairagiste │ ✅ Confirmée     │
│              │ 07/03 Sam│ Peter Pan   │ Éclairagiste │ 🟠 → [Confirmer] │
│              │ 08/03 Dim│ Peter Pan   │ Éclairagiste │ ✅ Confirmée     │
│              │ 14/03 Sam│ Garou Tour  │ Éclairagiste │ 🟠 → [Confirmer] │
└──────────────┴──────────┴─────────────┴──────────────┴──────────────────┘
```

La vue Liste est plus pratique pour confirmer plusieurs dates rapidement. `[Confirmer]` inline déclenche la confirmation directement sans ouvrir le détail.

**Export iCal :** génère un fichier `.ics` contenant toutes les représentations à venir du collaborateur (statut CONFIRMEE uniquement — pas les EN_ATTENTE). Importable dans Google Calendar, Apple Calendar ou Outlook. Régénérable à tout moment.

---

### 6.6 Rémunération du collaborateur (`/ma-remuneration`)

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│              │  Ma rémunération   [Mars 2026 ▾]  [Tous les projets ▾]  │
│ 📅 Mon plan.├──────────────────────────────────────────────────────────┤
│ 💶 Ma paie  │  TOTAL PRÉVU CE MOIS : 1 480,00 €  (8 représentations)   │
│ 📄 Mes cont.├───────────┬──────────────┬──────────────┬────────────────┤
│              │ Date      │ Projet   │ Poste        │ Montant prévu  │
│              ├───────────┼──────────────┼──────────────┼────────────────┤
│              │ 04/03     │ Peter Pan    │ Éclairagiste │    185,00 €    │
│              │ 07/03     │ Peter Pan    │ Éclairagiste │    185,00 €    │
│              │ 08/03     │ Peter Pan    │ Éclairagiste │    185,00 €    │
│              │ ...       │ ...          │ ...          │    ...         │
│              ├───────────┴──────────────┴──────────────┴────────────────┤
│              │ ⚠️ Montants prévisionnels — bulletin officiel émis par    │
│              │ votre gestionnaire de paie.                              │
└──────────────┴──────────────────────────────────────────────────────────┘
```

### 6.7 Rémunération globale RH (`/rh/remuneration`)

Vue accessible uniquement au RH et au Directeur. Récapitulatif des rémunérations prévisionnelles pour tous les collaborateurs, toutes productions confondues.

```
┌──────────────┬──────────────────────────────────────────────────────────────┐
│              │  Rémunérations                     [ Exporter CSV ]          │
│   SIDEBAR    │  [Mois ▾] < Mars 2026 >  [Tous les projets ▾]  [Tous ▾]     │
│              ├──────────────────────────────────────────────────────────────┤
│              │  TOTAL PRÉVISIONNEL — MARS 2026                              │
│              │  47 830,00 €  (28 collaborateurs · 12 projets actifs)        │
│              ├───────────────┬──────────────┬────────┬──────────┬───────────┤
│              │ Collaborateur │ Type contrat │ Repré. │ Cachet   │ Total mois│
│              ├───────────────┼──────────────┼────────┼──────────┼───────────┤
│              │ Alice M.      │ Intermittent │  8/40  │  185€    │ 1 480€    │
│              │ Bob K.        │ Intermittent │  6/40  │  185€    │ 1 110€    │
│              │ Carol L.      │ CDD          │  —     │  mensuel │ 2 200€    │
│              │ David R.      │ CDI          │  —     │  mensuel │ 3 100€    │
│              │ Eve P.        │ Intermittent │  10/30 │  185€    │ 1 850€    │
│              │ ...           │ ...          │  ...   │  ...     │  ...      │
│              ├───────────────┴──────────────┴────────┴──────────┴───────────┤
│              │ ⚠️ Montants prévisionnels — les CDD/CDI affichent leur        │
│              │ salaire mensuel brut renseigné dans leur fiche.              │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

**Filtrages disponibles :**
- Par période (mois, trimestre)
- Par projet
- Par type de contrat (CDI / CDD / Intermittent)
- Par statut DPAE

**Export CSV :** colonnes Nom | Prénom | N°SS (masqué) | Type contrat | Représentations | Total HT | Statut DPAE — compatible SAGE / Cegid.

---

### 6.8 Suivi des DPAE (`/rh/dpae`)

Vue accessible au **RH** et au **Directeur** uniquement. Liste toutes les affectations nécessitant une DPAE (intermittents + CDD) avec leur statut, les alertes J-1, et les actions disponibles.

#### Vue principale

```
┌──────────────┬──────────────────────────────────────────────────────────────────┐
│              │  Suivi DPAE                                  [ Exporter CSV ]    │
│   SIDEBAR    │  [Mars 2026 ▾]  [Tous les projets ▾]  [Tous les statuts ▾]      │
│              ├──────────────────────────────────────────────────────────────────┤
│              │  🔴 ALERTES J-1  (2 affectations demain sans DPAE confirmée)     │
│              │  ┌─────────────────────────────────────────────────────────────┐ │
│              │  │ ⚠️  Alice M. — Peter Pan — 04/03 — Éclairagiste    [→ Traiter]│ │
│              │  │ ⚠️  Bob K.   — Peter Pan — 04/03 — Machiniste      [→ Traiter]│ │
│              │  └─────────────────────────────────────────────────────────────┘ │
│              ├──────────────────────────────────────────────────────────────────┤
│              │  TOUTES LES DPAE — MARS 2026  (18 au total)                      │
│              ├──────────┬─────────────┬──────────────┬───────┬──────────────────┤
│              │ Collab.  │ Projet      │ Date repr.   │ Type  │ Statut           │
│              ├──────────┼─────────────┼──────────────┼───────┼──────────────────┤
│              │ Alice M. │ Peter Pan   │ 04/03 20h30  │ Inter.│ ⬜ À faire  [✓]  │
│              │ Bob K.   │ Peter Pan   │ 04/03 20h30  │ Inter.│ ⬜ À faire  [✓]  │
│              │ Carol L. │ Peter Pan   │ 04/03 20h30  │ CDD   │ 🟡 Envoyée  [✓]  │
│              │ Eve P.   │ Peter Pan   │ 07/03 20h30  │ Inter.│ ✅ Confirmée     │
│              │ Inès R.  │ Garou Tour  │ 14/03 19h00  │ Inter.│ ✅ Confirmée     │
│              │ Frank D. │ Garou Tour  │ 14/03 19h00  │ Inter.│ ⬜ À faire  [✓]  │
│              │ ...      │ ...         │ ...          │ ...   │ ...              │
│              ├──────────┴─────────────┴──────────────┴───────┴──────────────────┤
│              │  ⬜ À faire : 8   🟡 Envoyée : 4   ✅ Confirmée : 6              │
└──────────────┴──────────────────────────────────────────────────────────────────┘
```

**Bouton [✓] — transition de statut :**
- Ligne `À faire` → clic [✓] → passe à `Envoyée` (avec date d'envoi horodatée) — **sans confirmation** (action réversible)
- Ligne `Envoyée` → clic [✓] → **tooltip de confirmation** : "Marquer cette DPAE comme confirmée par l'URSSAF ? Cette action ne peut pas être annulée." · [Oui, confirmer] / [Annuler] → si oui, passe à `Confirmée` (avec date de confirmation horodatée)
- Ligne `Confirmée` → pas de bouton (état terminal)

> ⚠️ Le passage à `CONFIRMEE` est irréversible dans l'app — une dépublication DPAE se fait hors-app via l'URSSAF. D'où la confirmation obligatoire.

#### Bandeau alerte J-1

Affiché uniquement s'il existe des affectations demain (J+1) avec `dpaeStatus = A_FAIRE` ou `ENVOYEE`. Fond rouge pâle, icône ⚠️. Le clic sur `[→ Traiter]` scroll jusqu'à la ligne concernée dans le tableau.

#### Filtres disponibles

| Filtre | Valeurs |
|--------|---------|
| Période | Mois courant · mois précédent · sélecteur libre |
| Projet | Tous · liste des projets actifs |
| Statut | Tous · À faire · Envoyée · Confirmée |

#### Routes API associées

| Route | Description |
|-------|-------------|
| `GET /api/dpae?month=2026-03&projetId=&status=` | Liste paginée des affectations DPAE avec filtres |
| `PATCH /api/affectations/[id]/dpae` | Mettre à jour `dpaeStatus` (body : `{ status: "ENVOYEE" \| "CONFIRMEE" }`) |
| `GET /api/dpae/export.csv?month=2026-03` | Export CSV — colonnes : Nom · Prénom · N°SS · Type contrat · Date · Projet · Poste · Cachet HT · Statut DPAE |

---

### 6.9 Export paie (`/rh/export`)

Vue accessible au **RH** et au **Directeur** uniquement. Permet de générer un export CSV de la rémunération prévisionnelle, compatible SAGE / Cegid / tout logiciel de paie.

```
┌──────────────┬──────────────────────────────────────────────────────────────────┐
│              │  Export paie                                                     │
│   SIDEBAR    ├──────────────────────────────────────────────────────────────────┤
│              │  1. PARAMÈTRES DE L'EXPORT                                       │
│              │  ┌───────────────────────────────────────────────────────────┐   │
│              │  │  Période        [Mars 2026          ▾]                    │   │
│              │  │  Projets        [Tous les projets   ▾]  (multi-sélection) │   │
│              │  │  Type contrat   ☑ Intermittent  ☑ CDD  ☐ CDI             │   │
│              │  │  Statut DPAE    ☑ À faire  ☑ Envoyée  ☑ Confirmée        │   │
│              │  └───────────────────────────────────────────────────────────┘   │
│              ├──────────────────────────────────────────────────────────────────┤
│              │  2. APERÇU  (5 premières lignes)                                 │
│              ├──────┬────────┬───────┬───────────┬──────┬──────┬────────┬──────┤
│              │ Nom  │ Prénom │ N°SS  │ Contrat   │ Date │Projet│ Poste  │ HT   │
│              ├──────┼────────┼───────┼───────────┼──────┼──────┼────────┼──────┤
│              │Martin│ Alice  │ ****  │ Intermitt.│04/03 │ PP   │Éclair. │185€  │
│              │Klein │ Bob    │ ****  │ Intermitt.│04/03 │ PP   │Machin. │185€  │
│              │Leroy │ Carol  │ ****  │ CDD       │04/03 │ PP   │Ouvr.   │ —    │
│              │ ...  │ ...    │ ...   │ ...       │ ...  │ ...  │ ...    │ ...  │
│              ├──────┴────────┴───────┴───────────┴──────┴──────┴────────┴──────┤
│              │  28 lignes au total · N°SS masqués à l'aperçu (visibles export) │
│              ├──────────────────────────────────────────────────────────────────┤
│              │                          [ ⬇ Télécharger le CSV ]               │
└──────────────┴──────────────────────────────────────────────────────────────────┘
```

**Colonnes du CSV exporté :**

| Colonne | Source |
|---------|--------|
| Nom | `User.lastName` |
| Prénom | `User.firstName` |
| N°SS | `Collaborateur.numeroSS` (non masqué dans le fichier) |
| Type contrat | `Affectation.contractTypeUsed` |
| Date représentation | `Representation.date` |
| Projet | `Projet.nom` |
| Poste | `PosteRequis.intitule` |
| Cachet HT | `Affectation.cachetHT` (null pour CDI/CDD mensuel → cellule vide) |
| Statut DPAE | `Affectation.dpaeStatus` |

**Règles :**
- Les CDI n'ont pas de cachet HT unitaire — leur ligne affiche une cellule vide (salaire mensuel géré hors app)
- Le N°SS est masqué dans l'aperçu (`****`) mais présent en clair dans le CSV téléchargé
- L'export reflète l'état en temps réel au moment du clic — pas de snapshot
- Après clic sur `[ ⬇ Télécharger le CSV ]` : toast de confirmation → "Export_Mars2026.csv téléchargé (28 lignes)" · durée 4s · icône ✅

**Route API :**

| Route | Description |
|-------|-------------|
| `GET /api/rh/export.csv?month=2026-03&projetIds=&contractTypes=&dpaeStatuses=` | Génère et retourne le fichier CSV (Content-Disposition: attachment) |

---

### 6.10 Mes contrats (`/mes-contrats`)

Page accessible aux **Collaborateurs uniquement**. Liste des documents contractuels uploadés par l'organisation (contrats, avenants, fiches de poste).

```
┌──────────────┬──────────────────────────────────────────────────────────────┐
│              │  Mes contrats & documents                                   │
│ 📅 Mon plan.├──────────────────────────────────────────────────────────────┤
│ 💶 Ma paie  │  THÉÂTRE DU NORD                                             │
│ 📄 Mes cont.│  ──────────────────────────────────────────────────────────  │
│              │  📄 Contrat CDD — Peter Pan 2026            15/01/2026  👁️  │
│              │     Poste : Éclairagiste · Type : CDD · Durée : 3 mois      │
│              │                                                              │
│              │  📄 Avenant — Prolongation avril 2026       02/03/2026  👁️  │
│              │     Avenant au contrat CDD initial                          │
│              │                                                              │
│              │  COMPAGNIE DES LUMIÈRES                                     │
│              │  ──────────────────────────────────────────────────────────  │
│              │  📄 Contrat Intermittent — Garou Tour 2025  10/10/2025  👁️  │
│              │                                                              │
│              │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│              │  Documents classés par organisation. Consultation et         │
│              │  téléchargement uniquement.                                  │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

**Bouton 👁️ :** ouvre le PDF via une signed URL S3 (expiration 1h) dans un nouvel onglet — cf. règle #10.

**Règles :**
- Lecture seule pour le collaborateur — pas d'upload depuis cette page
- Les documents sont uploadés par le RH ou le Directeur depuis la fiche `/equipe/[id]` (cf. `07`)
- Les documents sont filtrés : le collaborateur ne voit que ses propres documents
- Groupement par organisation (cas multi-org)

---

## Navigation & Routes — Table complète

Table de référence de **toutes** les routes de l'application. Chaque module détaille ses routes dans son propre fichier.

### Espace organisation (staff)

| Route | Page | Rôle minimum |
|-------|------|:---:|
| `/dashboard` | Tableau de bord | Tous |
| `/projets` | Liste des projets | Régisseur |
| `/projets/new` | Créer un projet | Régisseur |
| `/projets/[id]` | Résumé projet | Régisseur |
| `/projets/[id]/representations` | Liste des représentations | Régisseur |
| `/projets/[id]/equipe` | Équipe & postes | Régisseur |
| `/projets/[id]/planning` | Grille affectations | Régisseur |
| `/projets/[id]/rh` | RH & Paie du projet | RH |
| `/projets/[id]/remplacements` | Remplacements urgents actifs | Régisseur |
| `/projets/[id]/annulations` | Tableau RH — cachets à décider | RH |
| `/projets/[id]/planning/[repId]/feuille-de-route` | Feuille de route (édition) | Régisseur |
| `/projets/templates` | Bibliothèque de templates | Régisseur |
| `/projets/[id]/creer-template` | Sauvegarder comme template | Régisseur |
| `/planning` | Planning global (toutes les dates) | Régisseur |
| `/equipe` | Annuaire de l'organisation | Directeur / RH |
| `/equipe/[id]` | Fiche collaborateur détaillée | Directeur / RH |
| `/equipe/[id]/historique` | Historique projets du collaborateur | RH |
| `/rh/dpae` | Suivi des DPAE (wireframe §6.8) | RH |
| `/rh/remuneration` | Rémunérations globales (wireframe §6.7) | RH |
| `/rh/export` | Export CSV paie (wireframe §6.9) | RH |
| `/mon-equipe` | Dashboard chef de poste | Chef de poste |
| `/mon-equipe/[projetId]` | Dashboard équipe sur un projet | Chef de poste |
| `/mon-equipe/[projetId]/grille` | Vue grille de l'équipe | Chef de poste |
| `/notifications` | Centre de notifications (liste + marquer lu) | Tous |
| `/settings` | Paramètres personnels | Tous |
| `/settings/organisation` | Paramètres de l'organisation (+ section #facturation) | Directeur |

### Espace collaborateur

| Route | Page |
|-------|------|
| `/dashboard` | Accueil personnalisé |
| `/mon-planning` | Mon planning (calendrier) |
| `/mon-planning/[representationId]/feuille-de-route` | Feuille de route (lecture mobile) |
| `/ma-remuneration` | Rémunération prévisionnelle |
| `/mes-contrats` | Mes contrats & documents (wireframe §6.10) |
| `/settings` | Mon profil & spécialités |
| `/settings/profil` | Spécialités & préférences collaborateur |
| `/settings/securite` | Mot de passe & 2FA |
| `/settings/preferences` | Langue, fuseau horaire, notifs email |
| `/mon-planning/subscribe.ics` | Abonnement iCal dynamique (mis à jour automatiquement) — token dans URL, sans session — Décision #9 |
| `/settings/ical` | Token iCal — régénération lien abonnement |

### Accès public (sans session)

| Route | Page | Notes |
|-------|------|-------|
| `/signup` | Inscription nouvelle organisation | — |
| `/login` | Connexion magic link | — |
| `/login/verify` | Page d'attente post-envoi lien | — |
| `/onboarding` | Wizard de configuration | Redirige si déjà complété |
| `/affectation/[token]/confirmer` | Confirmation d'affectation | Token magic link CONFIRMATION |
| `/remplacement/[token]/repondre` | Réponse remplacement urgent | Token magic link |
| `/mon-planning/view/[token]` | Consultation planning sans session | Token magic link PLANNING_VIEW |
| `/documents/view/[token]` | Visualisation document sans session | Token magic link DOCUMENT_ACCESS |

### API & exports

| Route | Usage | Auth |
|-------|-------|------|
| `/api/planning/[projetId]/stream` | SSE — mises à jour temps réel de la grille | Session |
| `/api/feuille-de-route/[id]/pdf` | Export PDF feuille de route | Session |
| `POST /api/feuille-de-route/[id]/copier-depuis` | Copier la structure d'une FDR existante (§11.9.3) | Session (Régisseur) |
| `/api/notifications` | Liste paginée + marquer lu | Session |
| `/api/notifications/read-all` | Marquer toutes comme lues | Session |
| `/mon-planning/export.ics` | Export iCal planning collaborateur | Session |
| `PATCH /api/affectations/[id]/annuler` | Annuler une affectation (simple ou tardive) | Régisseur |
| `PATCH /api/affectations/[id]/relancer` | Renvoyer le lien de confirmation (remet `relanceSentAt` à null) — Règle #31 | Régisseur |
| `PATCH /api/representations/[id]/annuler` | Annuler une représentation | Régisseur |
| `PATCH /api/representations/[id]/reporter` | Reporter une représentation | Régisseur |
| `PATCH /api/projets/[id]/annuler` | Annuler un projet | Directeur |
| `PATCH /api/affectations/[id]/cachet` | Trancher le cachet (DU / ANNULE) | RH |
| `POST /api/affectations/batch` | Affecter en série (bulk) | Régisseur |
| `GET /api/notifications/unread-count` | Nombre de notifications non lues (polling badge 30s) — cf. `13` §13.8 | Session |
| `POST /api/billing/checkout` | Créer une session Stripe Checkout (upgrade PRO/ENTERPRISE) — cf. `18` §18.0 | Session (Directeur) |
| `GET /api/billing/portal` | Accès portail Stripe (facturation, IBAN) — cf. `18` §18.0 | Session (Directeur) |

### Back-office plateforme

| Route | Page | Rôle |
|-------|------|------|
| `/admin` | Vue d'ensemble des organisations | SUPER_ADMIN |
| `/admin/organisations` | Liste & gestion des orgs | SUPER_ADMIN |
| `/admin/organisations/[id]` | Fiche org + changer plan | SUPER_ADMIN |
| `/admin/admins` | Gestion des SUPER_ADMINs | SUPER_ADMIN |
| `/admin/logs` | Logs d'activité système | SUPER_ADMIN |

---

## UX — Expériences clés détaillées

### 11.1 Rapidité du régisseur — Affectation en masse

Le régisseur est un power user. Il doit affecter jusqu'à 30 personnes sur 40 dates. La grille seule ne suffit pas — ces raccourcis sont **non-négociables** pour l'adoption.

#### Actions en masse disponibles

**A. Copier une affectation sur toutes les dates**
```
[Régisseur — clic droit sur une cellule remplie dans la grille]
    → Menu contextuel :
        "Copier Alice sur toutes les dates de ce projet"
        "Copier Alice sur les dates à venir uniquement"
        "Copier Alice sur une plage de dates..."   ← ouvre un mini-calendrier
    → Confirmation : "Cela va créer 28 affectations. Confirmer ?"
    → Création en masse → affichage immédiat dans la grille
    → Conflits détectés : "3 dates ignorées car Alice est déjà occupée"
```

**B. Affecter sur une plage (modal)**
```
[Régisseur — clic sur "+ Affecter en série" en haut de la grille]
    → Modal :
        Collaborateur : [Alice M.           ▾]
        Poste :         [Éclairagiste        ▾]
        Du :            [01/03/2026]
        Au :            [30/04/2026]
        Jours :         ☑ Lun ☑ Mar ☑ Mer ☑ Jeu ☑ Ven ☑ Sam ☑ Dim
        Exclure :       [Ajouter des exceptions manuelles]
    → Prévisualisation : "Cela couvrira 22 représentations sur cette période."
    → [Affecter]
```

**C. Importer la configuration d'un projet précédente**
```
[Régisseur — onglet Équipe d'un nouveau projet]
    → Bouton : "Importer l'équipe d'un projet existant"
    → Liste des projets passés de l'organisation
    → Sélection : "Hamlet 2025"
    → Prévisualisation des postes et collaborateurs à importer
    → Possibilité de décocher des personnes avant d'importer
    → Import → tous les postes et collaborateurs copiés comme point de départ
    → Les affectations individuelles restent à faire (les dates sont différentes)
```

**D. Vue "Trous uniquement"**
```
[Filtre en haut de la grille]
    → Bouton : "Afficher uniquement les postes non pourvus 🔴"
    → La grille masque toutes les cellules vertes (pourvues)
    → Ne reste visible que ce qui est rouge ou jaune
    → Idéal à J-7 avant la première pour finir de compléter
```

**E. Raccourcis clavier (power users)**
```
↑ ↓ ← → : naviguer dans la grille
Espace   : ouvrir le dropdown d'affectation sur la cellule active
Entrée   : confirmer la sélection
Échap    : fermer / annuler
C        : copier l'affectation de la cellule active
V        : coller sur la cellule active
```

---

### 11.2 Expérience collaborateur — Premier contact

La règle absolue : **zéro friction entre l'email et la réponse.**

#### Email reçu par l'intermittent

```
De : Théâtre du Nord <noreply@plateforme.fr>
Objet : 🎭 Peter Pan — Vos dates vous attendent

─────────────────────────────────────────────────────
Bonjour Alice,

Le Théâtre du Nord vous propose des dates sur :
Peter Pan · Éclairagiste

Vos représentations :

  Sam 14/03 · 20h30 · Théâtre du Châtelet, Paris  · 185,00 €
  Dim 15/03 · 15h00 · Théâtre du Châtelet, Paris  · 185,00 €
  Mar 17/03 · 20h30 · Théâtre du Châtelet, Paris  · 185,00 €
  Sam 21/03 · 20h30 · Théâtre du Châtelet, Paris  · 185,00 €
  Dim 22/03 · 15h00 · Théâtre du Châtelet, Paris  · 185,00 €

          [ ✅  Répondre à mes dates ]

Ce lien est valable 7 jours. Contact : marc.dupont@theatredunord.fr
─────────────────────────────────────────────────────
```

#### Page de réponse (sans login — mobile first)

```
┌──────────────────────────────────────────┐
│  🎭 Peter Pan — Théâtre du Nord          │
│  Éclairagiste · 5 représentations        │
├──────────────────────────────────────────┤
│  Indiquez vos disponibilités :           │
│                                          │
│  Sam 14/03 · 20h30 · Châtelet  185€     │
│  [ ✅ Dispo ]        [ ❌ Indispo ]      │
│                                          │
│  Dim 15/03 · 15h00 · Châtelet  185€     │
│  [ ✅ Dispo ]        [ ❌ Indispo ]      │
│                                          │
│  Mar 17/03 · 20h30 · Châtelet  185€     │
│  [ ✅ Dispo ]        [ ❌ Indispo ]      │
│                                          │
│  Sam 21/03 · 20h30 · Châtelet  185€     │
│  [ ✅ Dispo ]        [ ❌ Indispo ]      │
│                                          │
│  Dim 22/03 · 15h00 · Châtelet  185€     │
│  [ ✅ Dispo ]        [ ❌ Indispo ]      │
└──────────────────────────────────────────┘
```

Chaque clic déclenche **immédiatement** la mise à jour — pas de bouton "Envoyer" global. Une petite coche animée confirme la prise en compte. Le régisseur voit sa grille se mettre à jour en temps réel.

#### Token expiré (7 jours dépassés)

```
┌──────────────────────────────────────────┐
│  🎭 Peter Pan — Théâtre du Nord          │
├──────────────────────────────────────────┤
│                                          │
│  ⏱️  Ce lien a expiré                    │
│                                          │
│  Le délai de réponse de 7 jours est      │
│  dépassé. Contactez directement :        │
│                                          │
│  Marc Dupont                             │
│  marc.dupont@theatredunord.fr            │
│                                          │
└──────────────────────────────────────────┘
```

Le nom et l'email du régisseur sont inclus dans le payload du token à sa création. Même si le token est expiré, les données de contact restent affichables en décodant le token sans le valider (JWT claims lisibles sans vérification de signature).

#### Récapitulatif affiché après les réponses

```
┌──────────────────────────────────────────┐
│  ✅ Vos réponses ont été enregistrées    │
│                                          │
│  Disponible :    4 dates  ✅             │
│  Indisponible :  1 date   ❌             │
│                                          │
│  Marc Dupont (Théâtre du Nord) a été     │
│  prévenu automatiquement.               │
│                                          │
│  ──────────────────────────────────────  │
│  Voulez-vous centraliser toutes vos      │
│  dates et documents sur la plateforme ? │
│                                          │
│  [ Créer mon espace personnel ]          │
│  → Historique · Paie prévisionnelle      │
│  → Documents de tous vos employeurs     │
│                                          │
│  (Pas maintenant)                        │
└──────────────────────────────────────────┘
```

#### Première connexion si le compte est activé

```
┌──────────────────────────────────────────┐
│  Bienvenue Alice ! 👋                    │
│                                          │
│  VOS PROCHAINES DATES                    │
│  ────────────────────                    │
│  Sam 14/03  Peter Pan  Châtelet  20h30  │
│  Dim 15/03  Peter Pan  Châtelet  15h00  │
│  Mar 17/03  Peter Pan  Châtelet  20h30  │
│  Sam 21/03  Peter Pan  Châtelet  20h30  │
│                                          │
│  RÉMUNÉRATION PRÉVISIONNELLE — MARS     │
│  740,00 €  (4 représentations)          │
│                                          │
│  [ 📅 Exporter mon planning iCal ]      │
└──────────────────────────────────────────┘
```

Pas d'état vide. Pas de tour guidé. Pas de "Créez votre premier projet". La valeur est visible dès la première seconde.

---

### 11.3 Navigation multi-organisation

Un utilisateur peut être membre de plusieurs organisations (règle #30). La sidebar affiche un **switcher d'organisation** en haut, visible dès que l'utilisateur est rattaché à plus d'une org.

```
┌──────────────────────────────────┐
│  ┌────────────────────────────┐  │
│  │  🎭 Théâtre du Nord     ▾  │  ← dropdown organisation active
│  └────────────────────────────┘  │
│    ─────────────────────────────  │
│    🎭 Théâtre du Nord  ← actif   │
│    🎤 Compagnie des Lumières      │
│    ─────────────────────────────  │
│    + Rejoindre une organisation   │
│  ────────────────────────────────  │
│  🏠 Dashboard                     │
│  🎭 Projets                       │
│  ...                              │
└──────────────────────────────────┘
```

**Comportement :**
- Cliquer sur une organisation change le contexte actif — toutes les données (projets, planning, rémunération) se rechargent pour cette organisation
- Le contexte actif est mémorisé dans un cookie de session (`activeOrgId`)
- Les notifications dans la cloche sont filtrées par organisation active
- Si l'utilisateur n'est membre que d'une seule organisation, le switcher est masqué (affiché seulement comme nom fixe)

---
### 11.4 États vides (Empty States)

Un état vide bien conçu = pas de confusion, pas de ticket support. Chaque page clé doit afficher un message clair avec une **action principale** lorsqu'il n'y a pas encore de données.

**Règle générale :** toujours une icône + un titre court + une phrase explicative + un CTA (si l'utilisateur a les droits pour créer).

---

#### `/projets` — Aucun projet

```
┌──────────────┬────────────────────────────────────────────────────────────┐
│              │  Projets                              [ + Nouveau projet ] │
│   SIDEBAR    ├────────────────────────────────────────────────────────────┤
│              │                                                            │
│              │              🎭                                            │
│              │                                                            │
│              │        Aucun projet pour le moment                        │
│              │   Créez votre premier projet pour commencer à planifier   │
│              │   vos représentations et constituer vos équipes.          │
│              │                                                            │
│              │           [ + Créer mon premier projet ]                  │
│              │                                                            │
│              │        ── ou ──                                            │
│              │                                                            │
│              │      [ 📋 Parcourir les templates ]                       │
│              │                                                            │
└──────────────┴────────────────────────────────────────────────────────────┘
```

- Le bouton "Créer mon premier projet" visible uniquement si `role >= REGISSEUR`
- "Parcourir les templates" toujours visible — redirige vers `/projets/templates`

---

#### `/equipe` — Aucun collaborateur

```
┌──────────────┬────────────────────────────────────────────────────────────┐
│              │  Équipe                               [ + Ajouter ]       │
│   SIDEBAR    ├────────────────────────────────────────────────────────────┤
│              │                                                            │
│              │              👥                                            │
│              │                                                            │
│              │       Votre annuaire est vide                             │
│              │   Ajoutez vos premiers collaborateurs pour pouvoir les    │
│              │   affecter à vos projets.                                 │
│              │                                                            │
│              │           [ + Ajouter un collaborateur ]                  │
│              │                                                            │
└──────────────┴────────────────────────────────────────────────────────────┘
```

- CTA visible uniquement si `role = RH | DIRECTEUR`

---

#### `/planning` — Aucune représentation ce mois

```
┌──────────────┬────────────────────────────────────────────────────────────┐
│              │  Planning global    < Mars 2026 >   [Mois] [Semaine]      │
│   SIDEBAR    ├────────────────────────────────────────────────────────────┤
│              │                                                            │
│              │              📅                                            │
│              │                                                            │
│              │     Aucune représentation en mars 2026                    │
│              │   Les représentations planifiées sur vos projets actifs   │
│              │   apparaîtront ici.                                       │
│              │                                                            │
│              │   < Mois précédent         Mois suivant >                 │
│              │                                                            │
└──────────────┴────────────────────────────────────────────────────────────┘
```

- Pas de CTA ici — le planning global est en lecture. On navigue vers un projet pour ajouter des représentations.
- Flèches de navigation toujours visibles pour changer de mois.

---

#### `/rh/dpae` — Aucune DPAE ce mois

```
┌──────────────┬────────────────────────────────────────────────────────────┐
│              │  Suivi DPAE              [ Exporter CSV ]                  │
│   SIDEBAR    │  [Mars 2026 ▾]  [Tous les projets ▾]  [Tous statuts ▾]   │
│              ├────────────────────────────────────────────────────────────┤
│              │                                                            │
│              │              ✅                                            │
│              │                                                            │
│              │    Aucune DPAE à traiter pour cette période               │
│              │   Toutes les affectations de ce mois sont soit en CDI,   │
│              │   soit déjà confirmées.                                   │
│              │                                                            │
└──────────────┴────────────────────────────────────────────────────────────┘
```

- Icône ✅ (et non une icône vide) — l'absence de DPAE à traiter est une **bonne nouvelle**, pas un problème.
- Si le filtre statut est actif et qu'aucun résultat ne correspond : message différent → "Aucune DPAE avec ce statut pour la période sélectionnée."

---

#### `/notifications` — Aucune notification

```
┌──────────────────────────────────────────────┐
│  Notifications                               │
├──────────────────────────────────────────────┤
│                                              │
│              🔔                              │
│                                              │
│       Tout est à jour !                      │
│   Aucune notification pour le moment.        │
│                                              │
└──────────────────────────────────────────────┘
```

- Affiché dans le dropdown de la cloche ET sur la page `/notifications`
- Pas de CTA — état passif

---

#### `/mon-planning` — Aucune date affectée (collaborateur)

```
┌──────────────┬────────────────────────────────────────────────────────────┐
│              │  Mon planning    < Mars 2026 >    [Mois | Liste]           │
│ 🏠 Accueil  ├────────────────────────────────────────────────────────────┤
│ 📅 Mon plan.│                                                            │
│ 💶 Ma paie  │              📅                                            │
│ 📄 Mes cont.│                                                            │
│              │     Aucune date prévue en mars 2026                       │
│              │   Votre régisseur n'a pas encore planifié de dates        │
│              │   pour ce mois. Revenez bientôt !                         │
│              │                                                            │
│              │   < Mois précédent         Mois suivant >                 │
│              │                                                            │
└──────────────┴────────────────────────────────────────────────────────────┘
```

- Pas de CTA — le collaborateur ne crée pas ses affectations lui-même
- Ton rassurant : "Revenez bientôt" plutôt qu'un message anxiogène

---

#### `/mes-contrats` — Aucun document uploadé (collaborateur)

```
┌──────────────┬────────────────────────────────────────────────────────────┐
│              │  Mes contrats & documents                                  │
│ 📅 Mon plan.├────────────────────────────────────────────────────────────┤
│ 💶 Ma paie  │                                                            │
│ 📄 Mes cont.│              📄                                            │
│              │                                                            │
│              │     Aucun document pour le moment                         │
│              │   Vos contrats et documents seront disponibles ici        │
│              │   dès que votre organisation les aura partagés.           │
│              │                                                            │
└──────────────┴────────────────────────────────────────────────────────────┘
```

- Pas de CTA — le collaborateur ne peut pas uploader depuis cette page

---

#### Onglet Représentations d'un projet — Aucune représentation

```
┌──────────────────────────────────────────────────────────────────────┐
│  Représentations (0)                   [ + Ajouter ] [ + Série ]    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                          🎭                                          │
│                                                                      │
│              Aucune représentation planifiée                         │
│          Ajoutez des dates pour commencer à constituer               │
│          vos équipes et gérer vos affectations.                      │
│                                                                      │
│                  [ + Ajouter une représentation ]                    │
│                  [ + Créer une série de dates ]                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

- Deux CTA car les deux actions sont équivalentes en importance (date unique vs série)
- Visible uniquement si `role >= REGISSEUR` — les autres voient le message sans CTA

---

#### `/rh/export` — Filtres sans résultats

```
│              │                                                            │
│              │              📊                                            │
│              │                                                            │
│              │    Aucune donnée pour ces critères                        │
│              │   Modifiez vos filtres pour élargir la sélection.        │
│              │                                                            │
│              │              [ Réinitialiser les filtres ]               │
│              │                                                            │
```

---

#### Règles transverses

| Règle | Détail |
|-------|--------|
| Toujours une icône | Emoji ou icône SVG — jamais de rectangle vide brut |
| Titre court | Max 5 mots, positif quand possible |
| Explication courte | 1–2 phrases max, en langage naturel |
| CTA conditionnel | Uniquement si l'utilisateur **peut** agir (vérifier le rôle) |
| Filtres actifs | Si l'état vide est dû à un filtre → message différent + lien "Effacer les filtres" |
| Pas d'état vide sur la grille d'affectation | La grille affiche toujours les postes requis vides `[+]` — pas d'état vide global |
