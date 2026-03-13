# 🚀 Lancer et tester le SaaS Spectacle Vivant — Mac

> Guide pas-à-pas pour démarrer l'application en local et tester toutes les fonctionnalités de la Phase 1, 2 et 3.

---

## Prérequis

### 1. Node.js ≥ 18

```bash
node --version
```

Si tu n'as pas Node.js → installe via [https://nodejs.org](https://nodejs.org) (version LTS) ou avec `brew install node`.

### 2. Une base PostgreSQL

**Option recommandée : Railway (déjà utilisé en prod)**
- Va sur [railway.app](https://railway.app) → New Project → PostgreSQL
- Copie l'URL de connexion (`postgresql://...`) depuis l'onglet **Connect**

**Option locale avec Homebrew :**
```bash
brew install postgresql@16
brew services start postgresql@16
createdb spectacle_db
# DATABASE_URL = postgresql://localhost:5432/spectacle_db
```

---

## Installation

### Étape 1 — Copier le fichier d'environnement

```bash
cd "Application/app"
cp .env.example .env.local
```

### Étape 2 — Remplir `.env.local`

Ouvre le fichier et remplis **au minimum** ces variables :

```env
# OBLIGATOIRE
DATABASE_URL="postgresql://user:password@host:5432/spectacle_db?schema=public"
NEXTAUTH_SECRET="une-chaine-aleatoire-32-chars"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENCRYPTION_KEY="une-chaine-hex-64-chars"

# OPTIONNEL pour tester (les emails ne partiront pas sans Resend)
RESEND_API_KEY="re_fake_key_pour_tester"
RESEND_FROM_EMAIL="noreply@test.fr"
RESEND_FROM_NAME="Spectacle Vivant"

# OPTIONNEL (Stripe et S3 non requis pour tester le cœur métier)
# Laisse les valeurs d'exemple dans .env.example
```

**Générer les clés secrètes :**
```bash
# NEXTAUTH_SECRET (32 chars base64)
openssl rand -base64 32

# ENCRYPTION_KEY (64 chars hex)
openssl rand -hex 32
```

### Étape 3 — Installer les dépendances

```bash
cd "Application/app"
npm install
```

### Étape 4 — Initialiser la base de données

```bash
# Générer le client Prisma
npm run db:generate

# Appliquer les migrations (crée toutes les tables)
npm run db:migrate
# → Prisma te demandera un nom de migration, tape : init
```

### Étape 5 — Démarrer le serveur

```bash
npm run dev
```

Ouvre → **[http://localhost:3000](http://localhost:3000)**

---

## Créer les données de test

L'app n'a pas de seed automatique. Tout se crée via l'interface.

### Compte 1 — Admin / Directeur

1. Va sur `/signup`
2. Remplis : prénom, nom, email, mot de passe
3. À l'étape onboarding :
   - Crée une **organisation** (ex: "Théâtre du Soleil")
   - Choisis le rôle **DIRECTEUR**
4. Tu arrives sur `/dashboard`

### Compte 2 — RH (autre onglet / navigateur privé)

1. `/signup` → même organisation → rôle **RH**
2. Utile pour tester les données RH masquées (IBAN, N° SS)

### Compte 3 — Collaborateur (via invitation)

1. Depuis le compte DIRECTEUR, va sur `/equipe`
2. Clique **+ Inviter un collaborateur**
3. Remplis un email (réel ou fictif)
4. Si Resend n'est pas configuré → l'email ne part pas, mais le compte GHOST est créé
5. Pour simuler l'activation : va dans Prisma Studio (`npm run db:studio`), trouve le `MagicLinkToken` et copie le token pour construire l'URL : `http://localhost:3000/activate?token=XXX`

---

## Parcours de test — Phase par phase

### ✅ Phase 1 — Auth & Onboarding

| Page | URL | Ce qu'on teste |
|------|-----|----------------|
| Inscription | `/signup` | Création compte + organisation |
| Connexion | `/login` | Email + mot de passe |
| Dashboard | `/dashboard` | Métriques de base |

### ✅ Phase 2 — Cœur métier

#### Projets
1. `/projets` → **Nouveau projet**
   - Titre : "Peter Pan 2026"
   - Type : SPECTACLE, statut : EN_PREPARATION
2. Clique sur le projet → **Onglet Équipes**
   - Crée une équipe "Technique" avec une icône 🔧
   - Ajoute des postes : "Régisseur général" (requis: 1), "Son" (requis: 2)
3. **Onglet Planning**
   - Crée 3-4 représentations (dates futures)
   - Pour chaque représentation : clique sur un poste → affecte le collaborateur

#### Affectations & Confirmations
4. Connecté en tant que **Collaborateur** → `/mon-planning`
   - Vois les représentations du mois en cours
   - Badge "🟠 À confirmer" si en attente
5. `/affectation` → bouton Confirmer / Refuser pour chaque date

### ✅ Phase 3 — Features avancées

#### Équipe
| Action | Où |
|--------|----|
| Liste des membres | `/equipe` |
| Fiche collaborateur | `/equipe/[id]` (clique sur un membre) |
| Données RH (IBAN, N°SS) | Visible seulement si connecté en RH/DIRECTEUR |
| Inviter un collègue | `/equipe` → bouton + Inviter |

#### Mon Planning (vue collaborateur)
- Connexion en tant que collaborateur → `/mon-planning`
- Navigation mois ‹/›
- Vois : représentations à venir / passées, rémunération prévisionnelle

#### Mon Équipe (vue Chef de poste)
- Dans Prisma Studio, passe un `EquipeMembre` au rôle `CHEF` pour un user
- Connecté en tant que ce user → `/mon-equipe`
- Vois : alertes postes non pourvus, planning 14j, liste membres

#### Notifications
- `/notifications` — liste des notifications
- Badge rouge dans la sidebar (polling toutes les 30s)
- "Tout marquer lu" / marquer une notif individuelle

#### Templates
- `/templates` → **Nouveau template**
  - Sélectionne le projet "Peter Pan 2026" comme source
  - Nom : "Template Spectacle Standard"
  - Option "Inclure les horaires par défaut" ✓
- Applique ce template à un nouveau projet vide

---

## Commandes utiles

```bash
# Serveur de dev
npm run dev

# Explorer la base de données (interface graphique)
npm run db:studio
# → Ouvre http://localhost:5555

# Relancer les migrations après modif du schema.prisma
npm run db:migrate

# Build de production (pour tester les erreurs TypeScript)
npm run build
```

---

## En cas de problème

### Erreur Prisma "Table not found"
```bash
npm run db:migrate
```

### Erreur "NEXTAUTH_SECRET is not set"
Vérifie que `.env.local` existe bien dans `app/` (pas à la racine du projet).

### Page blanche / erreur 500
Ouvre la console du terminal où tourne `npm run dev` — l'erreur s'affiche là.

### Email non reçu
Normal sans Resend configuré. Pour tester les magic links, récupère le token directement via `npm run db:studio` dans la table `MagicLinkToken`.

### "Unauthorized" sur une API
Vérifier que tu es bien connecté (`/login`) et que l'organisation est active.

---

## Structure des dossiers (pour s'y retrouver)

```
Application/
├── app/                    # Tout le code Next.js
│   ├── app/
│   │   ├── (app)/          # Pages authentifiées
│   │   │   ├── dashboard/
│   │   │   ├── projets/
│   │   │   ├── equipe/
│   │   │   ├── mon-planning/
│   │   │   ├── mon-equipe/
│   │   │   ├── notifications/
│   │   │   └── templates/
│   │   ├── (public)/       # Login, Signup, etc.
│   │   └── api/            # Routes API
│   ├── prisma/
│   │   └── schema.prisma   # Modèle de données
│   └── .env.local          # Variables d'env (à créer)
└── docs/                   # Documentation métier
```

---

*Dernière mise à jour : 08/03/2026 — Phase 3 complète*
