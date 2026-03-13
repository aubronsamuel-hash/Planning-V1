# 🎭 Vision & Concepts métier
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

## Vision du produit

### Résumé
Un SaaS dédié aux structures du **spectacle vivant** (théâtres, compagnies, producteurs, salles de concert) pour planifier leurs spectacles, gérer leurs équipes artistiques et techniques, et donner à chaque collaborateur — qu'il soit CDI, CDD ou intermittent du spectacle — une visibilité claire sur son planning et sa rémunération.

### Problème résolu
Aujourd'hui, les régisseurs et directeurs de production jonglent entre des tableurs Excel, des emails et des outils génériques qui ne comprennent pas les spécificités du projet : les dates de représentation, les cachets, les contrats d'usage, les DPAE, la logique intermittent. Ce SaaS est construit pour ce métier, avec ce vocabulaire.

### Ce que fait le produit
- Créer et gérer des **spectacles** (Peter Pan — 40 dates, Garou en concert — 4 dates)
- Attacher des **représentations** (dates, lieux, horaires) à chaque projet, avec **salle variable par date**
- Constituer une **équipe** avec des postes définis (régisseur, éclairagiste, artiste, technicien…)
- **Planifier** les collaborateurs sur les représentations selon leur type de contrat
- Donner aux employés une **vue personnelle** de leur planning avec **export iCal** (Google / Apple / Outlook)
- Afficher la **rémunération prévisionnelle** par représentation et par mois
- Gérer les **contrats** CDI, CDD et intermittents — avec **confirmation d'affectation** pour les intermittents
- **Exporter en CSV** les données de paie pour SAGE, Cegid ou tout autre logiciel RH
- Respecter le **RGPD** : anonymisation des données personnelles après 3 ans d'inactivité

### Modèle économique
**Abonnement mensuel par organisation.** Tarification simple, indépendante du nombre de collaborateurs, adaptée aux structures de taille variable du spectacle vivant.

### Ce que ce n'est PAS
- Pas un logiciel de paie complet (on affiche la rémunération prévisionnelle, pas les bulletins officiels)
- Pas de gestion de billetterie
- Pas de gestion comptable ou budgétaire d'un projet
- Pas d'application mobile native (web responsive uniquement)
- Pas de dark mode (gain de temps de développement — CSS light-mode uniquement)
- Pas de notifications SMS (coût trop élevé — email + in-app suffisent)
- Interface en **français uniquement** (validation du PMF sur le marché local avant internationalisation)

---

## Concepts métier clés

Avant les rôles et les pages, voici le vocabulaire du domaine — essentiel pour que toute l'équipe parle le même langage.

### Organisation
La structure qui utilise le SaaS : un théâtre, une compagnie de spectacle, un promoteur de concerts. Chaque organisation a son propre espace cloisonné.

### Projet
L'entité centrale de l'outil. Un projet regroupe toutes les représentations ou interventions liées à une même activité.
- Exemples : *Peter Pan* (théâtre), *Garou — Tournée 2026* (concert), *Maintenance Olympia juin 2026* (maintenance)
- Un projet a un **type** qui adapte le vocabulaire et les règles métier
- Un projet a une période (date début → fin) et un statut (En préparation / En cours / Terminé / Archivé / Annulé)
- Un projet contient **plusieurs représentations** (ou interventions, selon le type)

#### Types de projets

| Type | Icône | Exemples | Sous-événement |
|------|-------|----------|---------------|
| Théâtre | 🎭 | Hamlet, Peter Pan | Représentation |
| Comédie musicale | 🎭 | Peter Pan, Chicago | Représentation |
| Concert | 🎤 | Garou Tournée, NRJ Music Tour | Concert / Date |
| Opéra | 🎼 | Carmen, La Traviata | Représentation |
| Danse | 💃 | Gala de danse, spectacle contemporain | Représentation |
| Cirque | 🎪 | Cirque du Soleil, Arlette Gruss | Représentation |
| Maintenance | 🔧 | Révision son, peinture plateau, électricité | Intervention |
| Événement | 📅 | Soirée de gala, conférence, inauguration | Événement |
| Autre | 📋 | Tout ce qui ne rentre pas ailleurs | Séance |

Le type n'est pas qu'un label : il détermine l'icône dans l'interface, le vocabulaire affiché ("Représentations" vs "Interventions"), et les champs disponibles (un projet Maintenance n'a pas de "Show time", seulement une plage horaire).

### Représentation (Date)
Une occurrence unique d'un projet : un jour donné, dans un lieu donné.
- Exemple : *Peter Pan* — Samedi 14 mars 2026, Théâtre du Châtelet
- **La salle est définie représentation par représentation** : une tournée peut passer à Lyon le 5 mars et à Bordeaux le 8 mars dans le même projet

### Créneaux horaires d'une représentation
Une représentation ne se résume pas à l'heure du rideau. Elle a une vie technique avant et après, découpée en **créneaux** :

| Créneau | Exemple Peter Pan 14h | Description |
|---------|----------------------|-------------|
| **Get-in** | 11h00 | Arrivée des équipes techniques, installation, son/lumière |
| **Warmup** | 13h30 | Arrivée des artistes, mise en place finale |
| **Show** | 14h00 → 15h30 | Durée du spectacle (1h30) |
| **Get-out** | 15h30 → 16h00 | Démontage, chargement, libération de la salle |

Chaque **collaborateur affecté** a ses propres heures de présence sur ces créneaux :
- Machiniste : Get-in 11h → fin Get-out 16h (5h)
- Artiste principal : Warmup 13h30 → fin Show 15h30 (2h)
- Régisseur général : Get-in 11h → fin Get-out 16h (5h)
- Technicien son : Get-in 11h → fin Show 15h30 (4h30)

Ces heures pilotent trois choses critiques :
1. **Détection de conflit** : deux affectations se chevauchent-elles vraiment sur les horaires de présence, pas seulement la date ?
2. **Export iCal** : l'événement dans le calendrier du collaborateur affiche SES heures (11h-16h), pas l'heure du show
3. **Rémunération horaire** : pour les CDI et CDD payés à l'heure, le calcul se base sur `endTime - startTime`

Pour les projets de type **Maintenance**, il n'y a pas de "Show" — on définit simplement une plage horaire d'intervention (ex : 8h → 17h).

### Poste
Le rôle technique ou artistique occupé lors d'une représentation.
- Exemples : Régisseur général, Éclairagiste, Machiniste, Souffleur, Artiste principal, Figurant, Technicien son, Habilleuse, Agent de sécurité
- Un poste peut être requis en 1 ou plusieurs exemplaires par représentation
- Chaque poste appartient à une **équipe**

### Équipe (sous-équipe)
Un regroupement de postes et de collaborateurs au sein d'un projet, placé sous la responsabilité d'un **chef de poste**.

Exemples d'équipes typiques :

| Équipe | Icône | Postes typiques |
|--------|-------|----------------|
| Technique | 🔧 | Régisseur son, Éclairagiste, Machiniste, Technicien |
| Artistique | 🎭 | Artiste principal, Choriste, Figurant, Danseur |
| Salle | 🏛️ | Ouvreuse, Agent de sécurité, Responsable accueil |
| Billetterie | 🎟️ | Caissière, Contrôleur, Responsable billetterie |
| Communication | 📣 | Photographe, Vidéaste, Attaché de presse |
| Logistique | 🚚 | Chauffeur, Manutentionnaire, Responsable catering |

Les équipes sont **créées librement** par le Régisseur ou le Directeur pour chaque projet — il n'y a pas de liste imposée.

### Chef de poste
Le responsable d'une équipe au sein d'un projet. C'est un rôle **par projet**, pas un rôle global dans l'organisation.

- Un Chef de poste est un collaborateur promu responsable d'une équipe sur un projet donné
- Il peut l'être sur un projet et simple membre sur un autre
- Il ne gère que son équipe — il ne voit pas les autres équipes ni leur rémunération
- Il reçoit les alertes de postes non pourvus dans son équipe

### Collaborateur
Un individu qui travaille pour l'organisation, avec l'un des trois statuts suivants :

| Type | Description |
|------|-------------|
| **CDI** | Contrat à durée indéterminée — salarié permanent de la structure |
| **CDD** | Contrat à durée déterminée — salarié pour une période définie |
| **Intermittent du spectacle** | Régime spécifique français (Annexes 8 & 10 de l'UNEDIC) — travaille à la représentation ou à la journée, rémunéré en cachets ou en salaire horaire |

### Affectation
Le fait d'assigner un collaborateur à une représentation pour un poste donné.
- Contient : le collaborateur, la représentation, le poste, le type de contrat pour cette affectation, la rémunération associée

### Cachet
Mode de rémunération propre aux intermittents et à certains CDD dans le projet. Un cachet = une rémunération forfaitaire pour une représentation ou une journée de travail.

### DPAE
Déclaration Préalable À l'Embauche — obligatoire en France pour **chaque prestation** d'un intermittent ou d'un CDD (Règle #3), pas seulement la première. Le système doit permettre de suivre si la DPAE a été faite pour chaque affectation.

---