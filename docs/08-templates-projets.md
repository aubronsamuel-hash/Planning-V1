# 📁 Templates de projets
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

## Templates de projets

### Concept

Un template capture la **structure d'équipe** d'un projet réussi pour la réutiliser sur un nouveau projet. Il évite de recréer à la main les équipes, les postes et les collaborateurs habituels à chaque nouvelle production.

**Exemple concret :**
Le Théâtre du Nord monte "Peter Pan" chaque saison. La structure technique est toujours la même (3 équipes, 12 postes, 18 collaborateurs habituels). Avec un template "Structure Peter Pan", un nouveau projet reprend tout en 2 clics — il ne reste qu'à ajouter les dates.

---

### 8.1 Ce qu'un template contient

```
ProjetTemplate
├── Métadonnées : nom, description, type de projet, icône
├── Équipes (EquipeTemplate[])
│   ├── Nom, icône, couleur
│   └── PostesRequis (PosteRequisTemplate[])
│       ├── Nom du poste, nombre requis, type de contrat préféré
│       ├── defaultStartTime, defaultEndTime
│       └── CollaborateursHabituels[] ← optionnel
│           └── (collaborateurId + posteId → pré-assignation suggérée)
└── Source : créé de zéro OU dérivé d'un projet existant
```

**Deux niveaux de template :**

| Niveau | Contenu | Usage |
|--------|---------|-------|
| **Structure seule** | Équipes + Postes | Je sais quels postes créer, pas encore qui y mettre |
| **Équipe complète** | Équipes + Postes + Collaborateurs habituels | Mon équipe tourne ensemble — je veux la recréer vite |

---

### 8.2 Créer un template depuis un projet existant

```
[Régisseur — page d'un projet terminé ou en cours]
    → Menu "···" → "Sauvegarder comme template"
    → Modal :
        Nom du template : [Mon équipe Peter Pan        ]
        Description     : [Structure technique + salle ]
        Inclure :
          ☑ Les équipes et leurs postes
          ☑ Les collaborateurs habituels (pré-assignations suggérées)
          ☐ Les horaires par défaut des postes
        Visibilité : ● Mon organisation uniquement
    → [Sauvegarder]
        → Template créé et visible dans la bibliothèque
```

---

### 8.3 Appliquer un template à un nouveau projet

```
[Régisseur — création d'un nouveau projet]
    → Après avoir rempli le titre, type, dates...
    → Section "Équipe de départ" :
        [ Créer de zéro ]   [ Partir d'un template ]
    → Clic sur "Partir d'un template" :
        → Bibliothèque de templates s'ouvre :
          ┌─────────────────────────────────────────────┐
          │  Mes templates                               │
          │                                              │
          │  🎭 Structure comédie musicale               │
          │     3 équipes · 12 postes · 0 collabs        │
          │     Créé depuis: Peter Pan 2025              │
          │     [Prévisualiser]  [Utiliser]              │
          │                                              │
          │  🎤 Équipe concert complète                  │
          │     2 équipes · 8 postes · 15 collabs        │
          │     Créé depuis: Garou Tournée 2025          │
          │     [Prévisualiser]  [Utiliser]              │
          └─────────────────────────────────────────────┘
    → Clic "Utiliser" :
        → Prévisualisation des éléments à importer :
          ┌─────────────────────────────────────────────┐
          │  Sera importé :                              │
          │  ✅ Équipe Technique (Éclairagiste ×2,       │
          │      Machiniste ×2, Régisseur son ×1)        │
          │  ✅ Équipe Salle (Ouvreuse ×4, Sécu ×2)      │
          │  ✅ 15 collaborateurs suggérés               │
          │  ⚠️  3 collaborateurs inactifs (vérifier)   │
          └─────────────────────────────────────────────┘
        → [Confirmer l'import]
    → Projet créé avec la structure prête
    → Les affectations restent à faire (les dates sont nouvelles)
    → Les collaborateurs apparaissent en "Suggérés" dans la grille
```

---

### 8.4 Bibliothèque de templates (`/projets/templates`)

```
┌──────────────────────────────────────────────────────────────┐
│  Templates de projets                    [ + Nouveau template]│
│  🔍 Rechercher...   [Tous types ▾]                          │
├──────────────┬────────────┬──────────────┬───────────────────┤
│ Nom          │ Type       │ Équipes      │ Dernière utilisation│
├──────────────┼────────────┼──────────────┼───────────────────┤
│ 🎭 Structure │ Comédie    │ 3 éq. 12 p. │ Peter Pan 2026    │
│    comédie   │ musicale   │ 18 collabs   │ il y a 2 mois     │
├──────────────┼────────────┼──────────────┼───────────────────┤
│ 🎤 Concert   │ Concert    │ 2 éq. 8 p.  │ Garou Tournée     │
│    technique │            │ 15 collabs   │ il y a 5 mois     │
└──────────────┴────────────┴──────────────┴───────────────────┘
  Actions sur un template : [Modifier] [Dupliquer] [Supprimer]
```

---

### 8.5 Modèles de données — Templates

```
ProjetTemplate
├── id, name, description, icon
├── projetType: THEATRE | COMEDIE_MUSICALE | ... (optionnel, pour filtre)
├── organizationId
├── createdById (régisseur ou directeur)
├── sourceProjetId (optionnel — projet dont ce template est dérivé)
├── usageCount (combien de fois utilisé)
└── → EquipeTemplates[]

EquipeTemplate
├── id, name, icon, color
├── projetTemplateId
└── → PosteRequisTemplates[]

PosteRequisTemplate
├── id, name, requiredCount
├── isCritique: Boolean @default(false)  ← propagé depuis PosteRequis (Règle #33 — statut 🔴/🟡 planning global)
├── contractTypePreference: CDI | CDD | INTERMITTENT | INDIFFERENT
├── defaultStartTime, defaultEndTime
├── equipeTemplateId
└── → CollaborateursSuggeres[]

CollaborateurSuggere (pré-assignation suggérée dans un template)
├── id, posteRequisTemplateId, collaborateurId
└── (suggestion, pas une obligation — le régisseur peut ignorer)
```

---

### 8.6 Règles métier — Templates

- Un template appartient à une organisation — il n'est pas partagé entre organisations
- Modifier un template n'affecte pas les projets déjà créés à partir de ce template
- L'import d'un template ne crée pas les affectations — uniquement la structure (équipes + postes + collaborateurs suggérés)
- Si un collaborateur suggéré a quitté l'organisation, il est signalé en orange lors de l'import ⚠️
- Un Régisseur peut créer et gérer les templates — le Directeur aussi

---