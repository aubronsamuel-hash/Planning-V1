# 🚀 Onboarding
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

## Onboarding

---

### Concept

L'onboarding couvre deux flux distincts :

1. **Onboarding organisation** — une nouvelle structure (théâtre, compagnie, producteur) s'inscrit et configure son espace. C'est l'objet principal de cette section.
2. **Onboarding collaborateur** — un intermittent reçoit sa première invitation. Déjà couvert : workflow 5.4 (Lazy Auth) et UX §11.2 (premier contact).

**Principe directeur :** pas de tour guidé forcé, pas d'écrans vides sans CTA. La valeur doit être perceptible le plus tôt possible — idéalement avant même d'avoir invité le premier collaborateur.

---

### 14.1 Page d'inscription (`/signup`)

Point d'entrée pour toute nouvelle organisation.

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│          🎭  SaaS Spectacle Vivant                     │
│                                                        │
│   Créez votre espace de gestion                        │
│                                                        │
│   Prénom        [ _________________ ]                  │
│   Nom           [ _________________ ]                  │
│   Email pro     [ _________________ ]                  │
│                                                        │
│   Nom de votre structure                               │
│                [ _________________ ]                  │
│                                                        │
│   Type de structure                                    │
│                [ Théâtre           ▾]                  │
│    Théâtre · Compagnie de danse · Compagnie théâtrale  │
│    Producteur · Salle de concert · Festival · Autre    │
│                                                        │
│            [ Créer mon espace →  ]                     │
│                                                        │
│   Déjà un compte ?  Se connecter                       │
└────────────────────────────────────────────────────────┘
```

**Après soumission :**
- Compte `User` créé avec `role: MEMBER` (pas d'`accountStatus` sur `User` — voir `Collaborateur.accountStatus`)
- `Organization` créée avec le nom saisi, **`plan: PRO`**, **`trialEndsAt: now() + 14 jours`**
- `OrganizationMembership` créée avec `role: DIRECTEUR`
- Email de vérification envoyé (lien magic link, pas de mot de passe)
- Redirection vers le wizard de configuration

> **Trial 14j PRO :** activé automatiquement à la création de chaque organisation. Pas de carte bancaire requise. Géré 100% côté app via `Organization.trialEndsAt` — aucun client Stripe n'est créé à ce stade. Le cron `21.3` est le seul mécanisme d'expiration. `stripeCustomerId` reste `null` pendant toute la durée du trial.

> Pas de mot de passe à la création — cohérent avec Lazy Auth. Le Directeur reçoit un magic link pour se connecter. Il peut ajouter un mot de passe plus tard depuis `/settings`.

---

### 14.2 Wizard de configuration (3 étapes)

Affiché une seule fois, à la première connexion. Court — 3 étapes, toutes optionnelles sauf la première.

#### Étape 1 / 3 — Votre organisation

```
┌────────────────────────────────────────────────────────┐
│  🎭 Bienvenue ! Configurons votre espace.  (1/3)       │
│                                                        │
│  Nom de la structure   [ Théâtre du Nord      ]        │
│  Ville principale      [ Lille                ]        │
│  Logo                  [ + Ajouter un logo ]           │
│                  (optionnel — PNG/JPG, max 2 Mo)       │
│                                                        │
│                            [ Suivant → ]               │
└────────────────────────────────────────────────────────┘
```

#### Étape 2 / 3 — Votre premier projet

```
┌────────────────────────────────────────────────────────┐
│  Créez votre premier spectacle.            (2/3)       │
│                                                        │
│  Nom du spectacle    [ _______________________ ]       │
│  Type                [ Théâtre               ▾]        │
│  Date de début       [ __/__/____ ]                    │
│  Date de fin         [ __/__/____ ]   (optionnel)      │
│                                                        │
│  [ ← Retour ]                      [ Suivant → ]       │
│                  [ Passer cette étape ]                │
└────────────────────────────────────────────────────────┘
```

> Si l'étape est passée, le projet n'est pas créé. L'état vide du dashboard inclut un CTA pour le créer plus tard.

#### Étape 3 / 3 — Invitez votre équipe

```
┌────────────────────────────────────────────────────────┐
│  Qui travaille avec vous ?                 (3/3)       │
│                                                        │
│  Email         [ _________________________ ]           │
│  Rôle          [ Régisseur               ▾]            │
│                                                        │
│  [ + Ajouter une autre personne ]                      │
│                                                        │
│  Vous pouvez inviter jusqu'à 3 personnes ici.          │
│  D'autres pourront être invitées depuis /equipe.       │
│                                                        │
│  [ ← Retour ]                 [ Terminer ✓ ]           │
│                  [ Passer cette étape ]                │
└────────────────────────────────────────────────────────┘
```

> Les invitations envoyées ici créent des comptes GHOST avec un magic link d'activation. Même mécanique que les invitations depuis `/equipe`.

**Fin du wizard → redirection vers `/dashboard`** avec la checklist de démarrage visible.

---

### 14.3 Dashboard — Premier accès (état initial)

Le dashboard d'une organisation toute neuve n'est pas vide — il est orienté action.

```
┌──────────────┬──────────────────────────────────────────────────────┐
│              │  Bienvenue, Marc 👋 — Théâtre du Nord                │
│   SIDEBAR    ├──────────────────────────────────────────────────────┤
│              │  ✅ CHECKLIST DE DÉMARRAGE                  3/5      │
│ 🏠 Dashboard │  ████████░░░░  60%                                   │
│ 🎭 Projets   │                                                      │
│ 📅 Planning  │  ✅ Créer votre compte                               │
│ 👥 Équipe    │  ✅ Configurer votre organisation                    │
│ 💶 RH / Paie │  ✅ Créer votre premier spectacle                   │
│ ⚙️ Réglages  │  ⬜ Inviter un régisseur ou un RH       [Inviter →] │
│              │  ⬜ Créer votre première représentation  [Créer →]   │
│              │                                                      │
│              │  [ Masquer cette checklist ]                         │
├──────────────┴──────────────────────────────────────────────────────┤
│  PROCHAINES REPRÉSENTATIONS                                         │
│                                                                     │
│  Aucune représentation planifiée pour le moment.                    │
│  → Ouvrez Peter Pan et ajoutez vos premières dates.  [Aller →]     │
└─────────────────────────────────────────────────────────────────────┘
```

**Règles de la checklist :**
- Persiste sur le dashboard jusqu'à 100% ou jusqu'à ce que le Directeur clique "Masquer"
- Chaque item se coche automatiquement quand l'action est détectée (pas de bouton "Marquer comme fait")
- Les items non faits ont un bouton [Faire →] qui amène directement au bon endroit

---

### 14.4 États vides par page

Chaque page a un état vide utile — jamais une page blanche, toujours un CTA contextualisé.

**`/projets` — aucun projet :**
```
┌─────────────────────────────────────────────────────────────────┐
│  Projets                                                        │
│                                                                 │
│              🎭                                                  │
│     Votre premier spectacle vous attend.                        │
│                                                                 │
│     Créez un projet pour commencer à planifier                  │
│     vos équipes, gérer vos représentations                      │
│     et suivre votre paie en un seul endroit.                   │
│                                                                 │
│              [ + Créer un spectacle ]                           │
│                                                                 │
│     Vous avez déjà une équipe rodée ?                           │
│     → Importez la structure d'un projet existant après          │
│       avoir créé ce premier projet.                             │
└─────────────────────────────────────────────────────────────────┘
```

**`/projets/[id]/planning` — grille vide (aucune représentation) :**
```
┌─────────────────────────────────────────────────────────────────┐
│  Planning — Peter Pan                                           │
│                                                                 │
│  Aucune représentation sur ce projet.                           │
│                                                                 │
│  [ + Ajouter une représentation ]                              │
│  [ + Créer une série de dates   ]  ← plusieurs dates d'un coup │
└─────────────────────────────────────────────────────────────────┘
```

**`/equipe` — aucun collaborateur :**
```
┌─────────────────────────────────────────────────────────────────┐
│  Équipe — Théâtre du Nord                                       │
│                                                                 │
│  Invitez vos collaborateurs pour commencer à les affecter       │
│  à vos spectacles.                                              │
│                                                                 │
│  [ + Inviter un collaborateur ]                                 │
│                                                                 │
│  💡 Les intermittents n'ont pas besoin de créer un compte.      │
│     Ils reçoivent un lien et répondent directement.             │
└─────────────────────────────────────────────────────────────────┘
```

**`/rh/dpae` — aucune DPAE en attente :**
```
┌─────────────────────────────────────────────────────────────────┐
│  DPAE — Aucune déclaration en attente ✅                        │
│                                                                 │
│  Toutes vos DPAE sont à jour. Revenez ici                       │
│  quand de nouvelles affectations d'intermittents                │
│  ou de CDD sont créées.                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

### 14.5 Connexion — Utilisateur existant

Pas de formulaire login/password classique — tout passe par magic link.

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│          🎭  SaaS Spectacle Vivant                     │
│                                                        │
│   Connexion                                            │
│                                                        │
│   Email   [ ________________________________ ]         │
│                                                        │
│            [ Recevoir mon lien de connexion ]          │
│                                                        │
│   → Un email vous sera envoyé avec un lien             │
│     valable 15 minutes.                                │
│                                                        │
│   Pas encore de compte ? Créer un espace →             │
└────────────────────────────────────────────────────────┘
```

> Pour les utilisateurs qui ont activé un mot de passe depuis `/settings`, un lien discret "Se connecter avec mot de passe" apparaît en bas. Ce n'est pas le flux principal.

---

### 14.6 Checklist de démarrage — détail des 5 items

| # | Item | Condition de validation |
|---|------|------------------------|
| 1 | Créer votre compte | Automatiquement coché à la fin du wizard |
| 2 | Configurer votre organisation | `Organization.ville` remplie ET logo uploadé OU étape 1 wizard complétée |
| 3 | Créer votre premier spectacle | Au moins 1 `Projet` dans l'organisation |
| 4 | Inviter un régisseur ou un RH | Au moins 1 `OrganizationMembership` avec `role: REGISSEUR` ou `RH` |
| 5 | Créer votre première représentation | Au moins 1 `Representation` sur un projet |

---

### 14.7 Nouvelles routes

| Route | Page | Notes |
|-------|------|-------|
| `/signup` | Inscription nouvelle organisation | Public |
| `/login` | Connexion magic link | Public |
| `/login/verify` | Page d'attente après envoi du lien | Public |
| `/onboarding` | Wizard de configuration (3 étapes) | Post-signup, session requise |
| `/onboarding/organisation` | Étape 1 | Session requise |
| `/onboarding/premier-projet` | Étape 2 | Session requise |
| `/onboarding/equipe` | Étape 3 | Session requise |

> Après completion du wizard (ou passage de toutes les étapes), `Organization.onboardingCompletedAt` est rempli. Le wizard n'est plus accessible — `/onboarding` redirige vers `/dashboard`.

---

### 14.8 Nouveau champ modèle

```
Organization
└── onboardingCompletedAt: DateTime?   ← null tant que le wizard n'est pas terminé
    → Utilisé pour rediriger vers /onboarding au premier login
    → Rempli au clic "Terminer" ou après passage de toutes les étapes
```

---

### 14.9 Questions ouvertes

| # | Question | Impact |
|---|----------|--------|
| 1 | ~~**Période d'essai (trial)**~~ ✅ **Décidé** — trial 14j PRO gratuit à l'inscription, bannière J-3 avant expiration, dégradation FREE ou lecture seule selon quota. Voir `20-plans-tarifaires.md` + Décision #20. | — |
| 2 | **Onboarding guidé avancé** : vidéo d'intro, tooltips contextuels sur la grille au premier accès | Plus de dev, moins de friction |
| 3 | **Import depuis un tableur** : permettre d'importer un CSV de collaborateurs (nom, email, type) lors de l'onboarding | Réduit la friction pour les structures déjà organisées |
| 4 | **Checklist persistante** : faut-il la rendre visible sur mobile aussi, ou uniquement sur desktop ? | UX responsive |
