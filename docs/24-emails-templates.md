# 📧 Templates Email (Resend)
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale
>
> Catalogue exhaustif de tous les emails transactionnels envoyés par l'application. Chaque template est hébergé dans `emails/` (React Email) et envoyé via l'API Resend.

---

## 24.1 Structure technique

### Stack

- **Fournisseur** : [Resend](https://resend.com) — API REST + SDK TypeScript
- **Templating** : [React Email](https://react.email) — composants React rendus en HTML
- **Dossier** : `emails/` à la racine du projet (un fichier `.tsx` par template)
- **Service** : `lib/email.ts` — wrapper autour du SDK Resend

### lib/email.ts

```typescript
// lib/email.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const FROM_ADDRESS = 'noreply@staging.spectacle-saas.fr'  // staging
// production : 'notifications@spectacle-saas.fr' (domaine vérifié Resend)

export async function sendEmail<T extends object>({
  to,
  subject,
  template: Template,
  props,
}: {
  to: string
  subject: string
  template: React.ComponentType<T>
  props: T
}) {
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    react: <Template {...props} />,
  })
  if (error) {
    console.error('[sendEmail]', error)
    throw new Error(`Email send failed: ${error.message}`)
  }
  return data
}
```

### Nommage des fichiers

| Template | Fichier |
|----------|---------|
| Activation compte (GHOST → MEMBER) | `emails/activation.tsx` |
| Magic link connexion | `emails/magic-link-login.tsx` |
| Confirmation affectation | `emails/affectation-confirmation.tsx` |
| Refus affectation | `emails/affectation-refus.tsx` |
| Annulation affectation | `emails/affectation-annulation.tsx` |
| Remplacement urgent proposé | `emails/remplacement-urgent.tsx` |
| Feuille de route publiée | `emails/feuille-de-route.tsx` |
| Invitation membre organisation | `emails/invitation-membre.tsx` |
| Changement d'email (confirmation) | `emails/email-change-confirm.tsx` |
| Accès document (magic link) | `emails/document-access.tsx` |
| Accès planning (magic link) | `emails/planning-access.tsx` |
| Trial se termine bientôt | `emails/trial-ending.tsx` |
| Trial expiré | `emails/trial-expired.tsx` |
| Paiement échoué | `emails/payment-failed.tsx` |
| RGPD — avertissement anonymisation J-30 | `emails/rgpd-warning.tsx` |
| DPAE envoyée | `emails/dpae-envoyee.tsx` |

---

## 24.2 Emails d'authentification et gestion de compte

### 24.2.1 — Magic link connexion

**Fichier** : `emails/magic-link-login.tsx`
**Sujet** : `Votre lien de connexion`
**Déclencheur** : `POST /api/auth/magic-link` (demande de connexion sans mot de passe)
**Expiration du lien** : 15 minutes

| Variable | Type | Description |
|----------|------|-------------|
| `magicLinkUrl` | `string` | URL avec token : `/api/auth/verify?token=…&purpose=LOGIN` |
| `userFirstName` | `string` | Prénom de l'utilisateur |
| `expiresInMinutes` | `number` | Durée de validité (15) |

**Contenu** :
```
Bonjour {{userFirstName}},

Cliquez sur le lien ci-dessous pour vous connecter. Ce lien expire dans {{expiresInMinutes}} minutes.

[Se connecter →]  ({{magicLinkUrl}})

Si vous n'avez pas demandé ce lien, ignorez cet email.
```

---

### 24.2.2 — Activation compte (GHOST → MEMBER)

**Fichier** : `emails/activation.tsx`
**Sujet** : `{{organizationName}} vous invite sur Spectacle SaaS`
**Déclencheur** : §5.17 — premier email d'invitation d'un collaborateur GHOST
**Purpose MagicLinkToken** : `ACTIVATION` (7 jours)

| Variable | Type | Description |
|----------|------|-------------|
| `activationUrl` | `string` | URL avec token : `/activate?token=…` |
| `organizationName` | `string` | Nom de l'organisation invitante |
| `invitedByName` | `string` | Prénom + nom du DIRECTEUR ou REGISSEUR |
| `userFirstName` | `string` | Prénom du destinataire |
| `expiresInDays` | `number` | 7 |

**Contenu** :
```
Bonjour {{userFirstName}},

{{invitedByName}} vous invite à rejoindre {{organizationName}} sur Spectacle SaaS.

Activez votre compte en cliquant ci-dessous. Ce lien est valable {{expiresInDays}} jours.

[Activer mon compte →]

Une fois activé, vous pourrez consulter votre planning, confirmer vos affectations et accéder
à vos documents de travail.
```

---

### 24.2.3 — Changement d'email (confirmation)

**Fichier** : `emails/email-change-confirm.tsx`
**Sujet** : `Confirmez votre nouvelle adresse email`
**Déclencheur** : §5.16 — l'utilisateur soumet un `pendingEmail` depuis ses paramètres
**Purpose MagicLinkToken** : `EMAIL_CHANGE` (24 heures)
**Envoi vers** : la **nouvelle** adresse (pendingEmail)

| Variable | Type | Description |
|----------|------|-------------|
| `confirmUrl` | `string` | URL : `/api/auth/verify?token=…&purpose=EMAIL_CHANGE` |
| `newEmail` | `string` | Nouvelle adresse en attente de confirmation |
| `userFirstName` | `string` | Prénom |
| `expiresInHours` | `number` | 24 |

**Contenu** :
```
Bonjour {{userFirstName}},

Vous avez demandé à changer votre adresse email pour : {{newEmail}}

Confirmez ce changement en cliquant ci-dessous. Ce lien expire dans {{expiresInHours}} heures.

[Confirmer mon adresse →]

Si vous n'avez pas fait cette demande, votre ancienne adresse restera active.
```

---

### 24.2.4 — Invitation membre organisation

**Fichier** : `emails/invitation-membre.tsx`
**Sujet** : `Vous rejoignez {{organizationName}} sur Spectacle SaaS`
**Déclencheur** : DIRECTEUR ou REGISSEUR invite un nouveau MEMBER depuis `Settings > Équipe`
**Purpose MagicLinkToken** : `ACTIVATION` (7 jours) si nouvel utilisateur, sinon simple notification

| Variable | Type | Description |
|----------|------|-------------|
| `invitationUrl` | `string` | URL d'activation ou de connexion directe |
| `organizationName` | `string` | Nom de l'organisation |
| `invitedByName` | `string` | Nom de l'invitant |
| `roleLabel` | `string` | Libellé du rôle : "Régisseur", "RH", "Collaborateur" |
| `isNewUser` | `boolean` | `true` → lien d'activation ; `false` → lien de connexion |

---

## 24.3 Emails liés aux affectations

### 24.3.1 — Confirmation d'affectation demandée

**Fichier** : `emails/affectation-confirmation.tsx`
**Sujet** : `Confirmation demandée — {{representationTitre}} · {{representationDate}}`
**Déclencheur** : §5.7 ÉTAPE 4 — affectation créée (status `EN_ATTENTE` pour INTERMITTENTS)
**Purpose MagicLinkToken** : `CONFIRMATION` (7 jours)

| Variable | Type | Description |
|----------|------|-------------|
| `confirmUrl` | `string` | `/api/affectations/{{affectationId}}/confirmer?token=…` |
| `refuserUrl` | `string` | `/api/affectations/{{affectationId}}/refuser?token=…` |
| `collaborateurPrenom` | `string` | Prénom du destinataire |
| `projetTitre` | `string` | Titre du projet |
| `representationTitre` | `string` | Titre de la représentation |
| `representationDate` | `string` | Date formatée ex: "Samedi 15 mars 2025 à 20h00" |
| `representationLieu` | `string` | Lieu de la représentation |
| `posteLabel` | `string` | Intitulé du poste (ex: "Éclairagiste") |
| `expiresInDays` | `number` | 7 |

**Actions** : deux boutons CTA — [Confirmer ma présence] et [Je suis indisponible]

---

### 24.3.2 — Refus d'affectation (notification régisseur)

**Fichier** : `emails/affectation-refus.tsx`
**Sujet** : `{{collaborateurNom}} a refusé — {{posteLabel}} · {{representationDate}}`
**Déclencheur** : Collaborateur clique "Je suis indisponible" ou status passe à `REFUSEE`
**Destinataire** : REGISSEUR (ou DIRECTEUR) de l'organisation

| Variable | Type | Description |
|----------|------|-------------|
| `regisseurPrenom` | `string` | Prénom du régisseur |
| `collaborateurNomComplet` | `string` | Nom complet du collaborateur |
| `posteLabel` | `string` | Poste concerné |
| `representationTitre` | `string` | Titre de la représentation |
| `representationDate` | `string` | Date formatée |
| `planningUrl` | `string` | Lien vers le planning pour affecter un remplaçant |

---

### 24.3.3 — Annulation d'affectation

**Fichier** : `emails/affectation-annulation.tsx`
**Sujet** : `Affectation annulée — {{representationTitre}} · {{representationDate}}`
**Déclencheur** : §5.12 CAS A — régisseur annule une affectation confirmée
**Destinataire** : Collaborateur concerné

| Variable | Type | Description |
|----------|------|-------------|
| `collaborateurPrenom` | `string` | Prénom du destinataire |
| `representationTitre` | `string` | Titre de la représentation |
| `representationDate` | `string` | Date formatée |
| `posteLabel` | `string` | Poste concerné |
| `motifAnnulation` | `string \| null` | Motif saisi par le régisseur (optionnel) |
| `estTardive` | `boolean` | `true` → message spécifique sur l'annulation tardive |

---

### 24.3.4 — Remplacement urgent proposé

**Fichier** : `emails/remplacement-urgent.tsx`
**Sujet** : `Remplacement urgent — {{posteLabel}} · {{representationDate}}`
**Déclencheur** : §5.13 / §10 — workflow de remplacement urgent déclenché
**Token** : `PropositionRemplacement.propositionToken` (token maison — DM-7 session 22). Les `confirmUrl`/`refuserUrl` portent ce token, **pas un `MagicLinkToken`**.

| Variable | Type | Description |
|----------|------|-------------|
| `confirmUrl` | `string` | Lien d'acceptation rapide |
| `refuserUrl` | `string` | Lien de refus |
| `collaborateurPrenom` | `string` | Prénom du destinataire |
| `posteLabel` | `string` | Poste à pourvoir |
| `representationTitre` | `string` | Titre |
| `representationDate` | `string` | Date et heure (souvent imminente) |
| `representationLieu` | `string` | Lieu |
| `urgenceMessage` | `string` | Message personnalisé du régisseur |

**Ton** : email marqué urgent, délai de réponse court mis en évidence.

---

## 24.4 Emails liés aux représentations

### 24.4.1 — Feuille de route publiée

**Fichier** : `emails/feuille-de-route.tsx`
**Sujet** : `Feuille de route — {{representationTitre}} · {{representationDate}}`
**Déclencheur** : §11.x — REGISSEUR publie la feuille de route (`feuilleDeRoute.status → PUBLIEE`)
**Destinataires** : tous les collaborateurs affectés à la représentation (status `CONFIRMEE`)
**Purpose MagicLinkToken** : `PLANNING_VIEW` (7 jours) pour le lien d'accès

| Variable | Type | Description |
|----------|------|-------------|
| `planningUrl` | `string` | Lien magic-link vers la feuille de route (lecture seule) |
| `collaborateurPrenom` | `string` | Prénom du destinataire |
| `representationTitre` | `string` | Titre de la représentation |
| `representationDate` | `string` | Date et heure |
| `representationLieu` | `string` | Lieu |
| `posteLabel` | `string` | Poste du destinataire pour cette représentation |
| `heureConvocation` | `string \| null` | Heure de convocation spécifique au poste (si définie) |

---

### 24.4.2 — Annulation de représentation

**Fichier** : inclus dans `emails/affectation-annulation.tsx` (variante représentation)
**Sujet** : `Représentation annulée — {{representationTitre}} · {{representationDate}}`
**Déclencheur** : §12.x — annulation représentation (niveau 2)
**Destinataires** : tous les collaborateurs affectés

| Variable | Type | Description |
|----------|------|-------------|
| `collaborateurPrenom` | `string` | Prénom |
| `representationTitre` | `string` | Titre |
| `representationDate` | `string` | Date initiale |
| `isReporte` | `boolean` | `false` = annulé / `true` = reporté |
| `nouvelleDateStr` | `string \| null` | Si reporté : nouvelle date |

---

## 24.5 Emails liés à l'accès documents et planning

### 24.5.1 — Accès document (magic link)

**Fichier** : `emails/document-access.tsx`
**Sujet** : `Document disponible — {{documentNom}}`
**Déclencheur** : REGISSEUR ou RH partage un document avec un collaborateur
**Purpose MagicLinkToken** : `DOCUMENT_ACCESS` (1 heure)

| Variable | Type | Description |
|----------|------|-------------|
| `accessUrl` | `string` | URL magic-link vers le document |
| `collaborateurPrenom` | `string` | Prénom |
| `documentNom` | `string` | Nom du fichier |
| `documentType` | `string` | Ex: "Contrat", "Fiche RH" |
| `expiresInHours` | `number` | 1 |

---

### 24.5.2 — Accès planning (magic link)

**Fichier** : `emails/planning-access.tsx`
**Sujet** : `Votre planning — {{projetTitre}}`
**Déclencheur** : REGISSEUR partage le planning avec un collaborateur GHOST (non activé)
**Purpose MagicLinkToken** : `PLANNING_VIEW` (7 jours)

| Variable | Type | Description |
|----------|------|-------------|
| `planningUrl` | `string` | URL magic-link vers le planning (lecture seule) |
| `collaborateurPrenom` | `string` | Prénom |
| `projetTitre` | `string` | Titre du projet |
| `nbRepresentations` | `number` | Nombre de représentations dans le planning |

---

## 24.6 Emails liés aux plans tarifaires et Stripe

### 24.6.1 — Trial se termine bientôt

**Fichier** : `emails/trial-ending.tsx`
**Sujet** : `Votre période d'essai se termine dans {{daysLeft}} jours`
**Déclencheur** : Cron §21.x — J-7 et J-3 avant expiration du trial
**Destinataire** : DIRECTEUR de l'organisation
**ActivityLog** : `TRIAL_ENDING_SOON`

| Variable | Type | Description |
|----------|------|-------------|
| `directeurPrenom` | `string` | Prénom du DIRECTEUR |
| `organizationName` | `string` | Nom de l'organisation |
| `daysLeft` | `number` | Nombre de jours restants (7 ou 3) |
| `upgradeUrl` | `string` | Lien vers `/billing` pour choisir un plan |
| `trialEndDate` | `string` | Date de fin formatée |

---

### 24.6.2 — Trial expiré

**Fichier** : `emails/trial-expired.tsx`
**Sujet** : `Votre période d'essai a expiré — {{organizationName}}`
**Déclencheur** : Cron `§21.3 Étape 2` — seul mécanisme en v1 (trial 100% app-side, `stripeCustomerId IS NULL` pendant le trial → Stripe ne peut pas déclencher `trial_will_end`). Voir `18.7`.
**Destinataire** : DIRECTEUR
**ActivityLog** : `TRIAL_EXPIRED`

| Variable | Type | Description |
|----------|------|-------------|
| `directeurPrenom` | `string` | Prénom |
| `organizationName` | `string` | Nom de l'organisation |
| `upgradeUrl` | `string` | `/billing` |
| `featuresLost` | `string[]` | Liste des fonctionnalités désactivées |

**Note** : après expiration, `Organization.isReadOnly = true`. Les routes avec `write: true` retourneront `ORG_READ_ONLY`.

---

### 24.6.3 — Paiement échoué

**Fichier** : `emails/payment-failed.tsx`
**Sujet** : `Problème de paiement — action requise`
**Déclencheur** : Webhook Stripe `invoice.payment_failed`
**Destinataire** : DIRECTEUR
**ActivityLog** : `PAYMENT_FAILED`

| Variable | Type | Description |
|----------|------|-------------|
| `directeurPrenom` | `string` | Prénom |
| `organizationName` | `string` | Nom de l'organisation |
| `montant` | `string` | Ex: "49,00 €" |
| `portalUrl` | `string` | Lien vers le portail Stripe (`/api/billing/portal`) |
| `retryDate` | `string \| null` | Prochaine tentative Stripe (si disponible) |

---

## 24.7 Emails RGPD et conformité

### 24.7.1 — Avertissement anonymisation J-30

**Fichier** : `emails/rgpd-warning.tsx`
**Sujet** : `Votre compte sera supprimé dans 30 jours`
**Déclencheur** : Cron §21.5 — J-30 avant `anonymizeAt` pour les comptes inactifs
**Destinataire** : User concerné (GHOST ou MEMBER inactif depuis 2 ans)
**ActivityLog** : `RGPD_WARNING_SENT`

| Variable | Type | Description |
|----------|------|-------------|
| `userPrenom` | `string` | Prénom |
| `anonymizeDate` | `string` | Date d'anonymisation prévue |
| `reactivationUrl` | `string` | Lien pour maintenir le compte actif |

**Ton** : neutre, informatif. Ne pas alarmer inutilement. Proposer l'option de réactivation.

---

### 24.7.2 — DPAE envoyée (confirmation)

**Fichier** : `emails/dpae-envoyee.tsx`
**Sujet** : `DPAE envoyée — {{collaborateurNomComplet}}`
**Déclencheur** : RH ou REGISSEUR soumet une DPAE via le module intégré
**Destinataire** : RH de l'organisation (confirmation interne)

| Variable | Type | Description |
|----------|------|-------------|
| `rhPrenom` | `string` | Prénom du RH |
| `collaborateurNomComplet` | `string` | Nom complet du salarié |
| `dateDebut` | `string` | Date de début du contrat |
| `numeroDpae` | `string \| null` | Numéro de récépissé URSSAF (si disponible immédiatement) |

---

## 24.8 Règles transverses

### Sender et domaine

Tous les emails partent de l'adresse `FROM_ADDRESS` définie dans `lib/email.ts`. En staging, utiliser un sous-domaine dédié pour éviter de polluer la réputation du domaine principal.

### Gestion des erreurs d'envoi

Si `resend.emails.send()` échoue :
- Logger l'erreur (`console.error`)
- **Ne pas bloquer** la transaction métier (l'affectation est créée même si l'email échoue)
- Créer un `ActivityLog` avec `metadata: { emailError: true, reason: "..." }` pour les emails critiques (confirmation affectation, activation)
- Envisager une file de retry (Vercel Cron ou BullMQ) pour les cas critiques

### Internationalisation

Tous les templates sont en **français uniquement** pour la version actuelle. La variable `User.locale` est stockée en base pour une future internationalisation.

### Prévisualisation des templates

Utiliser le server de développement React Email :
```bash
npx react-email dev
# → http://localhost:3000 — prévisualisation live de tous les templates
```

### Variables globales disponibles dans tous les templates

Tous les templates peuvent importer le composant `EmailLayout` qui inclut :
- Logo Spectacle SaaS
- Footer avec lien de désabonnement (emails marketing uniquement)
- Lien "Contacter le support" : `support@spectacle-saas.fr`

```typescript
// emails/components/EmailLayout.tsx
export function EmailLayout({ children, preview }: { children: React.ReactNode, preview?: string }) {
  return (
    <Html>
      <Head />
      <Preview>{preview ?? 'Spectacle SaaS'}</Preview>
      <Body style={main}>
        <Container>
          <Img src="https://spectacle-saas.fr/logo.png" alt="Spectacle SaaS" width={120} />
          {children}
          <Hr />
          <Text style={footer}>
            Spectacle SaaS · <Link href="mailto:support@spectacle-saas.fr">Support</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```
