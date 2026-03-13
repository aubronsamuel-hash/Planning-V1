# 🗺️ Feuille de Route & Logistique
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

## Feuille de route & logistique

### Concept

La feuille de route est le **compagnon de terrain** de chaque représentation. Là où les autres onglets du projet servent au bureau (planification, RH, paie), la feuille de route sert **sur place** — le matin de la date, sur le téléphone d'un machiniste qui débarque à Lyon à 6h.

Elle agrège les données déjà présentes (salle, horaires, équipe) et y ajoute la logistique : le séquençage de la journée, les détails de transport, et les contacts locaux — tout ce qu'un régisseur tape habituellement dans un PDF Word qu'il envoie par email la veille.

**Décisions :**
- Une feuille de route par représentation (1:1)
- Transport : champ texte libre pour les dates simples — gestion de flotte structurée via Module Tournée (§19)
- Hébergement & rooming list : Module Tournée (§19 — `19-module-tournee.md`)

---

### 11.1 Vue mobile — Ce que voit le collaborateur

La feuille de route est **mobile-first**. C'est le seul écran du produit conçu pour être consulté sur un téléphone dans la rue, pas derrière un bureau.

```
┌────────────────────────────────────────┐
│  ← Mon planning                        │
│                                        │
│  🎭 Peter Pan                          │
│  Samedi 14 mars 2026                   │
│  Théâtre du Châtelet, Paris            │
│  [ 📍 Ouvrir dans Maps ]              │
├────────────────────────────────────────┤
│  MON RÔLE                              │
│  Éclairagiste · 🟠 Intermittent       │
│  Arrivée : 11h00 · Départ : 16h00     │
│  Rémunération prévue : 185,00 €       │
├────────────────────────────────────────┤
│  DÉROULÉ DE LA JOURNÉE                 │
│  ────────────────────────────          │
│  11h00  📦 Déchargement & installation │
│          Hall technique — niveau -1   │
│                                        │
│  12h30  🍽️  Catering équipe technique │
│          Salle des artistes — 1er ét. │
│                                        │
│  13h30  🎛️  Balances / mise en lumière │
│                                        │
│  14h00  🎭 REPRÉSENTATION (1h30)       │
│                                        │
│  15h30  📦 Démontage                   │
│          Départ camion estimé : 16h30 │
├────────────────────────────────────────┤
│  TRANSPORT                             │
│  Van départ Gare du Nord à 09h45      │
│  Contact chauffeur : Marc 06 12 34 56 │
├────────────────────────────────────────┤
│  CONTACTS LOCAUX                       │
│  Jean-Pierre Roy · Régisseur général  │
│  du Châtelet · 06 98 76 54 32        │
│  [ 📞 ] [ ✉️ ]                        │
│                                        │
│  Isabelle C. · Responsable accueil    │
│  [ 📞 ] [ ✉️ ]                        │
└────────────────────────────────────────┘
```

**Principes de la vue mobile :**
- Chaque adresse est un lien GPS (Maps / Plans / Waze)
- Chaque téléphone est cliquable (appel direct)
- Le collaborateur ne voit que ses informations personnelles
- Si la feuille n'est pas encore publiée, un message l'indique : "La feuille de route pour cette date n'est pas encore disponible."

---

### 11.2 Vue régisseur — Création et édition

Le régisseur crée et édite la feuille de route depuis la page de la représentation.

```
┌──────────────────────────────────────────────────────────────────┐
│  🗺️ Feuille de route — Peter Pan · Sam 14/03/2026              │
│  Statut : 🔴 Brouillon · [ Publier aux équipes ]               │
│                                        [ ⬇ PDF ] [ 📧 Partager ]│
├─────────────────────────────────┬────────────────────────────────┤
│  DÉROULÉ DE LA JOURNÉE          │  ÉQUIPE AU COMPLET (12)        │
│  [ + Ajouter une phase ]        │                                │
│                                 │  🔧 Technique (5)              │
│  11h00  📦 Déchargement         │  David R.   🔵  11h → 16h     │
│         Hall technique / N-1    │  Alice M.   🟠  11h → 16h     │
│         [✏️] [🗑]               │  Bob K.     🟠  11h → 16h     │
│                                 │  Carol L.   🟡  11h → 16h     │
│  12h30  🍽️  Catering           │  Eve P.     🟠  11h → 16h     │
│         Salle des artistes      │                                │
│         [✏️] [🗑]               │  🏛️ Salle (4)                 │
│                                 │  Frank D.   🔵  13h → 16h     │
│  14h00  🎭 Représentation       │  Hugo T.    🔵  13h → 16h     │
│         Scène principale · 1h30 │  Lucie V.   🟠  13h → 16h     │
│         [✏️] [🗑]               │  Anna K.    🟠  13h → 16h     │
│                                 │                                │
│  15h30  📦 Démontage            │  🎟️ Billetterie (3)           │
│         [✏️] [🗑]               │  Inès M.    🟡  12h → 15h    │
│                                 │  ...                           │
├─────────────────────────────────┴────────────────────────────────┤
│  TRANSPORT                                                        │
│  [Champ texte libre]                                             │
│  "Van départ Gare du Nord 09h45 — contact Marc 06 12 34 56      │
│   Retour départ 16h30 depuis théâtre"                           │
│                          (texte libre — flotte structurée: §19)   │
├──────────────────────────────────────────────────────────────────┤
│  CONTACTS LOCAUX                      [ + Ajouter un contact ]  │
│  Jean-Pierre Roy · Régisseur général · 06 98 76 54 32  [✏️][🗑] │
│  Isabelle C. · Accueil · 01 45 67 89 10                [✏️][🗑] │
│  Pizzeria du Châtelet · Catering · 01 23 45 67 89      [✏️][🗑] │
└──────────────────────────────────────────────────────────────────┘
```

---

### 11.3 Phases de la journée (Déroulé)

Le régisseur construit le séquençage chronologique de la journée. Les phases sont librement ordonnées et éditables.

**Types de phases prédéfinis :**

| Type | Icône | Description |
|------|-------|-------------|
| DECHARGEMENT | 📦 | Arrivée du matériel, déchargement camion |
| MONTAGE | 🔧 | Installation technique (son, lumière, décors) |
| BALANCES | 🎛️ | Balance son, test lumières, répétition technique |
| CATERING | 🍽️ | Repas d'équipe (heure et lieu) |
| ECHAUFFEMENT | 🎭 | Préparation artistique, mise en place |
| REPRESENTATION | 🎭 | La représentation elle-même |
| ENTRACTE | ⏸️ | Entracte (durée) |
| DEMONTAGE | 📦 | Démontage, rangement, chargement |
| PAUSE | ☕ | Pause informelle |
| AUTRE | 📋 | Phase libre (label personnalisé) |

Les phases REPRESENTATION et ENTRACTE sont **pré-remplies** depuis les créneaux de la représentation (`showStartTime`, `showEndTime`). Le régisseur peut les modifier ponctuellement sans changer les données de la représentation.

---

### 11.4 Transport

Le champ `FeuilleDeRoute.transportInfo` (String?) stocke les informations de transport en texte libre. Le régisseur y saisit les informations utiles (heure de départ du van, n° de train, contact chauffeur…).

> **Module Tournée (§19) :** pour les tournées longue distance, la gestion structurée de flotte (`Vehicule`, `VehiculeAssignment`, `VehiculePassager`) remplace ce champ texte. Voir `19-module-tournee.md`.

---

> ### 🚌 Module Tournée (§19)
>
> La gestion de **l'hébergement** (rooming list, attribution de chambres, envoi à l'hôtel) et de la **flotte de véhicules** (qui conduit quel camion/van) est spécifiée dans `19-module-tournee.md`.
>
> Ces fonctionnalités s'intègrent directement à la Feuille de route : les sections Transport et Hébergement de la vue mobile deviennent structurées dès que le Module Tournée est activé sur un projet.
>
> Pour les projets sans tournée, le champ texte libre `transportInfo` (§11.4) suffit.

---

### 11.5 Contacts locaux

Carnet de contacts spécifique à cette représentation, dans cette salle.

**Types de contacts :**
- `VENUE` — Régisseur général, accueil technique, directeur de salle
- `CATERING` — Traiteur, restaurant partenaire
- `SECURITE` — Responsable sécurité, service d'ordre
- `HOTEL` — Contact hôtel (utile sur tournée — voir Module Tournée §19)
- `URGENCE` — Médecin de permanence, pompiers locaux (non 18 — contact spécifique)
- `AUTRE` — Tout autre contact utile

Chaque contact : nom, rôle, téléphone, email. Le téléphone est cliquable sur mobile.

---

### 11.6 Publication de la feuille de route

**Statuts :**
- `BROUILLON` → visible uniquement du régisseur et du chef de poste. Les collaborateurs voient "Feuille de route non encore disponible."
- `PUBLIEE` → visible de tous les collaborateurs affectés à cette représentation
- `ARCHIVEE` → après la date, passage automatique en archivé (J+1) via le cron quotidien §21.7 Étape 3

**Flux de publication :**
```
[Régisseur — bouton "Publier aux équipes"]
    → Confirmation : "Cette feuille de route sera visible de
       tous les collaborateurs affectés à cette représentation.
       Continuer ?"
    → [Publier]
    → FeuilleDeRoute.statut = PUBLIEE, publishedAt = now()
    → ActivityLog: FEUILLE_DE_ROUTE_PUBLIEE (actorId, representationId)
    → Notification envoyée à tous les collaborateurs affectés :
      "📋 La feuille de route pour Peter Pan · Sam 14/03 est disponible."
    → Lien direct vers la vue mobile
```

Si le régisseur modifie après publication, une notification de mise à jour est envoyée et `ActivityLog: FEUILLE_DE_ROUTE_MODIFIEE` est créé.

---

### 11.7 Nouveaux modèles de données

```
FeuilleDeRoute (1:1 avec Representation)
├── id
├── representationId (unique)
├── statut: BROUILLON | PUBLIEE | ARCHIVEE
├── notesGenerales: String?     ← notes visibles de toute l'équipe
├── transportInfo: String?      ← texte libre (N° train, heure RDV, contact chauffeur)
│                               ← pour les tournées : remplacé par flotte structurée §19
├── publishedAt: DateTime?
├── createdById, createdAt, updatedAt
└── → PhasesJournee[], ContactsLocaux[]

PhaseJournee (déroulé chronologique de la journée)
├── id, feuilleDeRouteId
├── ordre: Int                  ← position dans la liste (1, 2, 3…)
├── type: DECHARGEMENT | MONTAGE | BALANCES | CATERING | ECHAUFFEMENT
│         | REPRESENTATION | ENTRACTE | DEMONTAGE | PAUSE | AUTRE
├── labelCustom: String?        ← si type = AUTRE
├── startTime: String "HH:MM"
├── endTime:   String? "HH:MM"
├── lieu: String?               ← ex: "Hall technique — Niveau -1"
└── notes: String?

→ Hebergement / Chambre / ChambreOccupant / Vehicule → Module Tournée (§19)

ContactLocal
├── id, feuilleDeRouteId
├── nom: String, role: String
├── type: VENUE | CATERING | SECURITE | HOTEL | URGENCE | AUTRE
├── telephone: String?
├── email: String?
└── notes: String?
```

---

### 11.8 Nouvelles routes

| Route | Page | Rôle minimum |
|-------|------|:---:|
| `/projets/[id]/planning/[representationId]/feuille-de-route` | Création / édition (régisseur) | Régisseur |
| `/mon-planning/[representationId]/feuille-de-route` | Vue mobile collaborateur | Collaborateur |
| `/api/feuille-de-route/[id]/pdf` | Export PDF feuille de route complète | Régisseur / Chef |
| `POST /api/feuille-de-route/[id]/copier-depuis` | Copier la structure d'une FDR existante (§11.9.3) | Régisseur |

---

### 11.9 Spécifications complémentaires

| # | Fonctionnalité | Statut |
|---|----------------|--------|
| 1 | **Module Tournée** — hébergement, flotte, rooming list | ✅ Voir `19-module-tournee.md` |
| 2 | **Préférences collaborateur** — régime, chambre, allergies | ✅ Voir `19-module-tournee.md §19.3` |
| 3 | **Feuille de route mutualisée** — spécification ci-dessous | ✅ Inclus |
| 4 | **Accès hors-ligne (PWA)** — spécification ci-dessous | ✅ Inclus |

---

#### 11.9.3 Feuille de route mutualisée

**Problème :** sur une tournée de 30 dates, le régisseur recrée à la main la même feuille de route (mêmes phases, même transport, mêmes contacts locaux) pour chaque représentation dans la même ville. Perte de temps considérable.

**Solution proposée :** un bouton "Copier depuis une autre date" dans l'éditeur de feuille de route. Le régisseur choisit une source, la structure est dupliquée — il n'ajuste que ce qui change (heure de départ du van, contact de permanence).

**UX — Wireframe :**

```
┌──────────────────────────────────────────────────────────────────┐
│  🗺️ Feuille de route — Peter Pan · Dim 15/03/2026               │
│  Statut : 🔴 Brouillon                                           │
│                                        [ ⬇ PDF ] [ 📋 Copier depuis... ]│
├──────────────────────────────────────────────────────────────────┤
│  (feuille vide — aucune phase créée)                             │
│                                                                  │
│  [ + Ajouter une phase ]                                         │
└──────────────────────────────────────────────────────────────────┘

→ Clic sur [ 📋 Copier depuis... ] :

┌──────────────────────────────────────────────────────────────────┐
│  Copier depuis une autre date                          [✕]        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Choisir la date source :                                        │
│                                                                  │
│  ● 🗺️ Sam 14/03 — Peter Pan · Théâtre du Châtelet, Paris       │
│    Phases : 4  · Contacts : 3  · Transport renseigné ✓          │
│                                                                  │
│  ○ 🗺️ Ven 12/03 — Peter Pan · Théâtre du Châtelet, Paris       │
│    Phases : 4  · Contacts : 3  · Transport renseigné ✓          │
│                                                                  │
│  ○ Jeu 11/03 — Peter Pan · Zénith de Nantes                     │
│    Pas de feuille de route créée                    ✗            │
│                                                                  │
│  Ce qui sera copié :                                             │
│  ✅ Déroulé de la journée (phases)                               │
│  ✅ Transport (texte libre)                                       │
│  ✅ Contacts locaux                                               │
│  ✅ Notes générales                                               │
│  ❌ Statut (repart en Brouillon)                                  │
│  ❌ Équipe (dépend de la date de destination)                     │
│                                                                  │
│                    [ Annuler ]  [ Copier cette feuille de route ] │
└──────────────────────────────────────────────────────────────────┘

→ Après confirmation :
    → Phases, contacts, transportInfo copiés en base
    → Statut = BROUILLON (pas publiée)
    → Toast : "Feuille de route copiée depuis Sam 14/03. Vérifiez les horaires avant publication."
```

**Règles métier :**
- Seules les feuilles de route avec `statut = PUBLIEE` ou `ARCHIVEE` apparaissent comme sources (BROUILLON exclu — pas encore validée)
- Si la feuille de destination a déjà des phases → confirmation : "Cette feuille de route a déjà du contenu. Remplacer ?"
- La copie est une opération de création en base, pas un lien — modifier la copie ne modifie pas la source

**Impact technique :**
```
API
POST /api/feuille-de-route/[id]/copier-depuis
  body: { sourceFeuilleDeRouteId: string }
  → Copie PhaseJournee[], ContactLocal[], transportInfo, notesGenerales
  → Réinitialise statut à BROUILLON, publishedAt à null
```

**Verdict :** fonctionnalité peu complexe, valeur élevée sur les tournées. ✅ **Inclus.**

---

#### 11.9.4 Accès hors-ligne (PWA)

**Problème :** un machiniste arrive à Lyon à 6h, réseau défaillant. Sa feuille de route est inaccessible. Tout ce qu'il voulait, c'était l'adresse de la salle et l'heure du déchargement.

**Solution proposée :** Progressive Web App (PWA) avec Service Worker. La vue mobile `/mon-planning/[representationId]/feuille-de-route` est mise en cache lors de la dernière visite. L'accès hors-ligne est en lecture seule.

**Scope ciblé (minimal) :**

| Ce qui fonctionne hors-ligne | Ce qui nécessite du réseau |
|------------------------------|---------------------------|
| Lire sa feuille de route | Confirmer/refuser une affectation |
| Voir l'adresse + lien Maps sauvegardé | Voir les mises à jour en temps réel |
| Consulter son rôle, horaires, rémunération | Notifications push |
| Appeler un contact (lien `tel:`) | Accéder aux documents S3 |

**Stratégie de cache :**
```
Service Worker — stratégies par route :

/mon-planning/*                → Network-first avec fallback cache
  (planning complet : toujours frais si réseau dispo)

/mon-planning/[id]/feuille-de-route
  → Cache-first (priorité cache)
  → Mise à jour en arrière-plan si réseau dispo (stale-while-revalidate)
  → Durée de cache : 7 jours (couvre une tournée entière)

Assets statiques (JS, CSS, fonts)
  → Cache-first permanent (hash dans le filename)
```

**Manifest PWA :**
```json
{
  "name": "Planning Spectacle",
  "short_name": "Planning",
  "start_url": "/mon-planning",
  "display": "standalone",
  "theme_color": "#1a1a2e",
  "icons": [{ "src": "/icon-192.png", "sizes": "192x192" }]
}
```

**UX — Indicateur de statut réseau :**
```
┌────────────────────────────────────────┐
│  ← Mon planning          🔴 Hors-ligne │
│                                        │
│  🎭 Peter Pan                          │
│  Samedi 14 mars 2026                   │
│  ────────────────────────────────      │
│  ⚠️  Données mises en cache hier à    │
│  22h14 — possibles mises à jour        │
│                                        │
│  Théâtre du Châtelet, Paris            │
│  [ 📍 Ouvrir dans Maps ]  ← sauvegardé│
│  ...                                   │
└────────────────────────────────────────┘
```

**Impact technique :**
- `next-pwa` (wrapper Workbox pour Next.js App Router) ou configuration Workbox manuelle
- `manifest.json` dans `/public`
- Service Worker enregistré dans le layout root
- ⚠️ Incompatible avec certains patterns Next.js App Router — nécessite test d'intégration

**Verdict :** valeur réelle sur les tournées, complexité modérée côté infra PWA, zéro impact sur le backend. ✅ **Inclus.**
