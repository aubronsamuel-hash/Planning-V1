# 🎯 Dashboard du Chef de poste
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

## Dashboard du Chef de poste

### Philosophie

Le Chef de poste n'est **pas** un administrateur. Il ne planifie pas les spectacles. Il **exécute** : il remplit les trous dans son équipe, il chase les confirmations, et il s'assure que sa partie est prête le soir J.

Son dashboard est donc **orienté action**, pas information. Chaque élément affiché doit soit déclencher une action immédiate, soit rassurer ("tout est bon ici").

**Règle de conception :** Si l'information ne fait pas agir le chef de poste, elle n'a pas sa place sur son dashboard.

---

### 9.1 Vue d'ensemble du dashboard (`/mon-equipe`)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Bonjour David 👋   Mon équipe : 🔧 Technique — Peter Pan                   │
│  [Changer de projet ▾] si chef sur plusieurs projets                         │
├───────────────────────┬──────────────────────────┬───────────────────────────┤
│  ⚡ À FAIRE           │  📅 LES 14 PROCHAINS JOURS│  👥 MON ÉQUIPE (5 pers.) │
│  maintenant           │                           │                           │
│                       │                           │                           │
│  🔴 2 postes à        │  Sam 01/03 ─────────────  │  David R.   🔵 CDI       │
│  pourvoir             │  20h30 · Châtelet         │  ──────────────────────  │
│  01/03 Machiniste     │  🔴 Machiniste (2 manq.)  │  Alice M.   🟠 Inter.    │
│  [Affecter →]         │  ✅ Éclairagiste (2/2)    │  Bob K.     🟠 Inter.    │
│                       │  ✅ Régisseur son (1/1)   │  Carol L.   🟡 CDD       │
│  ⏳ 3 confirmations   │                           │  Eve P.     🟠 Inter.    │
│  en attente           │  Dim 02/03 ─────────────  │  ──────────────────────  │
│  Alice · Sam 14/03    │  15h00 · Châtelet         │  [+ Inviter un membre]   │
│  Bob · Sam 14/03      │  ✅ Tout pourvu            │                           │
│  Eve · Mar 17/03      │                           │  DISPONIBILITÉS           │
│  [Renvoyer liens →]   │  Mar 04/03 ─────────────  │  Alice : libre 09-13/03  │
│                       │  20h30 · Châtelet         │  Bob : occupé 07/03 ⚠️   │
│  ✅ 3 prochaines      │  🟡 Attente: Alice        │  Eve : libre toute pér.  │
│  représentations OK   │  🟡 Attente: Bob           │                           │
│                       │                           │                           │
│                       │  Sam 08/03 ─────────────  │                           │
│                       │  20h30 · Châtelet         │                           │
│                       │  🔴 Éclairagiste (1 manq.)│                           │
│                       │  ✅ Régisseur son (1/1)   │                           │
└───────────────────────┴──────────────────────────┴───────────────────────────┘
```

---

### 9.2 Panneau gauche — "À faire maintenant"

C'est **le cœur du dashboard**. Il est trié par urgence (date de la représentation la plus proche en haut).

**Types d'alertes, dans l'ordre de priorité :**

```
Priorité 1 — CRITIQUE (représentation dans ≤ 48h)
  🔴 Machiniste manquant — Auj. Sam 01/03 — 20h30
     Il reste 18h pour trouver quelqu'un.
     [ Affecter d'urgence → ]   ← poste non pourvu : affectation directe (pas le workflow §10)
     Suggestions : Frank D. (disponible) · Hugo T. (disponible)
     ⚠️ Si un collaborateur CONFIRMÉ a annulé sa participation, utiliser [ Remplacement urgent → ] (§10)

Priorité 2 — URGENT (représentation dans ≤ 7 jours)
  🟡 Éclairagiste manquant — Sam 08/03
     [ Affecter quelqu'un → ]

  ⏳ Alice n'a pas répondu — Sam 14/03
     Envoyé il y a 3 jours · Lien expiré dans 4 jours
     [ Renvoyer le lien ] [ Trouver quelqu'un d'autre ]

Priorité 3 — À PLANIFIER (représentation dans > 7 jours)
  📋 3 dates non pourvues — 21, 22, 28 mars
     [ Voir les trous → ]
```

**Comportement :**
- La liste se vide au fur et à mesure que les actions sont effectuées
- Si la liste est vide : `✅ Tout est en ordre pour les 14 prochains jours. Bien joué !`
- Les alertes "critiques" envoient aussi une notification email au chef de poste

---

### 9.3 Panneau central — Planning de l'équipe (14 jours glissants)

Vue compacte du planning des 14 prochains jours. **Identique à la grille du régisseur mais limitée à l'équipe du chef de poste.**

```
[Voir toutes les dates →]  [Filtrer : Trous uniquement 🔴]

Sam 01/03 · 20h30 · Théâtre du Châtelet
┌──────────────────┬────────────────────────────────────┐
│ Régisseur son(1) │ David R. 🔵 ✅                      │
│ Éclairagiste (2) │ Alice M. 🟠 ⏳  ·  Bob K. 🟠 ⏳     │
│ Machiniste   (2) │ [+] 🔴  ·  [+] 🔴                  │
└──────────────────┴────────────────────────────────────┘
Actions rapides : [ + Affecter en masse ] [ Exporter cette date ]

Dim 02/03 · 15h00 · Théâtre du Châtelet  ✅
┌──────────────────┬────────────────────────────────────┐
│ Régisseur son(1) │ David R. 🔵 ✅                      │
│ Éclairagiste (2) │ Alice M. 🟠 ✅  ·  Bob K. 🟠 ✅    │
│ Machiniste   (2) │ Carol L. 🟡 ✅  ·  Eve P. 🟠 ✅    │
└──────────────────┴────────────────────────────────────┘
```

**Interactions directes depuis ce panneau :**
- Clic sur `[+]` → affecter immédiatement (dropdown des membres disponibles)
- Clic sur `⏳` (en attente) → voir le statut du lien + option "Renvoyer"
- Clic sur un nom → fiche rapide du collaborateur

---

### 9.4 Panneau droit — Mon équipe

Vue synthétique des membres de l'équipe et de leur état sur les prochaines semaines.

```
👥 MON ÉQUIPE — Technique (5 membres)
[ + Inviter un membre dans cette équipe ]

Alice Martin    🟠 Intermittent
  Éclairagiste · 5 dates confirmées · 2 en attente
  Prochaine dispo libre : 09/03 → 13/03

Bob Kerr        🟠 Intermittent
  Éclairagiste · 4 dates confirmées · 2 en attente
  ⚠️ Conflit détecté le 07/03 (autre projet)

Carol Leroy     🟡 CDD
  Machiniste · 8 dates confirmées · 0 en attente
  ✅ Disponible sur toutes les dates du projet

Eve Petit       🟠 Intermittent
  Machiniste · 3 dates confirmées · 1 en attente
  Dernière réponse : il y a 2 heures

David Roux      🔵 CDI  ← soi-même
  Régisseur son · 12 dates planifiées
  (moi)
```

---

### 9.5 Actions rapides du Chef de poste

Ces actions sont disponibles en un clic depuis le dashboard :

| Action | Déclencheur | Effet |
|--------|-------------|-------|
| **Renvoyer tous les liens en attente** | Bouton dans panneau gauche | Renvoie un magic link frais à tous les intermittents qui n'ont pas répondu |
| **Affecter en série** | Bouton sur une date ou dans le panneau central | Ouvre le modal d'affectation multiple (comme le régisseur) |
| **Voir les trous uniquement** | Filtre dans le panneau central | Masque les représentations 100% pourvues |
| **Exporter mon planning équipe** | Bouton en haut du dashboard | Export CSV de l'état de son équipe sur le projet |
| **Affecter d'urgence** | Alerte critique (poste non pourvu) dans panneau gauche | Affectation directe via dropdown — **pas** le workflow §10. Le workflow §10 (remplacement urgent) n'est déclenché que lorsqu'un collaborateur CONFIRMÉ annule sa participation. |

---

### 9.6 Notifications du Chef de poste

Le chef de poste reçoit des notifications ciblées — **uniquement ce qui concerne son équipe** :

| Événement | Canal | Timing |
|-----------|-------|--------|
| Poste non pourvu dans mon équipe (J-7) | Email + In-app | 7 jours avant la représentation |
| Poste non pourvu dans mon équipe (J-2) | Email urgent | 2 jours avant |
| Intermittent a confirmé une date | In-app | Immédiat |
| Intermittent a refusé une date | Email + In-app | Immédiat |
| Intermittent n'a pas répondu sous 48h | Email + In-app | 48h après envoi |
| Représentation annulée (concerne mon équipe) | Email + In-app | Immédiat |
| Remplacement urgent à trouver (J-2 ou moins) | Email urgent | Immédiat |

---

### 9.7 Route dédiée : `/mon-equipe/[projetId]`

Quand un Chef de poste est responsable de plusieurs équipes sur plusieurs projets, un sélecteur apparaît en haut du dashboard. Chaque projet dispose d'une URL propre.

```
/mon-equipe                   → redirige vers le projet actif (le plus proche)
/mon-equipe/[projetId]        → dashboard équipe sur ce projet spécifique
/mon-equipe/[projetId]/grille → vue grille complète (toutes les dates du projet)
```

---