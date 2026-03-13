-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('GHOST', 'ACTIVE', 'INACTIF');

-- CreateEnum
CREATE TYPE "OrganizationPlan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('DIRECTEUR', 'REGISSEUR', 'RH', 'COLLABORATEUR');

-- CreateEnum
CREATE TYPE "EquipeRole" AS ENUM ('CHEF', 'MEMBRE');

-- CreateEnum
CREATE TYPE "ProjetType" AS ENUM ('THEATRE', 'COMEDIE_MUSICALE', 'CONCERT', 'OPERA', 'DANSE', 'CIRQUE', 'MAINTENANCE', 'EVENEMENT', 'AUTRE');

-- CreateEnum
CREATE TYPE "ProjetStatus" AS ENUM ('EN_PREPARATION', 'EN_COURS', 'TERMINE', 'ARCHIVE', 'ANNULE');

-- CreateEnum
CREATE TYPE "RepresentationType" AS ENUM ('REPRESENTATION', 'REPETITION', 'FILAGE', 'GENERALE', 'AVANT_PREMIERE', 'INTERVENTION', 'EVENEMENT');

-- CreateEnum
CREATE TYPE "RepresentationStatus" AS ENUM ('PLANIFIEE', 'CONFIRMEE', 'ANNULEE', 'REPORTEE');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('CDI', 'CDD', 'INTERMITTENT');

-- CreateEnum
CREATE TYPE "ContractTypePreference" AS ENUM ('CDI', 'CDD', 'INTERMITTENT', 'INDIFFERENT');

-- CreateEnum
CREATE TYPE "ConfirmationStatus" AS ENUM ('EN_ATTENTE', 'CONFIRMEE', 'REFUSEE', 'NON_REQUISE', 'ANNULEE', 'ANNULEE_TARDIVE');

-- CreateEnum
CREATE TYPE "CachetAnnulation" AS ENUM ('A_DECIDER', 'DU', 'ANNULE');

-- CreateEnum
CREATE TYPE "DpaeStatus" AS ENUM ('A_FAIRE', 'ENVOYEE', 'CONFIRMEE', 'NON_REQUISE');

-- CreateEnum
CREATE TYPE "MagicLinkPurpose" AS ENUM ('LOGIN', 'CONFIRMATION', 'DOCUMENT_ACCESS', 'PLANNING_VIEW', 'ACTIVATION', 'EMAIL_CHANGE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('AFFECTATION_CREEE', 'AFFECTATION_MODIFIEE', 'AFFECTATION_ANNULEE', 'CONFIRMATION_REQUISE', 'CONFIRMATION_RECUE', 'CONFIRMATION_REFUSEE', 'POSTE_NON_POURVU', 'DPAE_A_FAIRE', 'REPRESENTATION_ANNULEE', 'REPRESENTATION_REPORTEE', 'REMPLACEMENT_URGENT', 'RAPPEL_CONFIRMATION', 'PROJET_ANNULE', 'FEUILLE_DE_ROUTE_PUBLIEE', 'FEUILLE_DE_ROUTE_MODIFIEE', 'RGPD_AVERTISSEMENT');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('CRITIQUE', 'URGENT', 'INFO');

-- CreateEnum
CREATE TYPE "DocumentEntityType" AS ENUM ('COLLABORATEUR', 'PROJET', 'AFFECTATION');

-- CreateEnum
CREATE TYPE "ProjetMembreRole" AS ENUM ('REGISSEUR', 'RH', 'OBSERVATEUR');

-- CreateEnum
CREATE TYPE "FeuilleDeRouteStatus" AS ENUM ('BROUILLON', 'PUBLIEE', 'ARCHIVEE');

-- CreateEnum
CREATE TYPE "PhaseType" AS ENUM ('DECHARGEMENT', 'MONTAGE', 'BALANCES', 'CATERING', 'ECHAUFFEMENT', 'REPRESENTATION', 'ENTRACTE', 'DEMONTAGE', 'PAUSE', 'AUTRE');

-- CreateEnum
CREATE TYPE "ContactLocalType" AS ENUM ('VENUE', 'CATERING', 'SECURITE', 'HOTEL', 'URGENCE', 'AUTRE');

-- CreateEnum
CREATE TYPE "PropositionStatus" AS ENUM ('EN_ATTENTE', 'ACCEPTEE', 'REFUSEE', 'EXPIREE');

-- CreateEnum
CREATE TYPE "ActivityLogAction" AS ENUM ('AFFECTATION_CREATED', 'AFFECTATION_CONFIRMED', 'AFFECTATION_REFUSED', 'AFFECTATION_ANNULEE', 'AFFECTATION_ANNULEE_TARDIVE', 'RELANCE_CONFIRMATION_ENVOYEE', 'REPRESENTATION_ANNULEE', 'REPRESENTATION_REPORTEE', 'PROJET_CREATED', 'PROJET_ANNULE', 'PROJET_ARCHIVE', 'REMPLACEMENT_PROPOSE', 'REMPLACEMENT_ACCEPTE', 'REMPLACEMENT_REFUSE', 'FEUILLE_DE_ROUTE_PUBLIEE', 'FEUILLE_DE_ROUTE_MODIFIEE', 'FEUILLE_DE_ROUTE_ARCHIVEE', 'ROOMING_LIST_ENVOYEE', 'PLAN_CHANGED', 'SUBSCRIPTION_CANCELLED', 'PAYMENT_FAILED', 'PAYMENT_SUCCEEDED', 'INVOICE_FINALIZED', 'TRIAL_ENDING_SOON', 'TRIAL_EXPIRED', 'STRIPE_CUSTOMER_CREATED', 'MEMBER_INVITED', 'MEMBER_ROLE_CHANGED', 'MEMBER_REMOVED', 'EMAIL_CHANGED', 'ORG_SETTINGS_UPDATED', 'ORG_SUSPENDED', 'ORG_UNSUSPENDED', 'RGPD_WARNING_SENT', 'USER_ANONYMIZED', 'ADMIN_PLAN_OVERRIDE', 'ADMIN_IMPERSONATION');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT,
    "logo" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'FR',
    "plan" "OrganizationPlan" NOT NULL DEFAULT 'FREE',
    "isReadOnly" BOOLEAN NOT NULL DEFAULT false,
    "billingEmail" TEXT,
    "stripeCustomerId" TEXT,
    "onboardingCompletedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "paymentFailedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "trialReminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "avatarUrl" TEXT,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "lastActiveAt" TIMESTAMP(3),
    "anonymizedAt" TIMESTAMP(3),
    "rgpdWarningAt" TIMESTAMP(3),
    "pendingEmail" TEXT,
    "icalToken" TEXT,
    "emailPreferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagicLinkToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "MagicLinkPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "joinedAt" TIMESTAMP(3),
    "invitedById" TEXT,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collaborateur" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contractType" "ContractType" NOT NULL,
    "socialSecurityNumber" TEXT,
    "congesSpectaclesNumber" TEXT,
    "iban" TEXT,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'GHOST',
    "ghostCreatedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "anonymizedAt" TIMESTAMP(3),
    "cachetHabituel" INTEGER,
    "specialites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "yearsExperience" INTEGER,
    "availableForTour" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collaborateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Projet" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "posterUrl" TEXT,
    "type" "ProjetType" NOT NULL,
    "status" "ProjetStatus" NOT NULL DEFAULT 'EN_PREPARATION',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "colorCode" TEXT NOT NULL DEFAULT '#6366F1',
    "organizationId" TEXT NOT NULL,
    "regisseurId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Projet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Representation" (
    "id" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "getInTime" TEXT,
    "warmupTime" TEXT,
    "showStartTime" TEXT,
    "showEndTime" TEXT,
    "getOutTime" TEXT,
    "venueName" TEXT,
    "venueCity" TEXT,
    "venueAddress" TEXT,
    "venueLatLng" TEXT,
    "type" "RepresentationType" NOT NULL,
    "status" "RepresentationStatus" NOT NULL DEFAULT 'PLANIFIEE',
    "annulationReason" TEXT,
    "annulationAt" TIMESTAMP(3),
    "reporteeVersId" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Representation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjetMembre" (
    "id" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjetMembreRole" NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedById" TEXT,

    CONSTRAINT "ProjetMembre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "projetId" TEXT NOT NULL,

    CONSTRAINT "Equipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipeMembre" (
    "id" TEXT NOT NULL,
    "equipeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "EquipeRole" NOT NULL DEFAULT 'MEMBRE',

    CONSTRAINT "EquipeMembre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosteRequis" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 1,
    "contractTypePreference" "ContractTypePreference" NOT NULL DEFAULT 'INDIFFERENT',
    "isCritique" BOOLEAN NOT NULL DEFAULT false,
    "equipeId" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "defaultStartTime" TEXT,
    "defaultEndTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosteRequis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affectation" (
    "id" TEXT NOT NULL,
    "collaborateurId" TEXT NOT NULL,
    "representationId" TEXT NOT NULL,
    "posteRequisId" TEXT NOT NULL,
    "contractTypeUsed" "ContractType" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "remuneration" INTEGER,
    "confirmationStatus" "ConfirmationStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "confirmedAt" TIMESTAMP(3),
    "refusedAt" TIMESTAMP(3),
    "annulationRaison" TEXT,
    "annulationDate" TIMESTAMP(3),
    "heuresContrat" INTEGER,
    "cachetAnnulation" "CachetAnnulation",
    "dpaeStatus" "DpaeStatus" NOT NULL DEFAULT 'A_FAIRE',
    "dpaeDate" TIMESTAMP(3),
    "hasConflict" BOOLEAN NOT NULL DEFAULT false,
    "relanceSentAt" TIMESTAMP(3),
    "remplaceDe" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Affectation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "actionLabel" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "priority" "NotificationPriority" NOT NULL DEFAULT 'INFO',
    "groupId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "action" "ActivityLogAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "s3Bucket" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "entityType" "DocumentEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjetTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "projetType" "ProjetType",
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "sourceProjetId" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjetTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipeTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "projetTemplateId" TEXT NOT NULL,

    CONSTRAINT "EquipeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosteRequisTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 1,
    "isCritique" BOOLEAN NOT NULL DEFAULT false,
    "contractTypePreference" "ContractTypePreference" NOT NULL DEFAULT 'INDIFFERENT',
    "defaultStartTime" TEXT,
    "defaultEndTime" TEXT,
    "equipeTemplateId" TEXT NOT NULL,

    CONSTRAINT "PosteRequisTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborateurSuggere" (
    "id" TEXT NOT NULL,
    "posteRequisTemplateId" TEXT NOT NULL,
    "collaborateurId" TEXT NOT NULL,

    CONSTRAINT "CollaborateurSuggere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeuilleDeRoute" (
    "id" TEXT NOT NULL,
    "representationId" TEXT NOT NULL,
    "statut" "FeuilleDeRouteStatus" NOT NULL DEFAULT 'BROUILLON',
    "notesGenerales" TEXT,
    "transportInfo" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeuilleDeRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseJournee" (
    "id" TEXT NOT NULL,
    "feuilleDeRouteId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "type" "PhaseType" NOT NULL,
    "labelCustom" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT,
    "lieu" TEXT,
    "notes" TEXT,

    CONSTRAINT "PhaseJournee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactLocal" (
    "id" TEXT NOT NULL,
    "feuilleDeRouteId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "type" "ContactLocalType" NOT NULL,
    "telephone" TEXT,
    "email" TEXT,
    "notes" TEXT,

    CONSTRAINT "ContactLocal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropositionRemplacement" (
    "id" TEXT NOT NULL,
    "affectationAnnuleeId" TEXT NOT NULL,
    "candidatId" TEXT NOT NULL,
    "propositionToken" TEXT NOT NULL,
    "status" "PropositionStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "PropositionRemplacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_icalToken_key" ON "User"("icalToken");

-- CreateIndex
CREATE UNIQUE INDEX "MagicLinkToken_token_key" ON "MagicLinkToken"("token");

-- CreateIndex
CREATE INDEX "MagicLinkToken_token_idx" ON "MagicLinkToken"("token");

-- CreateIndex
CREATE INDEX "MagicLinkToken_userId_idx" ON "MagicLinkToken"("userId");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_idx" ON "OrganizationMembership"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_key" ON "OrganizationMembership"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Collaborateur_userId_key" ON "Collaborateur"("userId");

-- CreateIndex
CREATE INDEX "Collaborateur_accountStatus_idx" ON "Collaborateur"("accountStatus");

-- CreateIndex
CREATE INDEX "Projet_organizationId_idx" ON "Projet"("organizationId");

-- CreateIndex
CREATE INDEX "Projet_status_idx" ON "Projet"("status");

-- CreateIndex
CREATE INDEX "Representation_projetId_idx" ON "Representation"("projetId");

-- CreateIndex
CREATE INDEX "Representation_date_idx" ON "Representation"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ProjetMembre_projetId_userId_key" ON "ProjetMembre"("projetId", "userId");

-- CreateIndex
CREATE INDEX "Equipe_projetId_idx" ON "Equipe"("projetId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipeMembre_equipeId_userId_key" ON "EquipeMembre"("equipeId", "userId");

-- CreateIndex
CREATE INDEX "Affectation_collaborateurId_idx" ON "Affectation"("collaborateurId");

-- CreateIndex
CREATE INDEX "Affectation_representationId_idx" ON "Affectation"("representationId");

-- CreateIndex
CREATE INDEX "Affectation_confirmationStatus_idx" ON "Affectation"("confirmationStatus");

-- CreateIndex
CREATE INDEX "Affectation_dpaeStatus_idx" ON "Affectation"("dpaeStatus");

-- CreateIndex
CREATE INDEX "Notification_userId_organizationId_read_idx" ON "Notification"("userId", "organizationId", "read");

-- CreateIndex
CREATE INDEX "Notification_userId_organizationId_priority_idx" ON "Notification"("userId", "organizationId", "priority");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");

-- CreateIndex
CREATE INDEX "Document_entityType_entityId_idx" ON "Document"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "CollaborateurSuggere_posteRequisTemplateId_collaborateurId_key" ON "CollaborateurSuggere"("posteRequisTemplateId", "collaborateurId");

-- CreateIndex
CREATE UNIQUE INDEX "FeuilleDeRoute_representationId_key" ON "FeuilleDeRoute"("representationId");

-- CreateIndex
CREATE INDEX "PhaseJournee_feuilleDeRouteId_ordre_idx" ON "PhaseJournee"("feuilleDeRouteId", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "PropositionRemplacement_propositionToken_key" ON "PropositionRemplacement"("propositionToken");

-- CreateIndex
CREATE INDEX "PropositionRemplacement_propositionToken_idx" ON "PropositionRemplacement"("propositionToken");

-- CreateIndex
CREATE INDEX "PropositionRemplacement_candidatId_idx" ON "PropositionRemplacement"("candidatId");

-- AddForeignKey
ALTER TABLE "MagicLinkToken" ADD CONSTRAINT "MagicLinkToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collaborateur" ADD CONSTRAINT "Collaborateur_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Projet" ADD CONSTRAINT "Projet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Representation" ADD CONSTRAINT "Representation_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Representation" ADD CONSTRAINT "Representation_reporteeVersId_fkey" FOREIGN KEY ("reporteeVersId") REFERENCES "Representation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjetMembre" ADD CONSTRAINT "ProjetMembre_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjetMembre" ADD CONSTRAINT "ProjetMembre_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipe" ADD CONSTRAINT "Equipe_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipeMembre" ADD CONSTRAINT "EquipeMembre_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipeMembre" ADD CONSTRAINT "EquipeMembre_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosteRequis" ADD CONSTRAINT "PosteRequis_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosteRequis" ADD CONSTRAINT "PosteRequis_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affectation" ADD CONSTRAINT "Affectation_collaborateurId_fkey" FOREIGN KEY ("collaborateurId") REFERENCES "Collaborateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affectation" ADD CONSTRAINT "Affectation_representationId_fkey" FOREIGN KEY ("representationId") REFERENCES "Representation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affectation" ADD CONSTRAINT "Affectation_posteRequisId_fkey" FOREIGN KEY ("posteRequisId") REFERENCES "PosteRequis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affectation" ADD CONSTRAINT "Affectation_remplaceDe_fkey" FOREIGN KEY ("remplaceDe") REFERENCES "Affectation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjetTemplate" ADD CONSTRAINT "ProjetTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjetTemplate" ADD CONSTRAINT "ProjetTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjetTemplate" ADD CONSTRAINT "ProjetTemplate_sourceProjetId_fkey" FOREIGN KEY ("sourceProjetId") REFERENCES "Projet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipeTemplate" ADD CONSTRAINT "EquipeTemplate_projetTemplateId_fkey" FOREIGN KEY ("projetTemplateId") REFERENCES "ProjetTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosteRequisTemplate" ADD CONSTRAINT "PosteRequisTemplate_equipeTemplateId_fkey" FOREIGN KEY ("equipeTemplateId") REFERENCES "EquipeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborateurSuggere" ADD CONSTRAINT "CollaborateurSuggere_posteRequisTemplateId_fkey" FOREIGN KEY ("posteRequisTemplateId") REFERENCES "PosteRequisTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborateurSuggere" ADD CONSTRAINT "CollaborateurSuggere_collaborateurId_fkey" FOREIGN KEY ("collaborateurId") REFERENCES "Collaborateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeuilleDeRoute" ADD CONSTRAINT "FeuilleDeRoute_representationId_fkey" FOREIGN KEY ("representationId") REFERENCES "Representation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeuilleDeRoute" ADD CONSTRAINT "FeuilleDeRoute_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseJournee" ADD CONSTRAINT "PhaseJournee_feuilleDeRouteId_fkey" FOREIGN KEY ("feuilleDeRouteId") REFERENCES "FeuilleDeRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLocal" ADD CONSTRAINT "ContactLocal_feuilleDeRouteId_fkey" FOREIGN KEY ("feuilleDeRouteId") REFERENCES "FeuilleDeRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropositionRemplacement" ADD CONSTRAINT "PropositionRemplacement_affectationAnnuleeId_fkey" FOREIGN KEY ("affectationAnnuleeId") REFERENCES "Affectation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropositionRemplacement" ADD CONSTRAINT "PropositionRemplacement_candidatId_fkey" FOREIGN KEY ("candidatId") REFERENCES "Collaborateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
