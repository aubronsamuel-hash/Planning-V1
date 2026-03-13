# 🗄️ Modèles de données
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

## Modèles de données

```
Organization
├── id, name, slug, type, logo, city, country
├── plan: FREE | PRO | ENTERPRISE            ← abonnement mensuel par org
├── isReadOnly: Boolean @default(false)     ← true si quota dépassé après downgrade/trial
├── billingEmail, stripeCustomerId
├── onboardingCompletedAt: DateTime?  ← null tant que le wizard n'est pas terminé
├── suspendedAt: DateTime?   ← null = actif · non-null = suspendu par SUPER_ADMIN
├── suspendedReason: String? ← raison interne (non visible par le client)
├── paymentFailedAt: DateTime?    ← null = paiements OK · non-null = dernier échec Stripe
├── trialEndsAt: DateTime?        ← null si pas de trial actif
├── trialReminderSentAt: DateTime? ← null = email J-3 pas encore envoyé (guard cron §21.3 pour éviter les doublons)
└── → Members[], Projets[]

User
├── id, firstName, lastName, email, passwordHash (nullable), avatarUrl, phone
├── role: SUPER_ADMIN | MEMBER
│   SUPER_ADMIN → accès back-office plateforme
│   MEMBER      → tout utilisateur d'une organisation (rôle org défini dans OrganizationMembership)
├── locale: 'fr' (fixe — interface français uniquement)
├── timezone: String @default("Europe/Paris")
├── icalToken: String? @unique          ← token révocable pour export iCal
├── emailPreferences: Json?             ← préférences de notification par email
├── pendingEmail: String?               ← nouvel email en attente de confirmation
├── anonymizedAt: DateTime?             ← date d'anonymisation RGPD du compte User
├── rgpdWarningAt: DateTime?            ← date d'envoi de l'email d'avertissement RGPD
│
├── lastActiveAt                             ← pour RGPD : détection inactivité
└── → OrganizationMemberships[], Notifications[], MagicLinkTokens[]
    ⚠️  User.role vaut TOUJOURS MEMBER — c'est Collaborateur.accountStatus qui représente l'état du compte

MagicLinkToken (accès temporaire sans mot de passe)
├── id, token (UUID), userId
├── purpose: LOGIN | CONFIRMATION | DOCUMENT_ACCESS | PLANNING_VIEW | ACTIVATION | EMAIL_CHANGE
│   Durées d'expiration : LOGIN 15 min · DOCUMENT_ACCESS 1h · EMAIL_CHANGE 24h
│   CONFIRMATION / PLANNING_VIEW / ACTIVATION → 7 jours
├── expiresAt, usedAt
└── metadata (JSON) ← ex: { affectationId: "..." } pour contextualiser le lien

Collaborateur (profil étendu de User — données RH sensibles)
├── id, userId
│
├── ── Statut du compte (Lazy Auth) ──
├── accountStatus: GHOST | ACTIVE | INACTIF
│   GHOST   → créé par le régisseur, pas de mot de passe, accès via magic links uniquement
│   ACTIVE  → l'intermittent a activé son compte avec un mot de passe
│   INACTIF → désactivé manuellement par RH ou Directeur (conservation de l'historique)
│   ⚠️  User.role reste TOUJOURS MEMBER — c'est ce champ qui représente l'état réel du compte
├── ghostCreatedAt: DateTime?  ← date à laquelle le régisseur a saisi cet email dans le système
├── activatedAt: DateTime?     ← date à laquelle le collaborateur a défini son mot de passe
│
├── contractType: CDI | CDD | INTERMITTENT
│   → type "habituel" de ce collaborateur, affiché dans l'annuaire
│   → le type réellement utilisé sur une affectation donnée est Affectation.contractTypeUsed
│   → les deux peuvent différer (ex: quelqu'un habituellement intermittent peut être en CDD sur un projet)
├── socialSecurityNumber (chiffré AES-256)   ← visible RH uniquement
├── congesSpectaclesNumber                   ← N° Congés Spectacles (intermittents)
├── iban (chiffré AES-256)                   ← visible RH uniquement
├── anonymizedAt                             ← date d'anonymisation RGPD (null si actif)
│
├── ── Profil portable (§12) ──
├── cachetHabituel: Int?          ← cachet forfaitaire par défaut (en centimes) — pré-remplit Affectation.remuneration
├── specialites: String[]         ← ["Éclairagiste", "Son", "Machiniste"] (déclaratif)
├── yearsExperience: Int?         ← expérience déclarée
├── availableForTour: Boolean     ← accepte les déplacements en tournée
└── → Affectations[]
    ⚠️  Pas de relation Prisma `Documents[]` directe — Document utilise un pattern polymorphique
        (entityType = 'COLLABORATEUR' + entityId = collaborateur.id)
        Requête : prisma.document.findMany({ where: { entityType: 'COLLABORATEUR', entityId: id } })

Projet
├── id, title, subtitle, posterUrl
├── type:   THEATRE | COMEDIE_MUSICALE | CONCERT | OPERA | DANSE | CIRQUE
│           | MAINTENANCE | EVENEMENT | AUTRE
├── status: EN_PREPARATION | EN_COURS | TERMINE | ARCHIVE | ANNULE
├── startDate, endDate
│   ⚠️  Plus de "mainVenue" fixe — la salle est définie par représentation
├── colorCode: String   ← couleur hexadécimale du projet (ex: "#6366F1")
│   → choisie à la création depuis une palette fixe de 12 couleurs
│   → utilisée sur le planning global pour différencier les projets visuellement
├── organizationId, regisseurId
├── deletedAt: DateTime?         ← soft delete (null = actif)
└── → Representations[], PostesRequis[], ProjetMembres[], Equipes[]

Representation
├── id
├── date: Date              ← date seule, sans heure (ex: 2026-03-14)
│
├── ── Créneaux horaires — type String "HH:MM" (heure locale) ──
├── getInTime:     String? ← ex: "11:00" — null si pas de montage
├── warmupTime:    String? ← ex: "13:30" — null si pas de warmup
├── showStartTime: String? ← ex: "14:00" — null pour Maintenance
├── showEndTime:   String? ← ex: "15:30" — null pour Maintenance
├── getOutTime:    String? ← ex: "16:00" — null si pas de démontage
│   ⚠️  Maintenance : utiliser showStartTime/showEndTime comme plage d'intervention
│   ⚠️  Minuit dépassé : si getOutTime < showStartTime → ajouter 24h au calcul
│
├── venueName, venueCity, venueAddress       ← salle propre à chaque représentation
├── venueLatLng (optionnel, pour carte)
├── type: REPRESENTATION | REPETITION | FILAGE | GENERALE | AVANT_PREMIERE | INTERVENTION | EVENEMENT
├── status: PLANIFIEE | CONFIRMEE | ANNULEE | REPORTEE
│   → REPORTEE : la représentation a été déplacée à une autre date
├── annulationReason: String?   ← rempli si status = ANNULEE ou REPORTEE
├── annulationAt: DateTime?     ← horodatage de la décision
├── reporteeVersId: String?     ← lien vers la nouvelle Representation si reportée
├── notes, projetId
├── deletedAt: DateTime?        ← soft delete (null = actif)
└── → Affectations[]

ProjetMembre (membres avec accès au projet — régisseurs co-responsables, invités RH)
├── id, projetId, userId
├── role: REGISSEUR | RH | OBSERVATEUR   ← rôle dans ce projet spécifiquement
└── addedAt, addedById

Equipe (sous-équipe d'un projet)
├── id, name, icon, color
├── projetId
│   ⚠️  Pas de chefId ici — le chef se retrouve via EquipeMembre.role: CHEF
└── → PostesRequis[], EquipeMembres[]

EquipeMembre (appartenance d'un collaborateur à une équipe)
├── id, equipeId, userId
└── role: CHEF | MEMBRE    ← CHEF = le chef de poste, MEMBRE = collaborateur simple

PosteRequis (besoin en personnel par poste, sur l'ensemble du projet)
├── id, name, requiredCount, contractTypePreference
├── equipeId               ← appartient à une équipe (obligatoire)
├── isCritique: Boolean    ← true = poste bloquant (ex: Sonorisateur, Régisseur plateau)
│   → si non pourvu → statut 🔴 sur le planning global (Règle #33)
│   → si false et non pourvu → statut 🟡
│   → défini par le régisseur à la création/édition du poste
├── defaultStartTime   ← heure de début par défaut pour ce poste (ex: 11:00 pour machiniste)
├── defaultEndTime     ← heure de fin par défaut pour ce poste (ex: 16:00 pour machiniste)
│   → pré-rempli à la création d'une affectation, modifiable par le régisseur
├── projetId
└── → Affectations[]

Affectation (collaborateur × représentation × poste)
├── id, collaborateurId, representationId, posteRequisId
├── contractTypeUsed: CDI | CDD | INTERMITTENT
│
├── ── Horaires de présence du collaborateur ──
├── startTime: String   ← heure d'arrivée "HH:MM" (ex: "11:00")
├── endTime:   String   ← heure de départ "HH:MM" (ex: "16:00")
│   Conflit = Representation.date + startTime/endTime convertis en DateTime pour comparaison
│   → calculé automatiquement depuis PosteRequis.defaultStart/EndTime
│   → modifiable manuellement par le régisseur si besoin
│   → utilisé pour : détection de conflit · export iCal · calcul rémunération horaire
│
├── remuneration (montant prévu, en centimes)
│   → pour les intermittents : cachet forfaitaire saisi manuellement
│   → pour les CDI/CDD : calculé automatiquement = taux horaire × (endTime - startTime)
│
├── hasConflict: Boolean @default(false)
│   → true si ce collaborateur a une autre affectation à cheval sur le même créneau
│   → posé au moment de la création (avertissement ⚠️ non bloquant dans le dropdown)
│   → flag visuel uniquement — l'affectation est créée même en cas de conflit (Règle #2)
│
├── ── Confirmation (intermittents uniquement) ──
├── confirmationStatus: EN_ATTENTE | CONFIRMEE | REFUSEE | NON_REQUISE | ANNULEE | ANNULEE_TARDIVE
│   NON_REQUISE     → CDI et CDD (pas de confirmation requise)
│   ANNULEE         → annulation planifiée (> 48h avant la repré)
│   ANNULEE_TARDIVE → désistement ou annulation tardive (≤ 48h) — déclenche Remplacement Urgent
│   ⚠️  Pas de confirmationToken sur Affectation — c'est MagicLinkToken qui gère tout
│       (purpose: CONFIRMATION, metadata: { affectationId })
├── confirmedAt, refusedAt
├── annulationRaison: String?     ← raison du désistement tardif (optionnel)
├── annulationDate: DateTime?     ← date du signalement
├── heuresContrat: Int?           ← heures déclarées au contrat (intermittents & CDD, null pour CDI)
│                                    Suivi quota Pôle Emploi / Caisse des Congés Spectacles
├── cachetAnnulation: A_DECIDER | DU | ANNULE  (null si non annulée)
│   → Rempli seulement quand confirmationStatus = ANNULEE | ANNULEE_TARDIVE
│   → Le RH tranche manuellement, l'app ne présuppose rien
├── remplaceDe: Affectation?      ← si remplacement : pointe vers l'affectation d'origine
│
├── ── DPAE ──
├── dpaeStatus: A_FAIRE | ENVOYEE | CONFIRMEE | NON_REQUISE
├── dpaeDate
│
├── relanceSentAt: DateTime?      ← date de la relance automatique (cron §21.1) — une seule par affectation
├── notes
├── deletedAt: DateTime?          ← soft delete (null = actif)
└── createdAt, updatedAt

Notification
├── id, userId
├── type: AFFECTATION_CREEE | AFFECTATION_MODIFIEE | AFFECTATION_ANNULEE
│        | CONFIRMATION_REQUISE | CONFIRMATION_RECUE | CONFIRMATION_REFUSEE
│        | POSTE_NON_POURVU | DPAE_A_FAIRE
│        | REPRESENTATION_ANNULEE | REPRESENTATION_REPORTEE
│        | REMPLACEMENT_URGENT | RAPPEL_CONFIRMATION
│        | PROJET_ANNULE
│        | FEUILLE_DE_ROUTE_PUBLIEE | FEUILLE_DE_ROUTE_MODIFIEE
│        | RGPD_AVERTISSEMENT
├── title: String             ← texte court affiché en gras
├── body: String              ← message détaillé
├── link: String?             ← route vers la page concernée
├── actionLabel: String?      ← libellé du bouton d'action inline
├── read: Boolean             ← false par défaut
├── readAt: DateTime?
├── priority: CRITIQUE | URGENT | INFO   ← calculé à la création
│   CRITIQUE : REMPLACEMENT_URGENT, DPAE_A_FAIRE (J-2 ou moins)
│   URGENT   : POSTE_NON_POURVU, CONFIRMATION_REFUSEE, REPRESENTATION_ANNULEE
│   INFO     : tout le reste
├── groupId: String?          ← UUID partagé entre notifs groupées (< 30 min, même projet)
├── createdAt: DateTime
└── archivedAt: DateTime?     ← null jusqu'à 3 mois après création

ActivityLog
├── id
├── action: ActivityLogAction   ← enum exhaustif (26 valeurs) — ne jamais passer une String libre (voir 15-schema-prisma.md)
├── entityType, entityId
├── metadata: JSON?
├── userId: String?             ← nullable — null pour les actions sans auteur humain (crons, webhooks Stripe)
│   Utiliser userId: null explicitement dans ces cas (ne pas passer de SYSTEM_ACTOR_ID fictif)
└── createdAt

Document (pièces jointes — stockage AWS S3)
├── id, filename, s3Key, s3Bucket
├── mimeType, sizeBytes
├── entityType: COLLABORATEUR | PROJET | AFFECTATION
├── entityId, uploadedById, createdAt
├── deletedAt: DateTime?         ← soft delete (null = actif)

OrganizationMembership (lien User ↔ Organization — THE source de vérité pour les rôles)
├── id, userId, organizationId
├── role: DIRECTEUR | REGISSEUR | RH | COLLABORATEUR
│   ⚠️  CHEF_POSTE n'est PAS un rôle d'organisation — c'est un rôle d'équipe
│       défini dans EquipeMembre.role: CHEF sur un projet donné
│       Un COLLABORATEUR devient chef de poste sur un projet via EquipeMembre.
├── joinedAt
└── invitedById                  ← qui a envoyé l'invitation

ProjetTemplate (template réutilisable de structure d'équipe)
├── id, name, description, icon
├── projetType: THEATRE | COMEDIE_MUSICALE | ... (optionnel)
├── organizationId, createdById
├── sourceProjetId?              ← projet dont ce template est dérivé
├── usageCount                   ← nombre de fois utilisé
└── → EquipeTemplates[]

EquipeTemplate
├── id, name, icon, color
├── projetTemplateId
└── → PosteRequisTemplates[]

PosteRequisTemplate
├── id, name, requiredCount
├── contractTypePreference: CDI | CDD | INTERMITTENT | INDIFFERENT
├── defaultStartTime, defaultEndTime
├── equipeTemplateId
└── → CollaborateursSuggeres[]

CollaborateurSuggere (pré-assignation suggérée dans un template)
├── id, posteRequisTemplateId, collaborateurId
└── (suggestion — le régisseur peut ignorer lors de l'import)

FeuilleDeRoute (compagnon logistique d'une représentation — §11)
├── id
├── representationId (unique — 1:1 avec Representation)
├── statut: BROUILLON | PUBLIEE | ARCHIVEE
├── notesGenerales: String?
├── transportInfo: String?      ← texte libre (N° train, heure RDV, contact chauffeur)
├── publishedAt: DateTime?
├── createdById, createdAt, updatedAt
└── → PhasesJournee[], ContactsLocaux[]
    → Hebergements[] via Module Tournée (§19)

PhaseJournee
├── id, feuilleDeRouteId, ordre: Int
├── type: DECHARGEMENT | MONTAGE | BALANCES | CATERING | ECHAUFFEMENT
│         | REPRESENTATION | ENTRACTE | DEMONTAGE | PAUSE | AUTRE
├── labelCustom: String?
├── startTime: String "HH:MM", endTime: String?
├── lieu: String?, notes: String?

-- Module Tournée (§19) --

Hebergement (hôtel / logement pour une période de tournée)
├── id, projetId
├── nom: String            ← ex: "Hôtel Ibis Lyon Centre"
├── adresse: String?, ville: String?
├── telephone: String?, email: String?
├── checkIn: Date          ← date seule (cohérence avec Representation.date — pas de composante heure)
├── checkOut: Date         ← date seule
├── notes: String?
├── roomingListEnvoyeeAt: DateTime?
├── createdById, createdAt, updatedAt
└── → Chambres[]

Chambre
├── id, hebergementId
├── numero: String?        ← ex: "101", "Suite A"
├── type: INDIVIDUELLE | DOUBLE | DOUBLE_USAGE_SIMPLE | SUITE
├── notes: String?
└── → Occupants[]

ChambreOccupant
├── id, chambreId, collaborateurId
├── nuitDu: Date           ← date de la nuit (date uniquement — cohérence avec Representation.date)
└── notes: String?

Vehicule (flotte de l'organisation)
├── id, organizationId
├── label: String          ← ex: "Camion plateau", "Van 9 places"
├── type: CAMION | VAN | VOITURE | AUTRE
├── immatriculation: String?, capacitePersonnes: Int?
├── capaciteChargement: String?  ← texte libre ex: "3,5T"
├── conducteurHabituelId: String?
├── actif: Boolean         ← false = archivé
└── → Assignations[]

VehiculeAssignment (véhicule × représentation)
├── id, vehiculeId, representationId
├── departLieu: String?, departTime: String? "HH:MM"
├── arriveeEstimeeTime: String?, notes: String?
└── → Passagers[]

VehiculePassager
├── id, vehiculeAssignmentId, collaborateurId
└── role: CONDUCTEUR | PASSAGER
   ⚠️ Un seul CONDUCTEUR par VehiculeAssignment

-- Champs ajoutés sur Collaborateur (Module Tournée §19) --
├── preferenceChambre: SANS_PREFERENCE | INDIVIDUELLE | PARTAGEE_ACCEPTEE
├── regimeAlimentaire: STANDARD | VEGETARIEN | VEGAN | SANS_PORC | HALAL | KASHER | AUTRE
├── allergies: String?
├── permisConduire: Boolean
└── permisCategorie: String?     ← ex: "B", "C", "CE"

ContactLocal
├── id, feuilleDeRouteId
├── nom: String, role: String
├── type: VENUE | CATERING | SECURITE | HOTEL | URGENCE | AUTRE
├── telephone: String?, email: String?, notes: String?


PropositionRemplacement (suivi des propositions de remplacement urgent)
├── id
├── affectationAnnuleeId         ← l'affectation ANNULEE_TARDIVE d'origine
├── candidatId                   ← collaborateur contacté
├── propositionToken (UUID)      ← magic link d'acceptation/refus (4h)
│   ⚠️  Token maison (pas via MagicLinkToken) — accepté par pragmatisme car le statut ACCEPTEE/REFUSEE
│       est porté par PropositionRemplacement.status lui-même, pas via usedAt d'un MagicLinkToken
├── status: EN_ATTENTE | ACCEPTEE | REFUSEE | EXPIREE
├── proposedAt, expiresAt, respondedAt
└── notes
```

---