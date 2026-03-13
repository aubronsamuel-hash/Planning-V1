# 📒 Annuaire des collaborateurs
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

## Annuaire des collaborateurs

### Concept : le profil portable

Un collaborateur peut travailler pour **plusieurs organisations** sur la plateforme (un intermittent qui travaille pour le Théâtre du Nord ET la Compagnie des Lumières). Son compte est unique, son identité de base est partagée, mais chaque organisation gère ses propres données contractuelles (N°SS, IBAN, type de contrat).

```
PLATEFORME (User)
├── Identité commune : nom, email, téléphone, photo
└── Compte GHOST ou ACTIVE

  Organisation A (Théâtre du Nord)
  └── Collaborateur A : contractType, N°SS, IBAN, spécialités, historique org A

  Organisation B (Compagnie des Lumières)
  └── Collaborateur B : contractType, N°SS, IBAN, spécialités, historique org B
```

L'email est l'identifiant universel. Quand un régisseur tape l'email d'un intermittent déjà présent sur la plateforme, le profil de base est pré-rempli automatiquement — seules les données RH spécifiques à cette organisation restent à saisir.

---

### 7.1 Vue liste — Annuaire de l'organisation (`/equipe`)

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│              │  Équipe (28 membres)                      [ + Inviter ]  │
│   SIDEBAR    │  🔍 Rechercher par nom, email, spécialité...             │
│              │  Filtrer : [Tous types ▾]  [Toutes prods ▾]  [Tous ▾]  │
│              ├──────────┬──────────┬─────────────┬────────┬────────────┤
│              │ Nom      │ Type     │ Projets     │ DPAE   │            │
│              ├──────────┼──────────┼─────────────┼────────┼────────────┤
│              │ Alice M. │ 🟠 Inter.│ Peter Pan   │ ✅     │  ···       │
│              │ Bob K.   │ 🟠 Inter.│ Peter Pan   │ ✅     │  ···       │
│              │ Carol L. │ 🟡 CDD   │ Peter Pan   │ ✅     │  ···       │
│              │ David R. │ 🔵 CDI   │ Peter Pan   │ —      │  ···       │
│              │ Sophie T.│ 🟠 Inter.│ Garou       │ 🟡     │  ···       │
└──────────────┴──────────┴──────────┴─────────────┴────────┴────────────┘
  Tri : Nom · Type · Dernière représentation    Export : [CSV]
```

Clic sur `···` → panneau latéral avec la fiche collaborateur (voir §7.2).

---

### 7.2 Fiche collaborateur enrichie

La fiche collaborateur vu par le RH ou le Directeur contient :

**Bloc Identité (données plateforme)**
```
┌─────────────────────────────────────────────────────┐
│  [Photo]  Alice Martin                               │
│           alice.martin@email.com · 📞 06 12 34 56 78│
│           Compte : ✅ ACTIF  (activé le 12/01/2025)  │
├─────────────────────────────────────────────────────┤
│  SPÉCIALITÉS DÉCLARÉES                               │
│  🔦 Éclairagiste  ·  🎛️ Régisseur son               │
│  Experience : 8 ans · Disponible en tournée : Oui   │
└─────────────────────────────────────────────────────┘
```

**Bloc RH (données de l'organisation courante)**
```
┌─────────────────────────────────────────────────────┐
│  TYPE DE CONTRAT : 🟠 Intermittent du spectacle      │
│  N° Congés Spectacles : 123456    [🔒 RH only]       │
│  N° Sécurité Sociale  : 2 •• ••• ••• ••• ••  [🔒]  │
│  IBAN                 : FR76 •••• •••• ••••  [🔒]   │
│  Taux horaire / Cachet habituel : 185,00 €           │
└─────────────────────────────────────────────────────┘
```

**Bloc Historique dans l'organisation**
```
┌─────────────────────────────────────────────────────┐
│  PROJETS EN COURS                                    │
│  Peter Pan · Éclairagiste · 28 représentations      │
│                                                      │
│  PROJETS PASSÉS                                      │
│  Hamlet 2025          · Éclairagiste · 18 repr.     │
│  Roméo & Juliette 2024 · Éclairagiste · 32 repr.    │
│  Les Misérables 2023  · Régisseur son · 24 repr.    │
│                                                      │
│  Total représentations avec nous : 102               │
│  Première collaboration : 14/03/2023                 │
└─────────────────────────────────────────────────────┘
```

**Bloc Documents** (visibles RH / Directeur)
```
┌─────────────────────────────────────────────────────┐
│  DOCUMENTS                                [ + Ajouter]│
│  📄 Contrat CDD — Peter Pan 2026.pdf       [⬇] [🗑]  │
│  📄 DPAE — Peter Pan — Alice M. — 01/03    [⬇] [🗑]  │
│  📄 RIB Alice Martin.pdf                   [⬇] [🗑]  │
└─────────────────────────────────────────────────────┘
```

**[ + Ajouter ] — Modal d'upload :**
```
┌──────────────────────────────────────────────────────┐
│  Ajouter un document                           [✕]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Nom du document *                                   │
│  [Contrat CDD — Peter Pan 2026              ]        │
│                                                      │
│  Type de document                                    │
│  [ Contrat ▾ ]  ← Contrat | DPAE | RIB | Avenant   │
│                    | Fiche de poste | Autre           │
│                                                      │
│  Fichier *   [ Glisser un fichier ou cliquer ]       │
│              PDF, JPG, PNG — max 5 Mo               │
│                                                      │
│  Visible par le collaborateur ?  ☑ Oui ☐ Non        │
│                                                      │
│              [ Annuler ]  [ Enregistrer ]            │
└──────────────────────────────────────────────────────┘
```

**Règles documents :**
- Upload : RH ou Directeur uniquement depuis `/equipe/[id]`
- Formats acceptés : PDF, JPG, PNG — max 5 Mo par fichier (règle #29)
- Stockage S3 : `[org_id]/[user_id]/documents/[filename]` (conforme règle #29 : `org_id/user_id/[type]/[filename]`)
- Si "Visible par le collaborateur" = Oui → apparaît dans `/mes-contrats` du collaborateur
- Suppression [🗑] → soft delete (Document.deletedAt) — le fichier S3 est conservé 30j
- Le collaborateur ne peut PAS uploader depuis `/mes-contrats` — lecture seule

---

### 7.3 Spécialités du collaborateur

Un collaborateur peut déclarer ses spécialités depuis son profil personnel. Ces spécialités sont visibles de toutes les organisations qui le font travailler — c'est la dimension "CV léger" de la plateforme.

**Modèle de données — extension Collaborateur :**
```
Collaborateur (extension)
├── specialites: String[]    ← liste libre : "Éclairagiste", "Son", "Machiniste"...
├── yearsExperience: Int     ← années d'expérience (déclaratif)
└── availableForTour: Boolean ← disponible pour tournées hors ville
```

Ces champs sont **modifiables par le collaborateur lui-même** depuis son espace `/settings`.

---

### 7.4 Recherche dans l'annuaire

**Depuis `/equipe` (vue Directeur / RH) :**
```
┌──────────────────────────────────────────────────────────┐
│  Équipe (28 membres)                    [ + Inviter ]    │
│  🔍 Rechercher par nom, email, spécialité...             │
│  Filtrer : [Tous types ▾] [Tous projets ▾] [Tous ▾]    │
├────────────────────────────────────────────────────────  │
│  Tri disponible : Nom · Type · Dernière représentation   │
│  Export : [CSV] (liste des collaborateurs actifs)        │
└──────────────────────────────────────────────────────────┘
```

**Depuis l'affectation dans la grille planning :**
Quand le régisseur clique [+] sur une cellule vide, la recherche suggère en priorité :
1. Les collaborateurs déjà dans l'organisation (annuaire interne)
2. Les collaborateurs déjà affectés à ce projet (familiers du spectacle)
3. Les collaborateurs déjà sur ce poste sur un projet passé

---

### 7.5 Extension du modèle Collaborateur — Spécialités

> Ces champs sont des champs directs sur `Collaborateur` (pas un modèle séparé) — confirmé dans `15-schema-prisma.md` lignes 364–366.

```
Collaborateur (champs spécialisation — sur le modèle principal)
├── specialites: String[]        ← ["Éclairagiste", "Son", "Scénographie"]
├── yearsExperience: Int?        ← expérience déclarée (non vérifié)
└── availableForTour: Boolean    ← accepte les tournées

OrganizationMembership (lien User ↔ Organization)
├── id, userId, organizationId
├── role: DIRECTEUR | REGISSEUR | RH | COLLABORATEUR
│   ⚠️  CHEF_POSTE n'est PAS un rôle d'organisation — voir EquipeMembre.role: CHEF
├── joinedAt
└── invitedById
```

---

### 7.6 Historique d'un collaborateur (`/equipe/[id]/historique`)

Vue complète de tous les projets et représentations d'un collaborateur dans l'organisation, accessible au RH uniquement.

```
┌──────────────────────────────────────────────────────────────────┐
│  Historique — Alice Martin                     [ Exporter CSV ]  │
├───────────────┬──────────────────┬────────┬──────────┬───────────┤
│ Projet        │ Poste            │ Repré. │ Période  │ Total     │
├───────────────┼──────────────────┼────────┼──────────┼───────────┤
│ Peter Pan '26 │ Éclairagiste     │ 28/40  │ fév→juin │ 5 180€    │
│ Hamlet '25    │ Éclairagiste     │ 18/18  │ oct→nov  │ 3 330€    │
│ Roméo '24     │ Éclairagiste     │ 32/32  │ mars→mai │ 5 920€    │
│ Misér. '23    │ Régisseur son    │ 24/24  │ jan→mars │ 5 040€    │
├───────────────┴──────────────────┴────────┴──────────┴───────────┤
│  Total représentations : 102   ·   Total rémunération : 19 470€  │
│  Première collaboration : 14/03/2023                              │
└──────────────────────────────────────────────────────────────────┘
```

---

### 7.7 Routes annuaire

| Route | Page | Rôle minimum |
|-------|------|:---:|
| `/equipe` | Annuaire de l'organisation | Directeur / RH |
| `/equipe/[id]` | Fiche détaillée collaborateur | Directeur / RH |
| `/equipe/[id]/historique` | Historique projets & rémunérations | RH |
| `/settings/profil` | Mon profil & mes spécialités | Collaborateur |

**Routes API documents :**

| Méthode | Route | Action | Rôle |
|---------|-------|--------|------|
| `GET` | `/api/collaborateurs/[id]/documents` | Liste des documents | RH |
| `POST` | `/api/collaborateurs/[id]/documents` | Upload un document | RH |
| `GET` | `/api/collaborateurs/[id]/documents/[docId]/url` | Générer signed URL (1h) | RH / Collaborateur (ses propres docs) |
| `DELETE` | `/api/collaborateurs/[id]/documents/[docId]` | Soft delete | RH |

---