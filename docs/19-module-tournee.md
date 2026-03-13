# 🚌 Module Tournée
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale
>
> Spécifie l'hébergement (rooming list), la gestion de flotte, et les préférences collaborateur.

---

## Concept

Une tournée, c'est une série de représentations dans des villes différentes. L'équipe voyage, dort sur place, se déplace entre les dates. Le régisseur doit gérer :

1. **L'hébergement** — quel hôtel pour quelles nuits, qui dort dans quelle chambre, et envoyer la rooming list à l'hôtel.
2. **La flotte** — quels véhicules, qui conduit, qui va où, à quelle heure.
3. **Les préférences collaborateur** — régime alimentaire, chambre simple ou partagée, allergies — indispensables pour la logistique hôtelière.

Pour les projets sans tournée, ces infos peuvent être saisies en texte libre dans `FeuilleDeRoute.transportInfo`. Ce module ajoute une structure de données propre et des interfaces dédiées pour les tournées longue distance.

**Articulation avec le reste :**
- Le Module Tournée s'intègre directement dans la **Feuille de route** (§11) : les sections Transport et Hébergement de la vue mobile deviennent structurées.
- Les modèles de données s'ajoutent au **schéma Prisma** (§15).
- Les préférences collaborateur enrichissent le **profil Collaborateur** (§07).

---

## 19.1 Hébergement & Rooming List

### 19.1.1 Concept

Un hébergement couvre une ou plusieurs nuits dans un même logement (hôtel, résidence, gîte…) pour un ensemble de représentations. Il est lié au **projet**, pas à une représentation unique — un hôtel à Lyon peut couvrir les nuits du 13, 14 et 15 mars pour les représentations du 14 et 15.

Un hébergement contient des chambres. Chaque chambre a des occupants assignés par nuit.

### 19.1.2 Wireframe — Vue régisseur : Rooming List

Accessible depuis la page du projet → onglet "Tournée".

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Peter Pan — Tournée                                                          │
│  [Planning] [Équipe] [RH] [Annulations] [Tournée ●]                          │
├───────────────────────────────────────────────────────────────────────────────┤
│  HÉBERGEMENTS                                          [ + Ajouter un hôtel ] │
├───────────────────────────────────────────────────────────────────────────────┤
│  📍 Hôtel Ibis Lyon Centre                                         [⋯]       │
│  13 mars → 15 mars · 14 Rue de la Barre, Lyon                                │
│  Contact : reception@ibis-lyon.fr · 04 72 56 89 10                           │
│                                                                               │
│  Chambres & Attribution                    [ + Chambre ] [ 📧 Envoyer à l'hôtel ]
│  ┌──────────────────────────────────────────────────────────────────────┐     │
│  │  Chambre     Type          Nuit 13/03          Nuit 14/03            │     │
│  ├──────────────────────────────────────────────────────────────────────┤     │
│  │  101         Individuelle  David R.            David R.              │     │
│  │  102         Individuelle  Alice M.            Alice M.              │     │
│  │  103         Double        Bob K. + Carol L.   Bob K. + Carol L.     │     │
│  │  104         Individuelle  [+ Assigner]        [+ Assigner]          │     │
│  │  ...                                                                 │     │
│  └──────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│  ⚠️  3 collaborateurs sans chambre pour la nuit du 13/03 :                    │
│  Frank D. · Hugo T. · Lucie V.                                                │
│                                          [ Assigner les chambres manquantes ] │
├───────────────────────────────────────────────────────────────────────────────┤
│  📍 Hôtel Mercure Bordeaux                                          [⋯]       │
│  19 mars → 20 mars · 5 Rue Robert Lateulade, Bordeaux                        │
│  [ Configurer les chambres ]                                                  │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 19.1.3 Modal — Ajouter un hébergement

```
┌──────────────────────────────────────────────────────────────────┐
│  Ajouter un hébergement                                [✕]       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Nom de l'établissement *                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Hôtel Ibis Lyon Centre                                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Adresse                                                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  14 Rue de la Barre, 69002 Lyon                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Période                                                         │
│  Check-in *         Check-out *                                  │
│  ┌────────────────┐  ┌────────────────┐                          │
│  │  13/03/2026    │  │  15/03/2026    │                          │
│  └────────────────┘  └────────────────┘                          │
│                                                                  │
│  Contact hôtel                                                   │
│  Email                              Téléphone                    │
│  ┌─────────────────────────────┐  ┌───────────────────────────┐  │
│  │  reception@ibis-lyon.fr     │  │  04 72 56 89 10           │  │
│  └─────────────────────────────┘  └───────────────────────────┘  │
│                                                                  │
│  Notes internes                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Navette depuis la gare à 10h — demander à la réception    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│                       [ Annuler ]  [ Ajouter l'hébergement ]    │
└──────────────────────────────────────────────────────────────────┘
```

### 19.1.4 Modal — Assigner une chambre

```
┌──────────────────────────────────────────────────────────────────┐
│  Chambre 103 — Hôtel Ibis Lyon Centre              [✕]           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Type de chambre                                                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Double                                                ▾   │  │
│  └────────────────────────────────────────────────────────────┘  │
│  Simple · Double · Double usage simple · Suite                   │
│                                                                  │
│  Occupants — Nuit du 13/03                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Bob K.                                              [✕]   │  │
│  │  Carol L.                                            [✕]   │  │
│  │  + Ajouter un occupant...                                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ⚠️  Bob K. : préfère chambre individuelle                       │
│                                                                  │
│  Occupants — Nuit du 14/03                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Bob K.                                              [✕]   │  │
│  │  + Ajouter un occupant...                                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Notes                                                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│                                [ Annuler ]  [ Enregistrer ]     │
└──────────────────────────────────────────────────────────────────┘
```

> **Note UX :** si un collaborateur a `preferenceChambre: INDIVIDUELLE` et est assigné à une chambre double, une alerte non bloquante s'affiche. Le régisseur peut passer outre.

### 19.1.5 Envoi de la Rooming List à l'hôtel

Le bouton `[ 📧 Envoyer à l'hôtel ]` génère et envoie un email formaté à l'adresse de l'hébergement.

**Format de l'email :**
```
Objet : Rooming List — Peter Pan · 13-15 mars 2026

Bonjour,

Veuillez trouver ci-dessous la liste des chambres pour le groupe
Théâtre du Nord, du 13 au 15 mars 2026.

Chambre 101 — Individuelle
  · David Renard (1 adulte)
  Nuits : 13/03 et 14/03

Chambre 102 — Individuelle
  · Alice Martin (1 adulte)
  Nuits : 13/03 et 14/03

Chambre 103 — Double
  · Bob Klein + Carol Laurent (2 adultes)
  Nuits : 13/03 et 14/03

Total : 3 chambres / 2 nuits
Arrivée estimée : 18h00 le 13 mars
Départ : avant 11h00 le 15 mars

Contact régisseur : Lucie Martin — lucie@theatre-nord.fr

Cordialement,
Théâtre du Nord
```

**Règles :**
- La rooming list n'est envoyée qu'à l'adresse email de l'hébergement (jamais aux collaborateurs).
- Un log `ActivityLog: ROOMING_LIST_ENVOYEE` est créé à chaque envoi.
- Chaque envoi affiche un badge "Envoyée le JJ/MM à HH:MM" sur la carte hébergement.
- Si la rooming list change après envoi → badge `⚠️ Modifiée depuis dernier envoi` → bouton renvoyer.

### 19.1.6 Vue collaborateur — Mon hébergement

Dans la feuille de route mobile (§11.1), la section HÉBERGEMENT apparaît si un hôtel est assigné :

```
┌────────────────────────────────────────┐
│  HÉBERGEMENT                           │
│  ────────────────────────────          │
│  🏨 Hôtel Ibis Lyon Centre             │
│  14 Rue de la Barre, 69002 Lyon        │
│  [ 📍 Ouvrir dans Maps ]              │
│                                        │
│  Chambre 101 · Individuelle            │
│  Check-in  : 13 mars après 15h         │
│  Check-out : 15 mars avant 11h         │
│                                        │
│  📞 Réception : 04 72 56 89 10        │
└────────────────────────────────────────┘
```

Le collaborateur ne voit que **sa propre chambre** — pas les autres occupants des autres chambres.

---

## 19.2 Gestion de flotte

### 19.2.1 Concept

La flotte regroupe les véhicules disponibles pour l'organisation (camion de matériel, vans de personnes, voitures de direction). Pour chaque représentation, le régisseur assigne les collaborateurs à des véhicules avec un point de rendez-vous et une heure de départ.

Avec le Module Tournée, `FeuilleDeRoute.transportInfo` (texte libre) coexiste avec les assignations structurées de flotte — les deux sont disponibles, le régisseur utilise ce qui convient à son projet.

### 19.2.2 Wireframe — Gestion des véhicules (niveau organisation)

Accessible depuis `/settings/organisation` → onglet "Flotte".

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Flotte de véhicules                                  [ + Ajouter un véhicule ]│
├───────────────────────────────────────────────────────────────────────────────┤
│  🚚 Camion plateau Mercedes 19T                                       [✏️][🗑] │
│  Immatriculation : AB-123-CD · Charge utile : 5T · Conducteur habituel : Marc  │
│                                                                               │
│  🚐 Van 9 places Citroën Jumper                                       [✏️][🗑] │
│  Immatriculation : EF-456-GH · 9 places · Conducteur habituel : Lucie          │
│                                                                               │
│  🚗 Renault Mégane (direction)                                        [✏️][🗑] │
│  Immatriculation : IJ-789-KL · 5 places · Conducteur habituel : Sam            │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 19.2.3 Wireframe — Assignation transport pour une représentation

Dans la feuille de route, la section Transport est remplacée par :

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  TRANSPORT — Peter Pan · Sam 14/03/2026               [ + Ajouter un trajet ] │
├───────────────────────────────────────────────────────────────────────────────┤
│  🚚 Camion plateau                                                    [✏️][🗑] │
│  Départ : 07h30 · Gare du Nord, Paris (parking P4)                            │
│  Conducteur : Marc Durand                                                      │
│  Passagers : —  (chargement matériel uniquement)                              │
│  Arrivée estimée : 11h00 au Théâtre du Châtelet                               │
│                                                                               │
│  🚐 Van 9 places                                                      [✏️][🗑] │
│  Départ : 09h45 · Gare du Nord, Paris (parvis)                                │
│  Conducteur : Lucie Martin                                                     │
│  Passagers (8/8) :                                                            │
│    David R. · Alice M. · Bob K. · Carol L.                                    │
│    Frank D. · Hugo T.  · Eve P. · Inès M.                                    │
│                                                                               │
│  🚗 Voiture direction                                                 [✏️][🗑] │
│  Départ : 11h00 · Paris 75008                                                 │
│  Conducteur : Sam Aubron                                                      │
│  Passagers (1/4) : Pierre D.                                                  │
│                                                                               │
│  ⚠️  3 collaborateurs sans transport assigné :                                │
│  Anna K. · Lucie V. · Jean M.                                                 │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 19.2.4 Modal — Assigner un trajet

```
┌──────────────────────────────────────────────────────────────────┐
│  Van 9 places — Peter Pan · 14/03                      [✕]       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Point de départ *                                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Gare du Nord, Paris — Parvis Nord                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Heure de départ *                                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  09:45                                                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Conducteur *                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Lucie Martin                                          ▾   │  │
│  └────────────────────────────────────────────────────────────┘  │
│  (liste des collaborateurs affectés à cette représentation)      │
│                                                                  │
│  Passagers   (8 places disponibles)                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ✅ David R.    ✅ Alice M.    ✅ Bob K.    ✅ Carol L.     │  │
│  │  ✅ Frank D.    ✅ Hugo T.     + Ajouter...                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Notes                                                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Prévoir de la place pour les costumes (valises)           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│                                [ Annuler ]  [ Enregistrer ]     │
└──────────────────────────────────────────────────────────────────┘
```

### 19.2.5 Vue collaborateur — Mon transport

Dans la feuille de route mobile, la section TRANSPORT devient structurée :

```
┌────────────────────────────────────────┐
│  TRANSPORT                             │
│  ────────────────────────────          │
│  🚐 Van 9 places                       │
│  Départ : 09h45                        │
│  📍 Gare du Nord, Paris — Parvis Nord  │
│  [ 📍 Ouvrir dans Maps ]              │
│                                        │
│  Conducteur : Lucie Martin             │
│  📞 06 12 34 56 78                    │
└────────────────────────────────────────┘
```

Le collaborateur voit uniquement **son véhicule** (conducteur + point de départ + heure). Pas la liste complète des passagers.

---

## 19.3 Préférences collaborateur

Ces champs enrichissent le profil `Collaborateur` (§07) et sont utilisés par le régisseur lors de la construction de la rooming list et de la logistique repas.

### 19.3.1 Wireframe — Section "Préférences tournée" dans le profil

Dans la fiche collaborateur (`/equipe/[id]`), une section supplémentaire apparaît pour les rôles RH et Directeur :

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  🚌 Préférences tournée                                              [✏️ Éditer]│
├───────────────────────────────────────────────────────────────────────────────┤
│  Hébergement        Chambre individuelle                                      │
│  Régime alimentaire Végétarien                                                │
│  Allergies          Gluten, lactose                                            │
│  Permis de conduire Oui — Permis B                                            │
│  Notes tournée      Préfère une chambre au calme (pas côté rue)               │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 19.3.2 Modal — Éditer les préférences

```
┌──────────────────────────────────────────────────────────────────┐
│  Préférences tournée — David R.                        [✕]       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Préférence chambre                                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Individuelle                                          ▾   │  │
│  └────────────────────────────────────────────────────────────┘  │
│  Options : Sans préférence · Individuelle · Partagée acceptée    │
│                                                                  │
│  Régime alimentaire                                              │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Standard                                              ▾   │  │
│  └────────────────────────────────────────────────────────────┘  │
│  Options : Standard · Végétarien · Végétalien · Sans porc        │
│            · Halal · Kasher · Autre                              │
│                                                                  │
│  Allergies alimentaires                                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Gluten, lactose                                           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Permis de conduire                                              │
│  ☑  Oui   Catégorie : ┌──────────────┐                          │
│                        │  B           │                          │
│                        └──────────────┘                          │
│                                                                  │
│  Notes                                                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│                                [ Annuler ]  [ Enregistrer ]     │
└──────────────────────────────────────────────────────────────────┘
```

**Règles :**
- Ces données sont **sensibles** (régime, allergies) — accessibles RH et Directeur uniquement. Pas affichées dans l'annuaire public.
- Le régime alimentaire et les allergies apparaissent dans la rooming list envoyée à l'hôtel (section "Régimes spéciaux") et peuvent être partagés avec le traiteur.
- `permisConduire: Boolean` + `permisCategorie: String?` permettent au régisseur de filtrer les conducteurs potentiels dans l'assignation flotte.

---

## 19.4 Export Rooming List (PDF)

Le régisseur peut exporter une rooming list complète en PDF depuis l'onglet Tournée.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  ROOMING LIST — THÉÂTRE DU NORD                                               │
│  Peter Pan — Tournée printemps 2026                                           │
│  Exportée le 10/03/2026 à 14h22                                               │
├───────────────────────────────────────────────────────────────────────────────┤
│  HÔTEL IBIS LYON CENTRE · 13-15 mars 2026                                     │
│  14 Rue de la Barre, 69002 Lyon · Tél. 04 72 56 89 10                        │
├────────────────┬─────────────────┬──────────────┬──────────────┬─────────────┤
│  Chambre       │ Type            │ Nuit 13/03   │ Nuit 14/03   │ Régime      │
├────────────────┼─────────────────┼──────────────┼──────────────┼─────────────┤
│  101           │ Individuelle    │ David R.     │ David R.     │ Standard    │
│  102           │ Individuelle    │ Alice M.     │ Alice M.     │ Végétarien  │
│  103           │ Double          │ Bob K.       │ Bob K.       │ Standard    │
│                │                 │ Carol L.     │ Carol L.     │ Sans gluten │
│  104           │ Individuelle    │ Frank D.     │ —            │ Standard    │
└────────────────┴─────────────────┴──────────────┴──────────────┴─────────────┘
│  Régimes spéciaux : Alice M. (végétarien) · Carol L. (sans gluten)           │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 19.5 Modèles de données

À ajouter au schéma Prisma (§15) et à `05-data-models.md`.

```
Hebergement (hôtel / logement pour une période de tournée)
├── id
├── projetId               ← rattaché au projet (pas à une représentation unique)
├── nom: String            ← ex: "Hôtel Ibis Lyon Centre"
├── adresse: String?
├── ville: String?
├── telephone: String?
├── email: String?         ← pour l'envoi de la rooming list
├── checkIn: Date          ← date d'arrivée (date sans heure — cohérent avec Representation.date)
├── checkOut: Date         ← date de départ (date sans heure)
├── notes: String?         ← notes internes (non envoyées à l'hôtel)
├── roomingListEnvoyeeAt: DateTime?   ← null = jamais envoyée
├── createdById, createdAt, updatedAt
└── → Chambres[]

Chambre
├── id, hebergementId
├── numero: String?        ← ex: "101", "Suite A"
├── type: INDIVIDUELLE | DOUBLE | DOUBLE_USAGE_SIMPLE | SUITE
├── notes: String?
└── → Occupants[]

ChambreOccupant (lien Chambre ↔ Collaborateur par nuit)
├── id, chambreId, collaborateurId
├── nuitDu: Date           ← date de la nuit (date sans heure — cohérent avec DM-6 session 22)
└── notes: String?         ← ex: "arrivée tardive prévue"

Vehicule (flotte de l'organisation)
├── id, organizationId
├── label: String          ← ex: "Camion plateau", "Van 9 places"
├── type: CAMION | VAN | VOITURE | AUTRE
├── immatriculation: String?
├── capacitePersonnes: Int?
├── capaciteChargement: String?  ← ex: "3,5T" (texte libre)
├── conducteurHabituelId: String?  ← userId
├── actif: Boolean         ← false = archivé, ne s'affiche plus
├── createdAt, updatedAt
└── → Assignations[]

VehiculeAssignment (véhicule × représentation)
├── id, vehiculeId, representationId
├── departLieu: String?    ← point de départ
├── departTime: String?    ← "HH:MM"
├── arriveeEstimeeTime: String?
├── notes: String?
├── createdAt
└── → Passagers[]

VehiculePassager (collaborateur dans un véhicule)
├── id, vehiculeAssignmentId, collaborateurId
└── role: CONDUCTEUR | PASSAGER
   ⚠️ Un seul CONDUCTEUR par VehiculeAssignment

-- Champs à ajouter sur Collaborateur (§07) --
Collaborateur
├── ... champs existants ...
├── preferenceChambre: SANS_PREFERENCE | INDIVIDUELLE | PARTAGEE_ACCEPTEE
├── regimeAlimentaire: STANDARD | VEGETARIEN | VEGAN | SANS_PORC | HALAL | KASHER | AUTRE
├── allergies: String?           ← texte libre, ex: "gluten, lactose"
├── permisConduire: Boolean      ← false par défaut
└── permisCategorie: String?     ← ex: "B", "BE", "C", "CE"
```

---

## 19.6 Routes

**Pages :**

| Route | Page | Rôle minimum |
|-------|------|:---:|
| `/projets/[id]/tournee` | Onglet Tournée — hébergements + flotte | REGISSEUR |
| `/settings/organisation/flotte` | Gestion des véhicules de l'organisation | DIRECTEUR |

**API :**

| Méthode | Route | Action | Rôle |
|---------|-------|--------|------|
| GET | `/api/projets/[id]/hebergements` | Lister hébergements du projet | REGISSEUR |
| POST | `/api/projets/[id]/hebergements` | Créer un hébergement | REGISSEUR |
| PATCH | `/api/hebergements/[id]` | Modifier un hébergement | REGISSEUR |
| DELETE | `/api/hebergements/[id]` | Supprimer un hébergement | REGISSEUR |
| POST | `/api/hebergements/[id]/chambres` | Ajouter une chambre | REGISSEUR |
| PATCH | `/api/chambres/[id]` | Modifier une chambre (type, occupants) | REGISSEUR |
| DELETE | `/api/chambres/[id]` | Supprimer une chambre | REGISSEUR |
| POST | `/api/hebergements/[id]/envoyer` | Envoyer la rooming list par email | REGISSEUR |
| GET | `/api/projets/[id]/hebergements/pdf` | Export PDF rooming list complète | REGISSEUR |
| GET | `/api/organisations/[id]/vehicules` | Lister la flotte | DIRECTEUR / REGISSEUR |
| POST | `/api/organisations/[id]/vehicules` | Créer un véhicule | DIRECTEUR |
| PATCH | `/api/vehicules/[id]` | Modifier un véhicule | DIRECTEUR |
| POST | `/api/representations/[id]/transport` | Assigner un véhicule à une représentation | REGISSEUR |
| PATCH | `/api/vehicule-assignments/[id]` | Modifier une assignation | REGISSEUR |
| PATCH | `/api/collaborateurs/[id]/preferences-tournee` | Modifier les préférences | RH |

---

## 19.7 Intégration avec la Feuille de route (§11)

Quand le Module Tournée est activé :

1. `FeuilleDeRoute.transportInfo` (texte libre) est **remplacé** par l'affichage structuré des `VehiculeAssignment` liés à cette représentation.
2. La section HÉBERGEMENT de la vue mobile apparaît si un `ChambreOccupant` existe pour ce collaborateur sur la nuit de la représentation (nuit du même jour ou nuit précédente selon l'heure de check-in).
3. La section RÉGIME ALIMENTAIRE n'apparaît pas côté collaborateur — elle est uniquement utilisée par le régisseur pour la logistique.

**Rétrocompatibilité :** si aucun véhicule n'est assigné mais que `FeuilleDeRoute.transportInfo` contient du texte → afficher le texte libre en fallback. Permet une migration progressive sans casser les feuilles de route existantes.

---

## 19.8 Questions ouvertes v3

| # | Question | Impact |
|---|----------|--------|
| 1 | **Flotte mutualisée entre projets** : un même camion peut servir sur plusieurs projets en même temps — détecter les conflits de véhicule inter-projets | Logique de conflit complexe |
| 2 | **Connexion hôtels** : API de réservation directe (Booking Business, HRS) plutôt qu'email manuel | Intégrations tierces |
| 3 | **Budget tournée** : suivre le coût hôtelier (prix par chambre × nuitées) et l'agréger dans un budget global | Module finance |
| 4 | **Partage préférences par le collaborateur** : permettre au collaborateur de saisir lui-même ses préférences depuis son espace `/mon-compte` | Self-service |
| 5 | **Export SNCF / plan de déplacement** : générer un document de voyage avec horaires de train pour chaque membre | Intégration SNCF |
