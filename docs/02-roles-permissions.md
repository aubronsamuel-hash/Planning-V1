# 👥 Rôles & Permissions
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

## Utilisateurs & Rôles

### Vue d'ensemble — 6 rôles

```
Niveau Plateforme
└── Super Admin          (nous — gestion technique du SaaS)

Niveau Organisation
├── Directeur / Admin    (directeur de théâtre, producteur exécutif)
├── Régisseur            (régisseur général, directeur de production)
├── Chef de poste        (chef technique, chef de salle, resp. billetterie…)
├── RH / Admin paie      (responsable RH, gestionnaire de paie)
└── Collaborateur        (tout artiste ou technicien affecté à des représentations)
```

---

### 3.1 Super Admin *(niveau plateforme)*

**Qui c'est :** L'équipe qui gère le SaaS lui-même.

**Ce qu'il peut faire :**
- Accéder au back-office de la plateforme
- Créer, suspendre ou supprimer des organisations
- Voir les statistiques globales d'usage
- Gérer les plans et la facturation des clients
- Accéder aux logs système

**Accès :** Via `/admin` — interface totalement séparée.

---

### 3.2 Directeur / Admin *(niveau organisation)*

**Qui c'est :** Le directeur artistique, le producteur exécutif, ou le directeur général d'une structure.

**Ce qu'il peut faire :**
- Voir et gérer tous les projets de l'organisation
- Créer, modifier, archiver ou supprimer des projets
- Gérer les membres de l'organisation (inviter, retirer, changer les rôles)
- Accéder à tous les plannings et à toutes les affectations
- Voir la rémunération prévisionnelle globale
- Configurer l'organisation (nom, logo, paramètres)
- Accéder aux rapports complets

**Limite :** Ne peut pas éditer les bulletins de paie (périmètre RH).

---

### 3.3 Régisseur *(niveau projet)*

**Qui c'est :** Le régisseur général, le directeur de projet, le directeur technique.

**Ce qu'il peut faire :**
- Créer et gérer les projets qui lui sont assignés
- Créer, modifier et supprimer des représentations dans ses projets
- Définir les postes requis par représentation
- Affecter des collaborateurs aux représentations
- Voir les disponibilités des collaborateurs
- Consulter le planning global de ses projets
- Recevoir les alertes de conflit de planning ou de poste non pourvu

**Limite :** Ne peut pas modifier les informations contractuelles ni les rémunérations. Ne voit que ses projets.

---

### 3.4 Chef de poste *(niveau équipe — par projet)*

**Qui c'est :** Le responsable d'une équipe sur un projet donné : chef technique, chef de salle, responsable billetterie, directeur artistique adjoint…

**Ce qu'il peut faire :**
- Voir uniquement les représentations du projet auquel son équipe est rattachée
- Affecter les membres de **son équipe** aux représentations (sur les postes de son équipe)
- Voir les disponibilités et les conflits de planning de ses membres
- Voir la rémunération prévisionnelle de son équipe (pas des autres)
- Recevoir les alertes : poste non pourvu dans son équipe, membre en attente de confirmation
- Envoyer/renvoyer les liens de confirmation aux intermittents de son équipe

**Ce qu'il ne peut PAS faire :**
- Voir les autres équipes du projet
- Créer ou modifier des représentations
- Affecter des collaborateurs hors de son équipe
- Accéder aux informations RH (DPAE, contrats, numéro SS)

**Limite :** Son périmètre est strictement son équipe sur son projet. Sur un autre projet, il peut être simple collaborateur.

---

### 3.5 RH / Admin paie *(niveau organisation)*

**Qui c'est :** Le responsable RH, le gestionnaire de paie, l'administrateur de projet.

**Ce qu'il peut faire :**
- Accéder à toutes les affectations de tous les projets
- Voir et modifier les informations contractuelles des collaborateurs (type, rémunération)
- Suivre le statut des DPAE (à faire / envoyée / confirmée)
- Voir la rémunération prévisionnelle par collaborateur et par projet
- Gérer le fichier des collaborateurs (fiche, contrats, historique)
- Exporter les données pour transmission au logiciel de paie externe

**Limite :** Ne peut pas créer ni modifier des projets ou des représentations.

---

### 3.6 Collaborateur *(niveau individuel)*

**Qui c'est :** Tout artiste, technicien, ou personnel affecté à une ou plusieurs représentations.

**Ce qu'il voit :**
- **Son planning personnel** : toutes ses représentations à venir, avec date, heure, lieu, poste
- **Ses informations de rémunération** : cachet ou salaire prévu par représentation, total du mois
- **Ses contrats** : type de contrat (CDI / CDD / Intermittent), projet associé
- **Ses notifications** : nouvelle affectation, modification d'une date, annulation

**Ce qu'il ne peut PAS faire :**
- Voir les autres collaborateurs et leur rémunération
- Modifier ses affectations
- Accéder aux autres spectacles

---

## Matrice des permissions

> 📋 **Règles métier liées aux permissions** — Ce document définit QUI peut QUOI (matrice d'accès). Pour les règles détaillées qui gouvernent le comportement de ces permissions (ex : isolation chef de poste, périmètre strict, calcul cross-minuit), voir [`06-regles-decisions.md`](./06-regles-decisions.md) — notamment les règles #1, #7, #8, #18, #20, #21.

> **Architecture des rôles (3 niveaux) :**
> - `User.role: SUPER_ADMIN | MEMBER` → niveau plateforme
> - `OrganizationMembership.role: DIRECTEUR | REGISSEUR | RH | COLLABORATEUR` → niveau organisation
> - `EquipeMembre.role: CHEF | MEMBRE` → niveau équipe/projet (détermine l'accès Chef de poste)
>
> Un `COLLABORATEUR` dans une organisation peut être `CHEF` sur une équipe sans changer son rôle org.

| Action | Super Admin | Directeur | Régisseur | Chef de poste | RH | Collaborateur |
|--------|:-----------:|:---------:|:---------:|:-------------:|:--:|:-------------:|
| Back-office plateforme | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Gérer les organisations | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Inviter des membres (org) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Changer les rôles | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Créer un projet | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Voir tous les projets | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Voir ses projets assignés | ✅ | ✅ | ✅ | ✅ (son projet) | ✅ | ❌ |
| Modifier un projet | ✅ | ✅ | ✅ (le sien) | ❌ | ❌ | ❌ |
| Supprimer un projet | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Créer des représentations | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Modifier des représentations | ✅ | ✅ | ✅ (le sien) | ❌ | ❌ | ❌ |
| Affecter un collaborateur | ✅ | ✅ | ✅ | ✅ (son équipe) | ❌ | ❌ |
| Voir toutes les affectations | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Voir son planning personnel | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Voir la rémunération (tous) | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Voir la rémunération (équipe) | ✅ | ✅ | ✅ | ✅ (son équipe) | ✅ | ❌ |
| Voir sa propre rémunération | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Modifier les contrats / paie | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Suivre les DPAE | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Exporter les données paie | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Envoyer lien de confirmation | ✅ | ✅ | ✅ | ✅ (son équipe) | ❌ | ❌ |
| Voir les rapports complets | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Voir les rapports de prod. | ✅ | ✅ | ✅ | ✅ (son équipe) | ❌ | ❌ |
| Sauvegarder un template | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Appliquer un template | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

---

### 3.7 Implémentation — Contexte auth enrichi (Décision #22)

Le Chef de Poste est le seul rôle déterminé par `EquipeMembre` (niveau équipe) et non par `OrganizationMembership` (niveau org). Pour éviter deux requêtes DB à chaque appel API, le contexte complet est **pré-calculé une fois à la connexion** et stocké dans le JWT NextAuth.

**JWT enrichi (NextAuth `jwt` callback) :**

```typescript
// types/next-auth.d.ts
interface Session {
  user: {
    id: string
    orgRole: OrganizationRole        // DIRECTEUR | REGISSEUR | RH | COLLABORATEUR
    chefEquipes: string[]            // IDs des équipes où l'user est CHEF (peut être vide)
  }
}

// app/api/auth/[...nextauth]/route.ts — callback jwt
async jwt({ token, user }) {
  if (user) {
    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: user.id, organizationId: activeOrgId }
    })
    const chefEquipes = await prisma.equipeMembre.findMany({
      where: { userId: user.id, role: 'CHEF' },
      select: { equipeId: true }
    })
    token.orgRole = membership?.role ?? null
    token.chefEquipes = chefEquipes.map(e => e.equipeId)
  }
  return token
}
```

**Helper `lib/auth/getUserContext.ts` :**

```typescript
export function canAffecter(session: Session, equipeId?: string): boolean {
  const { orgRole, chefEquipes } = session.user
  if (['SUPER_ADMIN', 'DIRECTEUR', 'REGISSEUR'].includes(orgRole)) return true
  if (equipeId && chefEquipes.includes(equipeId)) return true
  return false
}

export function canVoirRH(session: Session): boolean {
  return ['SUPER_ADMIN', 'DIRECTEUR', 'RH'].includes(session.user.orgRole)
}

export function canVoirTousLesProjets(session: Session): boolean {
  return ['SUPER_ADMIN', 'DIRECTEUR', 'RH'].includes(session.user.orgRole)
}

export function isChefOn(session: Session, equipeId: string): boolean {
  return session.user.chefEquipes.includes(equipeId)
}
```

**Usage dans une route API :**

```typescript
// app/api/affectations/route.ts
const session = await getServerSession()
if (!canAffecter(session, equipeId)) return new Response('Forbidden', { status: 403 })
```

> **Note :** `chefEquipes` est scopé à l'organisation active (`activeOrgId` dans le cookie de session). Si l'utilisateur change d'organisation via le switcher (§11.3), le JWT est rafraîchi.

---