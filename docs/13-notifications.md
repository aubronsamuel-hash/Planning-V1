# 🔔 Notifications
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

## Notifications

---

### Concept

Le système de notifications est le fil d'information de l'app. Il n'existe pas pour envoyer des emails — ça, les workflows s'en chargent. Il existe pour s'assurer qu'**aucun événement important ne soit manqué** quand l'utilisateur est connecté, et pour lui donner des **actions rapides** sans avoir à naviguer.

**Deux canaux distincts :**
- `IN_APP` — notification visible dans l'interface, persistante, actionnable
- `EMAIL` — email envoyé (documenté dans les workflows 03, non redondant avec IN_APP)

Un même événement peut déclencher les deux (ex: une affectation annulée envoie un email ET crée une notif in-app). La spec ici couvre exclusivement le canal `IN_APP`.

---

### 13.1 Cloche dans la navbar

La cloche est présente dans la navbar pour tous les rôles. C'est le seul point d'entrée vers les notifications.

```
┌─────────────────────────────────────────────────────────────────┐
│  🎭 Spectacle Vivant   [Projets] [Planning] [Équipe] [RH]   🔔 5 │
└─────────────────────────────────────────────────────────────────┘
```

- **Badge rouge** affiché dès qu'il y a au moins 1 notification non lue
- **Nombre** affiché jusqu'à 99 — au-delà : `99+`
- Clic sur la cloche → ouvre le **dropdown** (panneau superposé)
- Le badge disparaît quand toutes les notifs du dropdown sont lues

---

### 13.2 Dropdown — Panneau rapide

Le dropdown affiche les **10 notifications les plus récentes**, non lues en priorité.

```
┌──────────────────────────────────────────────────────────┐
│  🔔 Notifications                    [Tout marquer lu]   │
├──────────────────────────────────────────────────────────┤
│  ● ⚡ REMPLACEMENT URGENT · il y a 5 min               │
│    Bob K. s'est désisté — Peter Pan · 14/03             │
│    Machiniste · 2 candidats disponibles                 │
│    [ Voir les candidats ]                               │
├──────────────────────────────────────────────────────────┤
│  ● ✅ Confirmation reçue · il y a 23 min                │
│    Alice M. a confirmé Peter Pan · 14/03 · 15/03 · 17/03│
├──────────────────────────────────────────────────────────┤
│  ● 🔴 DPAE à faire · il y a 1h                         │
│    Carol L. — nouvelle affectation Peter Pan · 01/03    │
│    [ Soumettre la DPAE ]                                │
├──────────────────────────────────────────────────────────┤
│    ❌ Représentation annulée · il y a 2h                │
│    Peter Pan · Samedi 08/03 annulée                     │
├──────────────────────────────────────────────────────────┤
│    📋 Feuille de route disponible · il y a 3h           │
│    Peter Pan · Vendredi 14/03                           │
│    [ Voir ]                                             │
├──────────────────────────────────────────────────────────┤
│              [ Voir toutes les notifications ]           │
└──────────────────────────────────────────────────────────┘
```

**Règles d'affichage :**
- Notifs **non lues** : fond légèrement coloré + point ● à gauche
- Notifs **lues** : fond neutre, pas de point
- Clic sur une notif → marque comme lue + navigue vers la page concernée
- [Tout marquer lu] → vide le badge, marque tout sans navigation
- [Voir toutes les notifications] → ouvre `/notifications`

---

### 13.3 Page complète (`/notifications`)

```
┌──────────────────────────────────────────────────────────────────┐
│  🔔 Notifications                                                 │
│  Filtrer : [Toutes ▾]  [Tous projets ▾]         [Tout marquer lu]│
├──────────────────────────────────────────────────────────────────┤
│  AUJOURD'HUI                                                      │
├──────────────────────────────────────────────────────────────────┤
│  ● ⚡ 09h12  REMPLACEMENT URGENT — Peter Pan · 14/03             │
│             Bob K. (Machiniste) s'est désisté                    │
│             2 candidats disponibles · expiration dans 3h42       │
│             [ Voir les candidats ]                               │
├──────────────────────────────────────────────────────────────────┤
│  ● ✅ 08h49  3 CONFIRMATIONS REÇUES — Peter Pan                  │
│             Alice M. · Carol L. · Eve P.                         │
│             Dates : 14/03 · 15/03 · 17/03                       │
│             [ Voir la grille ]                                    │
├──────────────────────────────────────────────────────────────────┤
│  ● 🔴 07h30  DPAE À FAIRE — Peter Pan · 01/03                   │
│             Carol L. — nouvelle affectation                      │
│             [ Soumettre la DPAE ]                                │
├──────────────────────────────────────────────────────────────────┤
│  HIER                                                             │
├──────────────────────────────────────────────────────────────────┤
│    🔔 18h00  Affectation créée — Peter Pan · 21/03               │
│             Frank D. — Agent sécurité                            │
├──────────────────────────────────────────────────────────────────┤
│    📋 16h30  Feuille de route disponible — Peter Pan · 20/03     │
│             [ Voir ]                                             │
└──────────────────────────────────────────────────────────────────┘
```

**Comportement :**
- Regroupée par jour (Aujourd'hui / Hier / date longue au-delà)
- Pagination infinie au scroll (pas de bouton "page suivante")
- Filtre par type et par projet (dropdowns)
- Rétention : **3 mois** — au-delà, archivage automatique (non visible mais conservé en base)

---

### 13.4 Catalogue des notifications

Qui reçoit quoi, sur quel canal, avec quelle action disponible.

| Type | Déclencheur | Destinataire | Canal | Action inline |
|------|-------------|:---:|:---:|--------------|
| `AFFECTATION_CREEE` | Régisseur affecte un collaborateur | Collaborateur | IN_APP + EMAIL | — |
| `AFFECTATION_MODIFIEE` | Horaire ou poste modifié | Collaborateur concerné | IN_APP + EMAIL | — |
| `AFFECTATION_ANNULEE` | Annulation d'une affectation | Collaborateur concerné | IN_APP + EMAIL | — |
| `CONFIRMATION_REQUISE` | Première invitation d'un intermittent | Collaborateur | EMAIL uniquement | *(lien dans email)* |
| `RAPPEL_CONFIRMATION` | 48h si toujours EN_ATTENTE | Collaborateur | EMAIL uniquement | *(lien dans email)* |
| `CONFIRMATION_RECUE` | Intermittent confirme | Régisseur + Chef de poste | IN_APP | [Voir la grille] |
| `CONFIRMATION_REFUSEE` | Intermittent refuse | Régisseur + Chef de poste | IN_APP + EMAIL | [Trouver un remplaçant] |
| `POSTE_NON_POURVU` | J-7 avec poste encore vide | Régisseur + Chef de poste | IN_APP + EMAIL | [Affecter] |
| `REMPLACEMENT_URGENT` | Annulation tardive (≤48h) | Régisseur + Chef de poste | IN_APP + EMAIL | [Voir les candidats] |
| `DPAE_A_FAIRE` | (1) Nouvelle affectation d'un intermittent/CDD · (2) Cron §21.2 J-1 si dpaeStatus encore `A_FAIRE \| ENVOYEE` — priorité `CRITIQUE` | RH | IN_APP + EMAIL | [Soumettre la DPAE] |
| `REPRESENTATION_ANNULEE` | Annulation d'une représentation | Tous les collaborateurs affectés | IN_APP + EMAIL | — |
| `REPRESENTATION_REPORTEE` | Report d'une représentation | Tous les collaborateurs affectés | IN_APP + EMAIL | [Reconfirmer] |
| `PROJET_ANNULE` | Annulation d'un projet | Régisseurs + Chefs + Collaborateurs affectés | IN_APP + EMAIL | — |
| `FEUILLE_DE_ROUTE_PUBLIEE` | Régisseur publie la FDR | Tous les collaborateurs affectés | IN_APP + EMAIL | [Voir] |
| `FEUILLE_DE_ROUTE_MODIFIEE` | Modification après publication | Tous les collaborateurs affectés | IN_APP | [Voir les changements] |
| `RGPD_AVERTISSEMENT` | 30j avant anonymisation automatique | Collaborateur concerné | EMAIL uniquement | *(lien activation compte)* |

> `EMAIL uniquement` = pas de notif in-app car l'utilisateur est potentiellement GHOST (pas de compte actif).

---

### 13.5 Règles de groupement

Pour éviter le bruit, certaines notifications similaires sont **groupées** automatiquement.

**Règle de groupement :** même type + même projet + intervalle de 30 minutes → 1 seule notif groupée.

```
Exemples :

❌ NON groupé (trop espacé ou projets différents) :
  08h00 — Alice M. confirme Peter Pan
  10h30 — Carol L. confirme Peter Pan
  → 2 notifs distinctes

✅ GROUPÉ (même projet, < 30 min) :
  08h49 — Alice M. confirme Peter Pan
  08h51 — Carol L. confirme Peter Pan
  08h53 — Eve P. confirme Peter Pan
  → 1 notif : "3 confirmations reçues pour Peter Pan — Alice M., Carol L., Eve P."
```

**Types jamais groupés** (urgence ou actions différentes) :
- `REMPLACEMENT_URGENT`
- `DPAE_A_FAIRE`
- `REPRESENTATION_ANNULEE`
- `PROJET_ANNULE`

---

### 13.6 Priorités et mise en avant

Les notifications sont classées par **niveau de priorité** dans le dropdown (pas seulement par date).

| Priorité | Types | Affichage |
|----------|-------|-----------|
| 🔴 CRITIQUE | `REMPLACEMENT_URGENT`, `DPAE_A_FAIRE` (J-1 ou moins) | En haut du dropdown, fond rouge pâle |
| 🟠 URGENT | `POSTE_NON_POURVU`, `CONFIRMATION_REFUSEE`, `REPRESENTATION_ANNULEE` | Prioritaire sur les info, fond orange pâle |
| ⚪ INFO | Tout le reste | Ordre chronologique |

Dans la page `/notifications`, les CRITIQUE et URGENT remontent toujours en tête de la liste "Aujourd'hui", même si elles ont été lues.

---

### 13.7 Modèle de données (complet)

```
Notification
├── id
├── userId          ← destinataire (toujours un User)
├── organizationId  ← org à laquelle appartient la notif (⚠️ obligatoire — un user peut être membre de N orgs)
├── type: AFFECTATION_CREEE | AFFECTATION_MODIFIEE | AFFECTATION_ANNULEE
│        | CONFIRMATION_REQUISE | RAPPEL_CONFIRMATION
│        | CONFIRMATION_RECUE | CONFIRMATION_REFUSEE
│        | POSTE_NON_POURVU | REMPLACEMENT_URGENT
│        | DPAE_A_FAIRE
│        | REPRESENTATION_ANNULEE | REPRESENTATION_REPORTEE | PROJET_ANNULE
│        | FEUILLE_DE_ROUTE_PUBLIEE | FEUILLE_DE_ROUTE_MODIFIEE
│        | RGPD_AVERTISSEMENT
├── title: String         ← texte court affiché en gras (ex: "Remplacement urgent")
├── body: String          ← message détaillé (ex: "Bob K. s'est désisté — Peter Pan · 14/03")
├── link: String?         ← route vers la page concernée (ex: "/projets/42/remplacements")
├── actionLabel: String?  ← libellé du bouton d'action inline (ex: "Voir les candidats")
├── read: Boolean         ← false par défaut
├── readAt: DateTime?
├── priority: CRITIQUE | URGENT | INFO   ← calculé à la création
├── groupId: String?      ← UUID partagé entre notifs groupées (nullable)
├── createdAt: DateTime
└── archivedAt: DateTime? ← null jusqu'à 3 mois après création
```

**Règle de génération :** les notifications sont créées côté serveur dans les actions (Server Actions Next.js 14) — jamais côté client. La mise à jour du badge en temps réel passe par SSE (même endpoint que la grille planning si l'utilisateur est connecté, sinon polling léger toutes les 30s).

---

### 13.8 Nouvelles routes

| Route | Page | Rôle minimum |
|-------|------|:---:|
| `/notifications` | Page complète des notifications | Tous |
| `/api/notifications` | Liste paginée (GET) + marquer lu (PATCH) | Session |
| `/api/notifications/read-all` | Marquer toutes comme lues (POST) | Session |
| `/api/notifications/unread-count` | Nombre de notifs non lues (GET) — réponse `{ count: number }` | Session |

> Les notifications s'intègrent dans le SSE existant (`/api/planning/[projetId]/stream`) — quand un utilisateur est sur une page projet, il reçoit ses nouvelles notifs via le stream déjà ouvert. Ailleurs, polling léger toutes les 30s sur `/api/notifications/unread-count` pour maintenir le badge.

---

### 13.9 Questions ouvertes

| # | Question | Impact |
|---|----------|--------|
| 1 | **Préférences de notification** : permettre à chaque utilisateur de désactiver certains types (ex: "Ne plus me notifier des FDR publiées") | Modèle `NotificationPreference` par user + type |
| 2 | **Push notifications mobiles** : si l'app devient PWA, les notifs système (hors navigateur) deviennent pertinentes | Service Worker + Web Push API |
| 3 | **Digest email** : au lieu de 10 emails séparés, un seul récap quotidien pour les notifs non urgentes | Cron + template email récap |
| 4 | **Notifs pour le SUPER_ADMIN** : alertes platform-level (org en trial qui expire, paiement échoué) | Types SUPER_ADMIN dédiés |
