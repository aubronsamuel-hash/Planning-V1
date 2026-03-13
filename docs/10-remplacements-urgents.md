# ⚡ Gestion des remplacements urgents
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

## Gestion des remplacements urgents

### Problème

Un intermittent a confirmé une date, mais à J-2 (ou J-0 !), il annule. Il faut trouver un remplaçant **très vite**, sans perdre du temps à chercher manuellement dans l'annuaire.

Le système doit faire le travail de recherche et proposer les meilleurs candidats.

---

### 10.1 Déclencher un remplacement

```
[Régisseur ou Chef de poste — grille planning]
    → Clic sur une cellule occupée (ex: Alice M. ✅)
    → Panneau latéral s'ouvre :
        "Alice Martin — Éclairagiste — Sam 14/03 20h30"
        Statut : ✅ Confirmée

        ─────────────────────────────────────────
        [ ⚠️ Signaler une annulation tardive ]
        ─────────────────────────────────────────

    → Clic sur "Signaler une annulation tardive" :
        Raison (optionnelle) :
          ○ Maladie / force majeure
          ○ Indisponibilité de dernière minute
          ○ Autre
        [ Confirmer l'annulation ]

    → EFFET IMMÉDIAT :
        • Affectation d'Alice passe à : ANNULEE_TARDIVE
        • Cellule devient 🔴 dans la grille
        • Alerte critique envoyée au Régisseur ET au Chef de poste
        • Dashboard "Remplacements urgents" s'ouvre automatiquement
```

---

### 10.2 Moteur de suggestion de remplaçants

Le système analyse l'annuaire de l'organisation et propose des candidats par ordre de pertinence.

**Algorithme de suggestion :**

```
Score de pertinence d'un candidat :
  +4 pts  → A déjà travaillé sur CE projet (connaît le spectacle)
  +3 pts  → A déjà travaillé sur un projet similaire (même type)
  +2 pts  → A déjà été affecté à CE poste (Éclairagiste)
  +1 pt   → Type de contrat compatible (Intermittent préféré)
  -10 pts → A un conflit horaire sur cette date (éliminatoire)
  -5 pts  → N'a jamais répondu à des demandes précédentes (peu fiable)

→ Les 5 meilleurs candidats sont affichés
```

**Affichage des candidats :**

```
┌──────────────────────────────────────────────────────────┐
│  🔴 REMPLACEMENT URGENT — Sam 14/03 · 20h30             │
│  Poste : Éclairagiste · Peter Pan                        │
│                                                          │
│  Candidats suggérés :                                    │
│                                                          │
│  ⭐⭐⭐  Frank Denis  🟠  Disponible                     │
│            A fait Peter Pan en 2024 · Éclairagiste       │
│            Réponse hab. : < 2h                           │
│            [ Proposer le remplacement ]                  │
│                                                          │
│  ⭐⭐    Hugo Tran   🟠  Disponible                     │
│            Éclairagiste sur Garou Tournée               │
│            Jamais travaillé avec nous                    │
│            [ Proposer le remplacement ]                  │
│                                                          │
│  ⭐       Inès Morel 🟡  Disponible (CDD)               │
│            Machiniste habituellement                     │
│            [ Proposer le remplacement ]                  │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│  [ 🔍 Chercher dans tout l'annuaire ]                   │
└──────────────────────────────────────────────────────────┘
```

---

### 10.3 Proposer un remplacement

```
[Clic sur "Proposer le remplacement" — Frank Denis]
    → ActivityLog: REMPLACEMENT_PROPOSE (affectationAnnuleeId, candidatId, expiresAt)
    → Email de remplacement urgent envoyé à Frank :

      De : Théâtre du Nord <noreply@plateforme.fr>
      Objet : ⚡ Remplacement urgent — Peter Pan — Sam 14/03

      Bonjour Frank,

      Le Théâtre du Nord a besoin de vous en urgence :
      Peter Pan · Éclairagiste
      Sam 14 mars · 20h30 → 23h30
      Théâtre du Châtelet, Paris
      Cachet : 185,00 €

      [ ✅ Je suis disponible ]   [ ❌ Je ne suis pas disponible ]

      Ce lien est valable 4 heures.
      Contact direct : marc.dupont@theatredunord.fr · 06 12 34 56 78

    → Pendant ce temps, dans la grille :
      La cellule affiche : 🟡 Proposition envoyée à Frank D.

    → Si Frank accepte (dans les 4h) :
      → PropositionRemplacement.status = ACCEPTEE · respondedAt = now()
      → Affectation créée automatiquement :
          confirmationStatus = CONFIRMEE       ← acceptation explicite via lien
          remplaceDe = <id affectation annulée> ← traçabilité
          dpaeStatus = A_FAIRE si contractType = INTERMITTENT | CDD  ← ⚠️ Règle #3
          dpaeStatus = NON_REQUISE si contractType = CDI
      → ActivityLog: REMPLACEMENT_ACCEPTE (affectationAnnuleeId, candidatId)
      → Notification au régisseur et chef de poste
      → Cellule passe au vert ✅

    → Si Frank refuse :
      → PropositionRemplacement.status = REFUSEE · respondedAt = now()
      → ActivityLog: REMPLACEMENT_REFUSE (affectationAnnuleeId, candidatId)
      → Cellule repasse 🔴
      → Alerte : "Frank D. n'est pas disponible — essayez Hugo T. ?"
      → Le prochain candidat peut être contacté en un clic

    → Si Frank ne répond pas (4h écoulées) :
      → Le cron §21.4 (horaire) marque PropositionRemplacement.status = EXPIREE
      → ⚠️ L'expiration n'est pas temps-réel — délai max = durée jusqu'au prochain tour du cron
```

--- 

### 10.4 Suivi des remplacements

Un panneau dédié dans le dashboard (Régisseur et Chef de poste) liste tous les remplacements actifs :

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚡ REMPLACEMENTS EN COURS                                      │
├────────────────┬───────────────┬───────────────────┬────────────┤
│ Représentation │ Poste         │ Statut            │ Action     │
├────────────────┼───────────────┼───────────────────┼────────────┤
│ Sam 14/03      │ Éclairagiste  │ 🟡 Prop. Frank D. │ [Annuler]  │
│ 20h30          │               │   Expire dans 2h  │            │
├────────────────┼───────────────┼───────────────────┼────────────┤
│ Sam 21/03      │ Machiniste    │ 🔴 Personne trouvé│ [Chercher] │
│ 20h30          │               │   à ce stade      │            │
└────────────────┴───────────────┴───────────────────┴────────────┘
```

---

### 10.5 Mises à jour du modèle de données

**Champs Affectation impliqués :**

```
Affectation (voir 15-schema-prisma.md pour le modèle complet)
├── confirmationStatus: EN_ATTENTE | CONFIRMEE | REFUSEE | NON_REQUISE
│                       | ANNULEE            ← annulation simple (> 48h)
│                       | ANNULEE_TARDIVE    ← annulation tardive (≤ 48h) — déclenche ce workflow
├── annulationRaison: String?       ← raison optionnelle de l'annulation
├── annulationDate: DateTime?       ← quand l'annulation a été signalée
└── remplaceDe: String?             ← id de l'Affectation d'origine (traçabilité : "Frank remplace Alice")
```

**Notification utilisée :**

```
NotificationType.REMPLACEMENT_URGENT  ← envoi prioritaire (bypass les préférences notif.)
← déjà défini dans 15-schema-prisma.md
```

**Modèle PropositionRemplacement :**

```
PropositionRemplacement (voir 15-schema-prisma.md pour le modèle complet)
├── id
├── affectationAnnuleeId    ← l'affectation d'origine (ANNULEE_TARDIVE)
├── candidatId              ← Collaborateur.id du candidat contacté
├── propositionToken (UUID) ← lien magique d'acceptation/refus (4h)
├── status: EN_ATTENTE | ACCEPTEE | REFUSEE | EXPIREE
│   ← EXPIREE posé par le cron §21.4 (horaire) — pas en temps réel
├── proposedAt, expiresAt (4h), respondedAt
└── notes
```

---

### 10.6 Route dédiée

| Route | Page |
|-------|------|
| `/projets/[id]/remplacements` | Vue des remplacements actifs sur un projet |
| `/remplacement/[token]/repondre` | Page de réponse rapide pour le candidat (sans login) |

---

### 10.7 Règle métier — Traçabilité des remplacements

Quand un remplacement est effectué, la trace historique est conservée :
- L'affectation annulée reste en base avec statut `ANNULEE_TARDIVE`
- La nouvelle affectation a un champ `remplaceDe` pointant vers l'affectation d'origine
- Le RH peut voir, dans l'export CSV, les colonnes "Remplacé par" et "Remplace" pour la paie

---

*Document v7.0 — Annuaire · Templates · Dashboard Chef de poste · Remplacements urgents.*