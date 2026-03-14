-- CreateEnum
CREATE TYPE "PreferenceChambre" AS ENUM ('SANS_PREFERENCE', 'INDIVIDUELLE', 'PARTAGEE_ACCEPTEE');

-- CreateEnum
CREATE TYPE "RegimeAlimentaire" AS ENUM ('STANDARD', 'VEGETARIEN', 'VEGAN', 'SANS_PORC', 'HALAL', 'KASHER', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeChambre" AS ENUM ('INDIVIDUELLE', 'DOUBLE', 'DOUBLE_USAGE_SIMPLE', 'SUITE');

-- CreateEnum
CREATE TYPE "TypeVehicule" AS ENUM ('CAMION', 'VAN', 'VOITURE', 'AUTRE');

-- CreateEnum
CREATE TYPE "RolePassager" AS ENUM ('CONDUCTEUR', 'PASSAGER');

-- AlterTable
ALTER TABLE "Collaborateur" ADD COLUMN     "allergies" TEXT,
ADD COLUMN     "permisCategorie" TEXT,
ADD COLUMN     "permisConduire" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preferenceChambre" "PreferenceChambre" NOT NULL DEFAULT 'SANS_PREFERENCE',
ADD COLUMN     "regimeAlimentaire" "RegimeAlimentaire" NOT NULL DEFAULT 'STANDARD';

-- CreateTable
CREATE TABLE "Hebergement" (
    "id" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "ville" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "notes" TEXT,
    "roomingListEnvoyeeAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hebergement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chambre" (
    "id" TEXT NOT NULL,
    "hebergementId" TEXT NOT NULL,
    "numero" TEXT,
    "type" "TypeChambre" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Chambre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChambreOccupant" (
    "id" TEXT NOT NULL,
    "chambreId" TEXT NOT NULL,
    "collaborateurId" TEXT NOT NULL,
    "nuitDu" DATE NOT NULL,
    "notes" TEXT,

    CONSTRAINT "ChambreOccupant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "TypeVehicule" NOT NULL,
    "immatriculation" TEXT,
    "capacitePersonnes" INTEGER,
    "capaciteChargement" TEXT,
    "conducteurHabituelId" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehiculeAssignment" (
    "id" TEXT NOT NULL,
    "vehiculeId" TEXT NOT NULL,
    "representationId" TEXT NOT NULL,
    "departLieu" TEXT,
    "departTime" TEXT,
    "arriveeEstimeeTime" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehiculeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehiculePassager" (
    "id" TEXT NOT NULL,
    "vehiculeAssignmentId" TEXT NOT NULL,
    "collaborateurId" TEXT NOT NULL,
    "role" "RolePassager" NOT NULL,

    CONSTRAINT "VehiculePassager_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hebergement_projetId_idx" ON "Hebergement"("projetId");

-- CreateIndex
CREATE INDEX "Chambre_hebergementId_idx" ON "Chambre"("hebergementId");

-- CreateIndex
CREATE INDEX "ChambreOccupant_collaborateurId_idx" ON "ChambreOccupant"("collaborateurId");

-- CreateIndex
CREATE UNIQUE INDEX "ChambreOccupant_chambreId_collaborateurId_nuitDu_key" ON "ChambreOccupant"("chambreId", "collaborateurId", "nuitDu");

-- CreateIndex
CREATE INDEX "Vehicule_organizationId_idx" ON "Vehicule"("organizationId");

-- CreateIndex
CREATE INDEX "VehiculeAssignment_representationId_idx" ON "VehiculeAssignment"("representationId");

-- CreateIndex
CREATE INDEX "VehiculeAssignment_vehiculeId_idx" ON "VehiculeAssignment"("vehiculeId");

-- CreateIndex
CREATE INDEX "VehiculePassager_vehiculeAssignmentId_idx" ON "VehiculePassager"("vehiculeAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "VehiculePassager_vehiculeAssignmentId_collaborateurId_key" ON "VehiculePassager"("vehiculeAssignmentId", "collaborateurId");

-- AddForeignKey
ALTER TABLE "Projet" ADD CONSTRAINT "Projet_regisseurId_fkey" FOREIGN KEY ("regisseurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hebergement" ADD CONSTRAINT "Hebergement_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hebergement" ADD CONSTRAINT "Hebergement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chambre" ADD CONSTRAINT "Chambre_hebergementId_fkey" FOREIGN KEY ("hebergementId") REFERENCES "Hebergement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChambreOccupant" ADD CONSTRAINT "ChambreOccupant_chambreId_fkey" FOREIGN KEY ("chambreId") REFERENCES "Chambre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChambreOccupant" ADD CONSTRAINT "ChambreOccupant_collaborateurId_fkey" FOREIGN KEY ("collaborateurId") REFERENCES "Collaborateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicule" ADD CONSTRAINT "Vehicule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicule" ADD CONSTRAINT "Vehicule_conducteurHabituelId_fkey" FOREIGN KEY ("conducteurHabituelId") REFERENCES "Collaborateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiculeAssignment" ADD CONSTRAINT "VehiculeAssignment_vehiculeId_fkey" FOREIGN KEY ("vehiculeId") REFERENCES "Vehicule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiculeAssignment" ADD CONSTRAINT "VehiculeAssignment_representationId_fkey" FOREIGN KEY ("representationId") REFERENCES "Representation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiculePassager" ADD CONSTRAINT "VehiculePassager_vehiculeAssignmentId_fkey" FOREIGN KEY ("vehiculeAssignmentId") REFERENCES "VehiculeAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiculePassager" ADD CONSTRAINT "VehiculePassager_collaborateurId_fkey" FOREIGN KEY ("collaborateurId") REFERENCES "Collaborateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
