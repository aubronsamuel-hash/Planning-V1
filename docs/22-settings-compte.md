# 👤 Paramètres du compte utilisateur
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

---

## Concept

La page `/settings` (ou `/settings/compte`) est accessible à **tous les utilisateurs** authentifiés (Directeur, Régisseur, RH, Chef de poste, Collaborateur). Elle leur permet de gérer leur identité personnelle, leur sécurité, et leurs préférences.

**À distinguer de `/settings/organisation`** (module 16) qui est réservé aux Directeurs pour configurer l'organisation elle-même.

---

## 22.1 Accès & Permissions

| Rôle | Accès |
|------|-------|
| Tous les rôles (y compris GHOST) | ✅ — chacun gère son propre compte uniquement |
| Un utilisateur ne peut JAMAIS modifier le compte d'un autre | — |

---

## 22.2 Structure de la page

Navigation interne par onglets (ou ancres) :

```
┌──────────────┬──────────────────────────────────────────────────────────────┐
│              │  Mon compte                                                  │
│   SIDEBAR    ├──────────────────────────────────────────────────────────────┤
│              │  ┌─────────────────────────────────────────────────────────┐ │
│  ⚙️ Réglages │  │  > Profil                                               │ │
│              │  │  > Sécurité                                              │ │
│   Mon compte │  │  > Préférences                                           │ │
│   Organisation│  │  > Intégrations calendrier                              │ │
│              │  └─────────────────────────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 22.3 Onglet Profil

**Route :** `/settings` ou `/settings/compte`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Profil                                                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Photo de profil                                                             │
│  ┌──────────────┐                                                            │
│  │              │   [ Changer la photo ]   Formats : JPG, PNG — max 2 Mo    │
│  │   [AVATAR]   │   [ Supprimer ]                                            │
│  │              │                                                            │
│  └──────────────┘                                                            │
│                                                                              │
│  Prénom *          [Marc                              ]                      │
│  Nom *             [Dupont                            ]                      │
│  Email *           [marc.dupont@theatredunord.fr      ]                      │
│                    ⚠️ Changer l'email enverra un lien de confirmation        │
│  Téléphone         [06 12 34 56 78                    ] (optionnel)          │
│                                                                              │
│                                              [ Enregistrer les modifications ]│
└──────────────────────────────────────────────────────────────────────────────┘
```

**Règles :**
- Le changement d'email nécessite une confirmation via un email envoyé à la nouvelle adresse
- L'ancien email reste actif jusqu'à la confirmation
- La photo est stockée sur S3 (`users/[user_id]/avatar.*`) — max 2 Mo, JPG/PNG
  - ⚠️ Pas de `org_id/` comme préfixe : l'avatar est une donnée cross-org (`User.avatarUrl` unique par utilisateur). Un utilisateur dans plusieurs organisations partage le même avatar.

---

## 22.4 Onglet Sécurité

**Route :** `/settings/securite`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Sécurité                                                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  MOT DE PASSE                                                                │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Mot de passe actuel  [••••••••••••              ]                           │
│  Nouveau mot de passe [                          ]                           │
│  Confirmer           [                          ]                           │
│                                  [ Changer le mot de passe ]                │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│  AUTHENTIFICATION À DEUX FACTEURS (2FA)          Statut : ⚪ Non activée    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Protégez votre compte avec une application d'authentification               │
│  (Google Authenticator, Authy…)                                              │
│                                            [ Activer la 2FA ] ← optionnel    │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│  SESSIONS ACTIVES                                                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Ce navigateur  •  Paris, France  •  Actif maintenant                       │
│  Safari / iPhone  •  Paris, France  •  Il y a 2 heures                      │
│                                          [ Déconnecter toutes les sessions ] │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Notes :**
- Les comptes **GHOST** (pas de mot de passe) voient uniquement la section 2FA et sessions — pas la section mot de passe
- La 2FA est optionnelle — TOTP (Google Authenticator / Authy) via NextAuth
- "Déconnecter toutes les sessions" invalide tous les tokens NextAuth du user

---

## 22.5 Onglet Préférences

**Route :** `/settings/preferences`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Préférences                                                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Langue                [ Français (fr) ▾ ]   (seule option disponible)       │
│                                                                              │
│  Fuseau horaire        [ Europe/Paris (UTC+1) ▾ ]                            │
│                        Utilisé pour l'affichage des horaires                 │
│                        et la génération du fichier iCal                      │
│                                                                              │
│  NOTIFICATIONS EMAIL                                                         │
│  ─────────────────────────────────────────────────────────────────────────  │
│  ☑  Nouvelle affectation                                                     │
│  ☑  Annulation d'une affectation                                             │
│  ☑  Rappel de représentation (24h avant)                                     │
│  ☐  Feuille de route publiée                                                 │
│  ☑  Résumé hebdomadaire (vendredi)                                           │
│                                                                              │
│                                              [ Enregistrer les préférences ] │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Notes :**
- La langue est fixée à `fr` (cf. Décision #7 — interface français uniquement)
- Le fuseau horaire affecte l'export iCal et l'affichage des dates — par défaut `Europe/Paris`
- Les préférences de notifications email s'appliquent uniquement aux emails optionnels (pas aux critiques comme les annulations)

---

## 22.6 Onglet Intégrations calendrier

**Route :** `/settings/ical`

Cette section est visible uniquement pour les **Collaborateurs** (et les utilisateurs qui ont des affectations).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Intégrations calendrier                                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LIEN D'ABONNEMENT iCal                                                      │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Synchronisez votre planning automatiquement avec Google Calendar,           │
│  Apple Calendar ou Outlook.                                                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  https://app.spectacle.fr/api/ical/[token-unique-sécurisé]          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  [ Copier le lien ]    [ Régénérer le lien ⚠️ ]                              │
│                                                                              │
│  ⚠️ Régénérer le lien invalide l'ancien — les abonnements existants          │
│     devront être reconfigurés dans votre application calendrier.             │
│                                                                              │
│  COMMENT UTILISER                                                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Google Calendar : Paramètres → Autres agendas → Via URL                    │
│  Apple Calendar  : Fichier → Nouvel abonnement de calendrier                 │
│  Outlook         : Ajouter un calendrier → Abonnement via Internet           │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Règles :**
- Le token iCal est unique par utilisateur (`User.icalToken`) — UUID généré à la première demande
- Le lien est accessible publiquement (pas de session requise) mais non devinable
- "Régénérer" efface `User.icalToken` et en génère un nouveau — l'ancien devient immédiatement invalide
- Seules les affectations `CONFIRMEE` et `NON_REQUISE` sont incluses dans le feed (cf. workflow §5.8)

---

## 22.7 Routes API

| Méthode | Route | Action | Auth |
|---------|-------|--------|------|
| `GET` | `/api/me` | Récupérer son profil | Session |
| `PATCH` | `/api/me` | Mettre à jour profil (nom, téléphone, photo) | Session |
| `POST` | `/api/me/change-email` | Demander changement email (envoie confirmation) | Session |
| `POST` | `/api/me/change-password` | Changer le mot de passe | Session |
| `PATCH` | `/api/me/preferences` | Sauvegarder préférences (timezone, notifs) | Session |
| `POST` | `/api/me/ical/regenerate` | Régénérer le token iCal | Session |
| `GET` | `/api/ical/[token]` | Feed iCal (public, protégé par token) | Token seul |
| `DELETE` | `/api/me/sessions` | Déconnecter toutes les sessions | Session |

---

## 22.8 Champs Prisma concernés

Sur le modèle `User` :

```prisma
// Tous ces champs sont présents dans 15-schema-prisma.md (modèle User) :
firstName         String
lastName          String
email             String   @unique
phone             String?
avatarUrl         String?
// ⚠️ PAS d'accountStatus sur User — c'est sur Collaborateur (GHOST/ACTIVE/INACTIF)
//    Les SUPER_ADMIN et staff sans Collaborateur ont toujours role: MEMBER
//    Détection "pas encore connecté" = OrganizationMembership.joinedAt IS NULL
timezone          String   @default("Europe/Paris")
icalToken         String?  @unique   // token public pour le feed iCal
emailPreferences  Json?              // {newAffectation: true, annulation: true, ...}
pendingEmail      String?            // nouvelle adresse email en attente de confirmation
```

> Voir schéma complet → `15-schema-prisma.md`
