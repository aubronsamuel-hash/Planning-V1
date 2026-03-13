# 🗃️ Schéma Prisma
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale
>
> Source de vérité technique — traduit directement depuis `05-data-models.md`.
> À copier dans `prisma/schema.prisma` pour générer les migrations.

---

## Notes d'implémentation

- **Heures** → toujours `String "HH:MM"` (heure locale). Jamais `DateTime` pour les créneaux.
- **Argent** → en **centimes** (`Int`). Ex : 15000 = 150,00 €.
- **Soft delete** → champs `deletedAt DateTime?` sur `Projet`, `Representation`, `Affectation`, `Document`. Toujours filtrer `WHERE deletedAt IS NULL` dans les requêtes courantes.
- **Données sensibles** → `socialSecurityNumber` et `iban` chiffrés AES-256 **avant** insertion (middleware app, pas Prisma).
- **Cross-minuit** → si `endTime < startTime` sur une Affectation → ajouter 24h côté calcul (règle #22).
- **Conflits planning** → détection cross-équipes et cross-projets, sur toutes les affectations actives d'un collaborateur (règle #20).
- **Tokens magic link** → un seul modèle `MagicLinkToken` pour tout. `Affectation` n'a **pas** de `confirmationToken` propre. Durées d'expiration par purpose : `LOGIN` 15 min · `DOCUMENT_ACCESS` 1h · `EMAIL_CHANGE` 24h · `CONFIRMATION`/`PLANNING_VIEW`/`ACTIVATION` 7 jours.
- **ActivityLog.action** → enum `ActivityLogAction` — ne jamais passer une String libre. Voir la liste exhaustive dans le schéma.
- **ActivityLog.userId** → nullable (`String?`) — `null` pour les actions sans auteur humain (crons, webhooks Stripe). Utiliser `userId: null` explicitement dans ces cas.

---

## Schéma

```prisma
// prisma/schema.prisma
// SaaS Gestion du Spectacle Vivant — v1.0

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

// Niveau 1 — Plateforme
enum UserRole {
  SUPER_ADMIN // accès back-office plateforme
  MEMBER      // tout utilisateur d'une organisation
}

enum AccountStatus {
  GHOST   // créé par le régisseur, pas de mdp, accès magic links uniquement
  ACTIVE  // l'intermittent a activé son compte avec un mot de passe
  INACTIF // désactivé manuellement par RH ou Directeur (conservation de l'historique)
  // ⚠️ User.role reste TOUJOURS MEMBER — c'est ce champ (sur Collaborateur) qui représente l'état réel
}

// Abonnement organisation — voir 20-plans-tarifaires.md
enum OrganizationPlan {
  FREE       // Découverte — 0€, 3 collabs max, 1 projet actif
  PRO        // Croissance — 49€, 20 collabs, DPAE + relances
  ENTERPRISE // Scale — 149€, illimité, module tournée
}

// Niveau 2 — Organisation
enum OrganizationRole {
  DIRECTEUR
  REGISSEUR
  RH
  COLLABORATEUR
  // ⚠️ CHEF_POSTE n'est PAS ici — c'est EquipeMembre.role: CHEF (niveau équipe)
}

// Niveau 3 — Équipe/Projet
enum EquipeRole {
  CHEF   // chef de poste sur cette équipe
  MEMBRE
}

enum ProjetType {
  THEATRE
  COMEDIE_MUSICALE
  CONCERT
  OPERA
  DANSE
  CIRQUE
  MAINTENANCE
  EVENEMENT
  AUTRE
}

enum ProjetStatus {
  EN_PREPARATION
  EN_COURS
  TERMINE
  ARCHIVE
  ANNULE
}

enum RepresentationType {
  REPRESENTATION
  REPETITION
  FILAGE
  GENERALE
  AVANT_PREMIERE
  INTERVENTION
  EVENEMENT
}

enum RepresentationStatus {
  PLANIFIEE
  CONFIRMEE
  ANNULEE
  REPORTEE // la date a été déplacée vers une nouvelle Representation
}

enum ContractType {
  CDI
  CDD
  INTERMITTENT
}

enum ContractTypePreference {
  CDI
  CDD
  INTERMITTENT
  INDIFFERENT
}

// Statut de confirmation d'une affectation
enum ConfirmationStatus {
  EN_ATTENTE      // en attente de réponse de l'intermittent
  CONFIRMEE       // l'intermittent a confirmé
  REFUSEE         // l'intermittent a refusé
  NON_REQUISE     // CDI et CDD — pas de confirmation requise
  ANNULEE         // annulation planifiée (> 48h avant la repré)
  ANNULEE_TARDIVE // annulation ou désistement tardif (≤ 48h) → déclenche Remplacement Urgent
}

// Décision sur le cachet en cas d'annulation
enum CachetAnnulation {
  A_DECIDER // le RH doit trancher
  DU        // cachet dû au collaborateur
  ANNULE    // cachet annulé
}

enum DpaeStatus {
  A_FAIRE
  ENVOYEE
  CONFIRMEE
  NON_REQUISE // CDI permanent — pas de DPAE
}

// Usage du magic link
enum MagicLinkPurpose {
  LOGIN           // connexion sans mot de passe (signup, reinvitation) — expire 15 min
  CONFIRMATION    // confirmer/refuser une affectation — expire 7 jours
  DOCUMENT_ACCESS // télécharger un document sécurisé — expire 1h
  PLANNING_VIEW   // consulter son planning en lecture seule — expire 7 jours
  ACTIVATION      // activer un compte fantôme GHOST → ACTIVE — expire 7 jours
  EMAIL_CHANGE    // confirmer un changement d'adresse email — expire 24h
}

// Types de notifications
enum NotificationType {
  AFFECTATION_CREEE
  AFFECTATION_MODIFIEE
  AFFECTATION_ANNULEE
  CONFIRMATION_REQUISE
  CONFIRMATION_RECUE
  CONFIRMATION_REFUSEE
  POSTE_NON_POURVU
  DPAE_A_FAIRE
  REPRESENTATION_ANNULEE
  REPRESENTATION_REPORTEE
  REMPLACEMENT_URGENT
  RAPPEL_CONFIRMATION
  PROJET_ANNULE
  FEUILLE_DE_ROUTE_PUBLIEE
  FEUILLE_DE_ROUTE_MODIFIEE
  RGPD_AVERTISSEMENT
}

// Priorité d'affichage d'une notification
enum NotificationPriority {
  CRITIQUE // REMPLACEMENT_URGENT, DPAE_A_FAIRE J-1 — fond rouge, remonte en tête
  URGENT   // POSTE_NON_POURVU, CONFIRMATION_REFUSEE, REPRESENTATION_ANNULEE
  INFO     // tout le reste — ordre chronologique
}

// NotificationChannel (IN_APP | EMAIL) → utilisé uniquement en logique applicative TypeScript,
// pas stocké par notification — le canal est déterminé à l'envoi, pas persisté en base.

enum DocumentEntityType {
  COLLABORATEUR
  PROJET
  AFFECTATION
}

// Rôle dans un projet (accès élargi, hors équipe)
enum ProjetMembreRole {
  REGISSEUR   // co-régisseur sur ce projet
  RH          // accès RH sur ce projet uniquement
  OBSERVATEUR
}

// Statut de la feuille de route
enum FeuilleDeRouteStatus {
  BROUILLON
  PUBLIEE
  ARCHIVEE
}

// Type de phase dans la journée (feuille de route)
enum PhaseType {
  DECHARGEMENT
  MONTAGE
  BALANCES
  CATERING
  ECHAUFFEMENT
  REPRESENTATION
  ENTRACTE
  DEMONTAGE
  PAUSE
  AUTRE
}

// Type de contact local (feuille de route)
enum ContactLocalType {
  VENUE
  CATERING
  SECURITE
  HOTEL
  URGENCE
  AUTRE
}

// Statut d'une proposition de remplacement urgent
enum PropositionStatus {
  EN_ATTENTE
  ACCEPTEE
  REFUSEE
  EXPIREE
}

// ─────────────────────────────────────────────────────────────────────────────
// MODELS
// ─────────────────────────────────────────────────────────────────────────────

model Organization {
  id               String           @id @default(cuid())
  name             String
  slug             String           @unique
  type             String?          // "théâtre", "compagnie", "producteur", "salle de concert"…
  logo             String?          // URL S3
  city             String?
  country          String           @default("FR")
  plan             OrganizationPlan @default(FREE)
  isReadOnly       Boolean          @default(false)  // true si trial expiré + quota dépassé
  billingEmail     String?
  stripeCustomerId String?          @unique
  onboardingCompletedAt DateTime?    // null tant que le wizard n'est pas terminé → redirige vers /onboarding
  suspendedAt      DateTime?        // null = actif · non-null = suspendu par SUPER_ADMIN
  suspendedReason  String?          // raison interne (non visible par le client)
  paymentFailedAt      DateTime?        // null = paiements OK · non-null = dernier échec Stripe
  trialEndsAt          DateTime?        // null si pas de trial actif
  trialReminderSentAt  DateTime?        // null = email J-3 pas encore envoyé (guard cron §21.3 — évite les doublons)
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt

  memberships OrganizationMembership[]
  projets     Projet[]
  templates   ProjetTemplate[]
}

model User {
  id            String        @id @default(cuid())
  firstName     String
  lastName      String
  email         String        @unique
  passwordHash  String?       // null si Collaborateur.accountStatus = GHOST
  avatarUrl     String?
  phone         String?
  role          UserRole      @default(MEMBER)
  // ⚠️ User.role vaut TOUJOURS MEMBER — l'état GHOST/ACTIVE/INACTIF est sur Collaborateur.accountStatus
  locale        String        @default("fr")           // interface français uniquement
  timezone      String        @default("Europe/Paris") // pour iCal et affichage horaires
  lastActiveAt  DateTime?     // pour RGPD : détection inactivité
  anonymizedAt   DateTime?    // date d'anonymisation RGPD (cron mensuel)
  rgpdWarningAt  DateTime?    // date du dernier email d'avertissement RGPD (évite les doublons)
  pendingEmail   String?      // nouvelle adresse email en attente de confirmation
  icalToken      String?      @unique  // token public pour feed iCal (révocable)
  emailPreferences Json?      // {newAffectation: true, annulation: true, rappel: true, ...}
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  memberships       OrganizationMembership[]
  collaborateur     Collaborateur?
  magicLinkTokens   MagicLinkToken[]
  notifications     Notification[]
  activityLogs      ActivityLog[]
  projetMembres     ProjetMembre[]
  equipeMembres     EquipeMembre[]
  documentsUploads  Document[]       @relation("UploadedBy")
  feuillesDeRoute   FeuilleDeRoute[] @relation("CreatedBy")
  templatesCreated  ProjetTemplate[] @relation("TemplateCreatedBy")
}

// Accès temporaire sans mot de passe — système unifié pour tous les cas
model MagicLinkToken {
  id        String           @id @default(cuid())
  token     String           @unique @default(uuid())
  userId    String
  purpose   MagicLinkPurpose
  expiresAt DateTime
  usedAt    DateTime?        // null = pas encore utilisé
  metadata  Json?            // ex: { "affectationId": "clx..." } pour contextualiser le lien
  createdAt DateTime         @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
}

// Niveau 2 : lien User ↔ Organization — source de vérité des rôles organisationnels
model OrganizationMembership {
  id             String           @id @default(cuid())
  userId         String
  organizationId String
  role           OrganizationRole
  joinedAt       DateTime?        // null = invitation envoyée mais pas encore acceptée (première connexion non effectuée)
  invitedById    String?          // userId de l'invitant

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, organizationId])
  @@index([organizationId])
}

// Profil étendu de User — données RH sensibles (séparées pour contrôle d'accès strict)
model Collaborateur {
  id                     String       @id @default(cuid())
  userId                 String       @unique
  contractType           ContractType // type "habituel" affiché dans l'annuaire
  // ⚠️ Le type réellement utilisé sur une affectation est Affectation.contractTypeUsed
  // (peut différer : un intermittent peut être en CDD sur un projet)

  // Données sensibles — chiffrées AES-256 par l'application avant insertion
  socialSecurityNumber   String?      // visible RH uniquement
  congesSpectaclesNumber String?      // N° Congés Spectacles (intermittents)
  iban                   String?      // visible RH uniquement

  // Statut du compte — lifecycle Lazy Auth
  // ⚠️ User.role reste TOUJOURS MEMBER — c'est CE champ qui représente l'état réel du compte
  accountStatus  AccountStatus @default(GHOST)
  ghostCreatedAt DateTime?     // date à laquelle le régisseur a saisi cet email dans le système
  activatedAt    DateTime?     // date à laquelle le collaborateur a défini son mot de passe

  anonymizedAt           DateTime?    // date d'anonymisation RGPD (null = actif)

  // Valeur par défaut pour les affectations (pré-remplie, modifiable par le régisseur)
  cachetHabituel         Int?         // en centimes — ex: 18500 = 185,00 €

  // Profil portable
  specialites        String[] @default([]) // ["Éclairagiste", "Son", "Machiniste"]
  yearsExperience    Int?
  availableForTour   Boolean  @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user                   User                      @relation(fields: [userId], references: [id], onDelete: Cascade)
  affectations           Affectation[]
  // ⚠️ Pas de relation Prisma `documents Document[]` ici — Document utilise un pattern polymorphique
  // (entityType = 'COLLABORATEUR' + entityId = collaborateur.id). Requêter via :
  // prisma.document.findMany({ where: { entityType: 'COLLABORATEUR', entityId: collaborateur.id } })
  propositionsRecues     PropositionRemplacement[] @relation("Candidat")
  collaborateursSuggeres CollaborateurSuggere[]

  @@index([accountStatus])  // cron RGPD + queries "tous les GHOST/INACTIF" fréquentes
}

model Projet {
  id             String       @id @default(cuid())
  title          String
  subtitle       String?
  posterUrl      String?      // URL S3
  type           ProjetType
  status         ProjetStatus @default(EN_PREPARATION)
  startDate      DateTime?
  endDate        DateTime?
  colorCode      String       @default("#6366F1")  // couleur hex — palette fixe 12 couleurs, choisie à la création
  organizationId String
  regisseurId    String       // userId du régisseur principal
  deletedAt      DateTime?    // soft delete
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  organization    Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  representations Representation[]
  equipes         Equipe[]
  postesRequis    PosteRequis[]
  membres         ProjetMembre[]
  templates       ProjetTemplate[] @relation("SourceProjet")

  @@index([organizationId])
  @@index([status])
}

model Representation {
  id       String @id @default(cuid())
  projetId String

  // Date seule, sans heure (ex: 2026-03-14)
  date DateTime @db.Date

  // Créneaux horaires — String "HH:MM" (heure locale)
  // ⚠️  Cross-minuit : si endTime < startTime → ajouter 24h au calcul (règle #22)
  getInTime     String? // "11:00" — null si pas de montage
  warmupTime    String? // "13:30" — null si pas de warmup
  showStartTime String? // "14:00" — null pour Maintenance
  showEndTime   String? // "15:30" — null pour Maintenance
  getOutTime    String? // "16:00" — null si pas de démontage
  // Maintenance : utiliser showStartTime/showEndTime comme plage d'intervention

  // Salle propre à chaque représentation (pas de salle fixe sur le projet)
  venueName    String?
  venueCity    String?
  venueAddress String?
  venueLatLng  String? // "lat,lng" — optionnel, pour carte

  type   RepresentationType
  status RepresentationStatus @default(PLANIFIEE)

  // Champs annulation / report (remplis si status = ANNULEE ou REPORTEE)
  annulationReason String?
  annulationAt     DateTime?
  reporteeVersId   String?   // → Representation (la nouvelle date si reportée)

  notes     String?
  deletedAt DateTime? // soft delete
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  projet         Projet           @relation(fields: [projetId], references: [id], onDelete: Cascade)
  affectations   Affectation[]
  feuilleDeRoute FeuilleDeRoute?
  reporteeVers   Representation?  @relation("Report", fields: [reporteeVersId], references: [id])
  reporteeDe     Representation[] @relation("Report")

  @@index([projetId])
  @@index([date])
}

// Membres avec accès élargi à un projet (hors équipe)
model ProjetMembre {
  id        String           @id @default(cuid())
  projetId  String
  userId    String
  role      ProjetMembreRole
  addedAt   DateTime         @default(now())
  addedById String?

  projet Projet @relation(fields: [projetId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projetId, userId])
}

// Sous-équipe d'un projet
model Equipe {
  id       String  @id @default(cuid())
  name     String
  icon     String?
  color    String?
  projetId String
  // ⚠️ Pas de chefId ici — le chef se retrouve via EquipeMembre.role: CHEF

  projet       Projet        @relation(fields: [projetId], references: [id], onDelete: Cascade)
  postesRequis PosteRequis[]
  membres      EquipeMembre[]

  @@index([projetId])
}

// Niveau 3 : appartenance d'un collaborateur à une équipe
model EquipeMembre {
  id       String     @id @default(cuid())
  equipeId String
  userId   String
  role     EquipeRole @default(MEMBRE)
  // CHEF = chef de poste sur cette équipe spécifique
  // Un COLLABORATEUR peut être CHEF ici sans changer son OrganizationMembership.role

  equipe Equipe @relation(fields: [equipeId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([equipeId, userId])
}

// Besoin en personnel par poste, sur l'ensemble du projet
model PosteRequis {
  id                     String                @id @default(cuid())
  name                   String                // ex: "Machiniste", "Régisseur son"
  requiredCount          Int                   @default(1)
  contractTypePreference ContractTypePreference @default(INDIFFERENT)
  isCritique             Boolean               @default(false)  // true = poste bloquant → 🔴 si non pourvu (Règle #33)
  equipeId               String
  projetId               String
  // Horaires par défaut → pré-remplis à la création d'une Affectation, modifiables
  defaultStartTime       String?               // "HH:MM"
  defaultEndTime         String?               // "HH:MM"
  createdAt              DateTime              @default(now())

  equipe       Equipe        @relation(fields: [equipeId], references: [id], onDelete: Cascade)
  projet       Projet        @relation(fields: [projetId], references: [id], onDelete: Cascade)
  affectations Affectation[]
}

// Collaborateur × Représentation × Poste
model Affectation {
  id               String       @id @default(cuid())
  collaborateurId  String
  representationId String
  posteRequisId    String
  contractTypeUsed ContractType // peut différer de Collaborateur.contractType

  // Horaires de présence (pré-remplis depuis PosteRequis.default*, modifiables)
  startTime String // "HH:MM"
  endTime   String // "HH:MM"
  // Si endTime < startTime → cross-minuit (règle #22)

  // Rémunération prévisionnelle en centimes (pas un bulletin de paie)
  // Intermittents : cachet forfaitaire saisi manuellement
  // CDI/CDD : taux horaire × durée (calculé automatiquement)
  remuneration Int?

  // Confirmation (intermittents uniquement — NON_REQUISE pour CDI/CDD)
  // ⚠️ Pas de confirmationToken ici — géré par MagicLinkToken (purpose: CONFIRMATION)
  confirmationStatus ConfirmationStatus @default(EN_ATTENTE)
  confirmedAt        DateTime?
  refusedAt          DateTime?
  annulationRaison   String?            // raison du désistement tardif (optionnel)
  annulationDate     DateTime?          // date du signalement

  // Heures contractuelles déclarées (intermittents & CDD — pour Pôle Emploi / Caisse des Congés)
  heuresContrat      Int?               // null pour les CDI (non applicable)

  // Cachet en cas d'annulation — rempli seulement si ANNULEE | ANNULEE_TARDIVE
  // Le RH tranche manuellement, l'app ne présuppose rien
  cachetAnnulation CachetAnnulation?

  // DPAE
  dpaeStatus DpaeStatus @default(A_FAIRE)
  dpaeDate   DateTime?

  // Détection de conflit — flag posé à la création si le collaborateur a un créneau chevauchant
  // Avertissement ⚠️ non bloquant (Règle #2) — l'affectation est créée même en cas de conflit
  hasConflict Boolean @default(false)

  // Relance automatique (cron §21.1 — une seule relance par affectation)
  relanceSentAt DateTime? // null = pas encore relancé · non-null = relance envoyée

  // Remplacement
  remplaceDe String? // id de l'Affectation d'origine si c'est un remplacement

  notes     String?
  deletedAt DateTime? // soft delete
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  collaborateur      Collaborateur           @relation(fields: [collaborateurId], references: [id])
  representation     Representation          @relation(fields: [representationId], references: [id], onDelete: Cascade)
  posteRequis        PosteRequis             @relation(fields: [posteRequisId], references: [id])
  affectationOrigine Affectation?            @relation("Remplacement", fields: [remplaceDe], references: [id])
  remplacements      Affectation[]           @relation("Remplacement")
  propositions       PropositionRemplacement[]

  @@index([collaborateurId])
  @@index([representationId])
  @@index([confirmationStatus])
  @@index([dpaeStatus])
}

model Notification {
  id             String               @id @default(cuid())
  userId         String
  organizationId String               // ⚠️ obligatoire — un user peut appartenir à N orgs
  type           NotificationType
  title          String               // texte court affiché en gras
  body           String               // message détaillé
  link           String?              // route vers la page concernée
  actionLabel    String?              // libellé du bouton d'action inline (ex: "Voir les candidats")
  read           Boolean              @default(false)
  readAt         DateTime?
  priority       NotificationPriority @default(INFO)
  groupId        String?              // UUID partagé entre notifs groupées (même type + projet + 30 min)
  archivedAt     DateTime?            // null jusqu'à 3 mois — archivage auto au-delà
  createdAt      DateTime             @default(now())

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([userId, organizationId, read])  // query principale : notifs d'un user dans son org courante
  @@index([userId, organizationId, priority])
  @@index([createdAt])
}

// Toutes les actions traçables de l'application — enum exhaustif
enum ActivityLogAction {
  // ── Affectations ─────────────────────────────────────────────
  AFFECTATION_CREATED        // régisseur affecte un collaborateur
  AFFECTATION_CONFIRMED      // intermittent confirme via magic link
  AFFECTATION_REFUSED        // intermittent refuse via magic link
  AFFECTATION_ANNULEE        // annulation planifiée (> 48h)
  AFFECTATION_ANNULEE_TARDIVE  // annulation tardive (≤ 48h)
  RELANCE_CONFIRMATION_ENVOYEE // cron §21.1 : relance auto après 48h sans réponse
  // ── Représentations ──────────────────────────────────────────
  REPRESENTATION_ANNULEE     // toute une représentation annulée
  REPRESENTATION_REPORTEE    // représentation déplacée sur une nouvelle date
  // ── Projets ──────────────────────────────────────────────────
  PROJET_CREATED
  PROJET_ANNULE              // projet abandonné (Directeur uniquement)
  PROJET_ARCHIVE             // fin normale du projet
  // ── Remplacement urgent ──────────────────────────────────────
  REMPLACEMENT_PROPOSE       // proposition envoyée à un candidat
  REMPLACEMENT_ACCEPTE       // candidat accepte le remplacement
  REMPLACEMENT_REFUSE        // candidat refuse ou proposition expirée
  // ── Feuille de route ─────────────────────────────────────────
  FEUILLE_DE_ROUTE_PUBLIEE
  FEUILLE_DE_ROUTE_MODIFIEE  // modification après publication (§11.6)
  FEUILLE_DE_ROUTE_ARCHIVEE
  // ── Module Tournée ────────────────────────────────────────────
  ROOMING_LIST_ENVOYEE       // rooming list envoyée à l'hôtel (§19.1.5)
  // ── Abonnement & facturation (Stripe) ────────────────────────
  PLAN_CHANGED               // upgrade ou downgrade du plan
  SUBSCRIPTION_CANCELLED     // résiliation de l'abonnement
  PAYMENT_FAILED             // paiement échoué
  PAYMENT_SUCCEEDED          // paiement réussi (renouvellement)
  INVOICE_FINALIZED          // facture émise par Stripe
  TRIAL_ENDING_SOON          // email J-3 trial envoyé
  TRIAL_EXPIRED              // trial expiré → dégradation plan
  STRIPE_CUSTOMER_CREATED    // stripeCustomerId attribué à l'org
  // ── Organisation & membres ───────────────────────────────────
  MEMBER_INVITED             // invitation envoyée (magic link)
  MEMBER_ROLE_CHANGED        // changement de rôle dans l'org
  MEMBER_REMOVED             // retrait d'un membre de l'org
  EMAIL_CHANGED              // changement d'adresse email confirmé (§5.16)
  ORG_SETTINGS_UPDATED       // paramètres organisation modifiés
  ORG_SUSPENDED              // suspension par SUPER_ADMIN
  ORG_UNSUSPENDED            // levée de suspension
  // ── RGPD ─────────────────────────────────────────────────────
  RGPD_WARNING_SENT          // email d'avertissement J-30 envoyé
  USER_ANONYMIZED            // anonymisation effective
  // ── Back-office SUPER_ADMIN ───────────────────────────────────
  ADMIN_PLAN_OVERRIDE        // SUPER_ADMIN change le plan manuellement
  ADMIN_IMPERSONATION        // SUPER_ADMIN se connecte en tant qu'un Directeur
}

// Constante à utiliser pour les actions sans utilisateur humain (crons, webhooks Stripe)
// const SYSTEM_ACTOR_ID = "SYSTEM"  →  userId = null dans ces cas-là

model ActivityLog {
  id         String            @id @default(cuid())
  action     ActivityLogAction // ← enum typé, plus de String libre
  entityType String            // ex: "Affectation", "Projet", "Organization"
  entityId   String
  metadata   Json?             // données contextuelles (stripeEventId, oldPlan, newPlan…)
  userId     String?           // null pour les actions système (cron, webhook Stripe)
  createdAt  DateTime          @default(now())

  // ⚠️ onDelete: SetNull obligatoire — sans ça Prisma défaut à NoAction (Restrict)
  // qui bloquerait la suppression d'un User ayant des logs (ex: anonymisation RGPD)
  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([entityType, entityId])
  @@index([userId])
  @@index([createdAt])
  @@index([action])
}

// Pièces jointes — stockées sur AWS S3, jamais en base
model Document {
  id           String             @id @default(cuid())
  filename     String
  s3Key        String             // chemin complet dans le bucket
  s3Bucket     String
  mimeType     String
  sizeBytes    Int
  entityType   DocumentEntityType
  entityId     String             // id du Collaborateur, Projet ou Affectation lié
  uploadedById String
  createdAt    DateTime           @default(now())
  deletedAt    DateTime?          // soft delete — null = actif · S3 conservé 30j

  uploadedBy User @relation("UploadedBy", fields: [uploadedById], references: [id])

  @@index([entityType, entityId])
}

// Template réutilisable de structure d'équipe
model ProjetTemplate {
  id             String      @id @default(cuid())
  name           String
  description    String?
  icon           String?
  projetType     ProjetType? // optionnel — pour filtrer les templates par type de projet
  organizationId String
  createdById    String
  sourceProjetId String?     // projet dont ce template est dérivé (optionnel)
  usageCount     Int         @default(0)
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  organization Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdBy    User            @relation("TemplateCreatedBy", fields: [createdById], references: [id])
  sourceProjet Projet?         @relation("SourceProjet", fields: [sourceProjetId], references: [id])
  equipes      EquipeTemplate[]
}

model EquipeTemplate {
  id               String @id @default(cuid())
  name             String
  icon             String?
  color            String?
  projetTemplateId String

  projetTemplate ProjetTemplate        @relation(fields: [projetTemplateId], references: [id], onDelete: Cascade)
  postes         PosteRequisTemplate[]
}

model PosteRequisTemplate {
  id                     String                @id @default(cuid())
  name                   String
  requiredCount          Int                   @default(1)
  isCritique             Boolean               @default(false)  // propagé depuis PosteRequis — Règle #33 (🔴 si non pourvu)
  contractTypePreference ContractTypePreference @default(INDIFFERENT)
  defaultStartTime       String?               // "HH:MM"
  defaultEndTime         String?               // "HH:MM"
  equipeTemplateId       String

  equipeTemplate         EquipeTemplate        @relation(fields: [equipeTemplateId], references: [id], onDelete: Cascade)
  collaborateursSuggeres CollaborateurSuggere[]
}

// Pré-assignation suggérée dans un template (non contraignante)
model CollaborateurSuggere {
  id                    String @id @default(cuid())
  posteRequisTemplateId String
  collaborateurId       String

  posteRequisTemplate PosteRequisTemplate @relation(fields: [posteRequisTemplateId], references: [id], onDelete: Cascade)
  collaborateur       Collaborateur       @relation(fields: [collaborateurId], references: [id], onDelete: Cascade)

  @@unique([posteRequisTemplateId, collaborateurId])
}

// Compagnon logistique d'une représentation (1:1)
model FeuilleDeRoute {
  id               String               @id @default(cuid())
  representationId String               @unique // relation 1:1
  statut           FeuilleDeRouteStatus @default(BROUILLON)
  notesGenerales   String?
  transportInfo    String?              // texte libre (N° train, heure RDV, contact chauffeur — flotte structurée: §19)
  publishedAt      DateTime?
  createdById      String
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  representation Representation @relation(fields: [representationId], references: [id], onDelete: Cascade)
  createdBy      User           @relation("CreatedBy", fields: [createdById], references: [id])
  phases         PhaseJournee[]
  contacts       ContactLocal[]
}

model PhaseJournee {
  id               String    @id @default(cuid())
  feuilleDeRouteId String
  ordre            Int       // ordre d'affichage dans la journée
  type             PhaseType
  labelCustom      String?   // surcharge le label du type si renseigné
  startTime        String    // "HH:MM"
  endTime          String?   // "HH:MM" — null si durée ouverte
  lieu             String?
  notes            String?

  feuilleDeRoute FeuilleDeRoute @relation(fields: [feuilleDeRouteId], references: [id], onDelete: Cascade)

  @@index([feuilleDeRouteId, ordre])
}

model ContactLocal {
  id               String           @id @default(cuid())
  feuilleDeRouteId String
  nom              String
  role             String           // ex: "Directeur technique", "Chef cuistot"
  type             ContactLocalType
  telephone        String?
  email            String?
  notes            String?

  feuilleDeRoute FeuilleDeRoute @relation(fields: [feuilleDeRouteId], references: [id], onDelete: Cascade)
}

// Suivi des propositions de remplacement urgent (workflow §10)
model PropositionRemplacement {
  id                   String            @id @default(cuid())
  affectationAnnuleeId String            // l'Affectation ANNULEE_TARDIVE d'origine
  candidatId           String            // collaborateur contacté
  propositionToken     String            @unique @default(uuid()) // magic link 4h
  status               PropositionStatus @default(EN_ATTENTE)
  proposedAt           DateTime          @default(now())
  expiresAt            DateTime          // +4h par défaut depuis proposedAt
  respondedAt          DateTime?
  notes                String?

  affectationAnnulee Affectation   @relation(fields: [affectationAnnuleeId], references: [id])
  candidat           Collaborateur @relation("Candidat", fields: [candidatId], references: [id])

  @@index([propositionToken])
  @@index([candidatId])
}

// ─────────────────────────────────────────────────────────────────────────────
// Module Tournée (§19 — 19-module-tournee.md)
// ─────────────────────────────────────────────────────────────────────────────
// Les modèles Hebergement, Chambre, ChambreOccupant, Vehicule, VehiculeAssignment, VehiculePassager
// sont définis dans 19-module-tournee.md et à ajouter ici lors de l'implémentation du Module Tournée.
//
// ⚠️ Aussi ajouter lors de cette migration (champs sur modèle existant) :
//   - Sur Collaborateur : preferenceChambre, regimeAlimentaire, allergies, permisConduire, permisCategorie
//   - Enums correspondants : PreferenceChambre, RegimeAlimentaire (voir §19 pour les valeurs)
//   - Relation : Vehicule.conducteurHabituelId → Collaborateur
//
// Voir §19 pour la spécification complète des modèles et leurs relations.
```

---

## Checklist migration initiale

Avant `prisma migrate dev --name init` :

- [ ] Variables d'environnement : `DATABASE_URL` configurée
- [ ] Extension PostgreSQL : activer `uuid-ossp` si besoin (sinon `@default(uuid())` utilise `gen_random_uuid()` natif PostgreSQL 13+)
- [ ] AWS KMS ou équivalent : clés de chiffrement AES-256 configurées (hors Prisma)
- [ ] Stripe : créer les produits/plans avant de tester `Organization.plan`

---

## Index recommandés supplémentaires (à ajouter selon la charge)

| Table | Index | Raison |
|-------|-------|--------|
| `Affectation` | `[representationId, collaborateurId]` | Détection de conflits planning |
| `Affectation` | `[collaborateurId, deletedAt]` | Planning collaborateur (filtre soft delete) |
| `Representation` | `[projetId, date, status]` | Grille planning projet |
| `MagicLinkToken` | `[expiresAt]` | Nettoyage cron des tokens expirés |
| `Notification` | `[userId, createdAt]` | Centre de notifs paginé |

---

*Schéma v1.0 — 03/03/2026 — synchronisé avec `05-data-models.md`*
