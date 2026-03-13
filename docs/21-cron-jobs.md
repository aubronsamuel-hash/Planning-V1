# ⏰ Cron Jobs & Tâches planifiées
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

---

## Concept

Les crons sont des jobs serveur exécutés périodiquement, indépendamment des requêtes utilisateur. Ils gèrent les actions différées : relances, alertes, nettoyage, RGPD, expiration de trial.

**Implémentation recommandée :** Vercel Cron Jobs (via `vercel.json` + route API `GET /api/cron/[job]`). Chaque endpoint est protégé par un header `Authorization: Bearer CRON_SECRET` (variable d'environnement).

**Idempotence :** chaque cron doit être idempotent — l'exécuter deux fois ne doit pas créer de doublon ni d'effet de bord.

---

## Vue d'ensemble

| Job | Déclencheur | Fréquence | Priorité |
|-----|-------------|:---------:|:--------:|
| [21.1 Relance confirmation](#211-relance-confirmation-collaborateur) | 48h sans réponse à une affectation | Toutes les heures | 🔴 Haute |
| [21.2 Alerte DPAE J-1](#212-alerte-dpae-j-1) | Affectation sans DPAE validée à J-1 | Quotidien 7h00 | 🔴 Haute |
| [21.3 Expiration trial](#213-expiration-trial) | Trial arrivant à terme | Quotidien 8h00 | 🔴 Haute |
| [21.4 Nettoyage tokens](#214-nettoyage-tokens-expirés) | Tokens magic link expirés | Quotidien 3h00 | 🟡 Moyenne |
| [21.5 RGPD anonymisation](#215-rgpd--anonymisation) | 3 ans d'inactivité | Mensuel (1er du mois, 2h00) | 🟡 Moyenne |
| [21.6 Archivage projets](#216-archivage-automatique-des-projets-terminés) | Projets terminés depuis 30j | Hebdo (lundi 4h00) | 🟢 Basse |
| [21.7 Alerte postes non pourvus + archivage FDR](#217-alerte-postes-non-pourvus-j-7-et-j-2--archivage-feuilles-de-route) | Représentation dans 7j ou 2j avec postes vides + FDR passées à archiver | Quotidien 8h00 | 🟡 Moyenne |

---

## 21.1 Relance confirmation collaborateur

**Objectif :** Rappeler aux intermittents qui n'ont pas répondu à leur affectation depuis 48h.

**Déclencheur :** `Affectation.confirmationStatus = EN_ATTENTE` + `createdAt < now() - 48h`

**Fréquence :** Toutes les heures (pour ne pas manquer la fenêtre de 48h)

```
[Cron — toutes les heures]
    → Requête :
        SELECT * FROM Affectation
        WHERE confirmationStatus = 'EN_ATTENTE'
          AND createdAt < now() - interval '48 hours'
          AND relanceSentAt IS NULL           ← pas encore relancé
          AND contractTypeUsed = 'INTERMITTENT'  ← CDI/CDD ne reçoivent pas de relance magic link

    → Pour chaque affectation trouvée :
        → Invalider les MagicLinkToken existants encore valides :
          UPDATE MagicLinkToken SET usedAt = now()
          WHERE affectationId = X AND purpose = 'CONFIRMATION' AND usedAt IS NULL AND expiresAt > now()
          ← évite d'avoir deux tokens CONFIRMATION valides simultanément pour la même affectation
        → Générer un nouveau MagicLinkToken (purpose: CONFIRMATION, expiry: 7j)
        → Envoyer email de relance à l'intermittent
        → Affectation.relanceSentAt = now()   ← marquer "relance envoyée"
        → Notification in-app au Régisseur :
          "⏳ [Nom] n'a toujours pas répondu à Peter Pan · 14/03"
        → ActivityLog: RELANCE_CONFIRMATION_ENVOYEE
```

**Champ Prisma requis :** `Affectation.relanceSentAt DateTime?`

**Règle :** une seule relance par affectation (cf. `relanceSentAt`). Si l'intermittent ne répond toujours pas, le régisseur doit agir manuellement.

---

## 21.2 Alerte DPAE J-1

**Objectif :** Alerter le RH si une DPAE n'est pas validée la veille d'une représentation.

**Déclencheur :** `Affectation.dpaeStatus = A_FAIRE | ENVOYEE` + `Representation.date = demain`

**Fréquence :** Quotidien à 7h00

```
[Cron — quotidien 7h00]
    → Requête :
        SELECT * FROM Affectation
        JOIN Representation ON Representation.id = Affectation.representationId
        WHERE Representation.date = CURRENT_DATE + 1   ← demain
          AND Affectation.dpaeStatus IN ('A_FAIRE', 'ENVOYEE')
          AND Affectation.contractTypeUsed IN ('INTERMITTENT', 'CDD')

    → Pour chaque affectation :
        → Notification CRITIQUE au(x) RH de l'organisation :
          "🔴 DPAE non confirmée — [Nom] · Peter Pan · demain"
        → Email récapitulatif au RH (une seule fois par jour, groupé par org)
          → Tableau : Collaborateur | Projet | Date | Poste | Statut DPAE
```

---

## 21.3 Expiration trial

**Objectif :** Gérer les organisations dont le trial PRO arrive à terme.

**Fréquence :** Quotidien à 8h00

```
[Cron — quotidien 8h00]
    → ÉTAPE 1 — Avertissement J-3 :
        SELECT * FROM Organization
        WHERE trialEndsAt BETWEEN now() AND now() + interval '3 days'
          AND plan = 'PRO'
          AND stripeCustomerId IS NULL       ← pas encore souscrit
          AND trialReminderSentAt IS NULL    ← pas encore alerté (évite 3 emails sur 3 jours)

        → Email au Directeur de chaque org :
          "Votre essai PRO se termine dans X jours.
           [Choisir un plan] pour continuer sans interruption."
        → Notification in-app URGENT
        → Organization.trialReminderSentAt = now()

    → ÉTAPE 2 — Trial expiré :
        SELECT * FROM Organization
        WHERE trialEndsAt < now()
          AND plan = 'PRO'
          AND stripeCustomerId IS NULL    ← pas encore souscrit

        → Calculer nbCollabs = COUNT(OrganizationMembership)
          WHERE organizationId = org.id AND role = 'COLLABORATEUR'
          ← Organization n'a pas de champ collaborateurCount — toujours calculer via COUNT

        → CAS A — nbCollabs ≤ 3 :
            → Organization.plan = FREE
            → Email au Directeur : "Votre essai est terminé → plan Découverte"

        → CAS B — nbCollabs > 3 :
            → Organization.plan = FREE         ← dégradation douce, comme §18.4 Option A
            → Organization.isReadOnly = true   ← quota FREE dépassé → lecture seule
            → Email au Directeur : "Votre essai est terminé → mode lecture seule
               Souscrivez ou réduisez le nombre de collaborateurs"
            → Notification CRITIQUE in-app
```

> **Note :** Le trial est 100% app-side (`stripeCustomerId IS NULL` pendant toute la durée du trial). Stripe ne peut pas déclencher `customer.subscription.trial_will_end` — **ce cron est le seul mécanisme de J-3 et d'expiration trial**. Voir §18.7 pour le handler Stripe (applicable si migration vers trials Stripe natifs).

---

## 21.4 Nettoyage tokens expirés

**Objectif :** Purger les `MagicLinkToken` expirés et marquer les `PropositionRemplacement` sans réponse comme `EXPIREE`.

**Fréquence :** Quotidien à 3h00 (heure creuse)

```
[Cron — quotidien 3h00]
    → DELETE FROM MagicLinkToken
      WHERE expiresAt < now()
        ← supprime tous les tokens expirés (utilisés ou non) pour éviter la croissance infinie de la table

    → UPDATE PropositionRemplacement
      SET status = 'EXPIREE'
      WHERE expiresAt < now()
        AND status = 'EN_ATTENTE'
        ← sans ce step, les propositions non répondues restent EN_ATTENTE indéfiniment
        ← le régisseur verrait des remplacements "en cours" qui ne le sont plus

    → Log : "Nettoyage : X tokens supprimés · Y propositions de remplacement expirées"
```

---

## 21.5 RGPD — Anonymisation

**Objectif :** Anonymiser les collaborateurs sans activité depuis 3 ans (règle #10 RGPD).

**Fréquence :** Mensuel (1er du mois à 2h00)

```
[Cron — mensuel, 1er du mois 2h00]

    → ÉTAPE 1 — Avertissement 30 jours avant :
        SELECT User
        WHERE (lastActiveAt < now() - interval '2 years 11 months'
               OR (lastActiveAt IS NULL AND createdAt < now() - interval '2 years 11 months'))
          AND anonymizedAt IS NULL
          AND rgpdWarningAt IS NULL
          ← lastActiveAt est mis à jour à chaque connexion active (§23)
          ← si NULL (compte créé mais jamais connecté), on se rabat sur createdAt

        → Email à l'utilisateur :
          "Votre compte sera anonymisé dans 30 jours en raison d'inactivité."
        → User.rgpdWarningAt = now()
        → ActivityLog: RGPD_WARNING_SENT (userId: null — action cron)

    → ÉTAPE 2 — Anonymisation effective :
        SELECT User
        WHERE (lastActiveAt < now() - interval '3 years'
               OR (lastActiveAt IS NULL AND createdAt < now() - interval '3 years'))
          AND anonymizedAt IS NULL

        → Pour chaque User :
            User.firstName = "Collaborateur"
            User.lastName  = "Anonymisé"
            User.email     = "anonyme_[uuid]@supprime.invalid"
            User.phone     = NULL
            → Collaborateur.socialSecurityNumber = NULL (chiffré)
            → Collaborateur.iban = NULL (chiffré)
            → User.anonymizedAt = now()
            → Les Affectations et données projet restent intactes (historique)
            → ActivityLog: USER_ANONYMIZED (userId: null — action cron)
```

**Champs Prisma requis :**
- `User.anonymizedAt DateTime?`
- `User.rgpdWarningAt DateTime?`
- Calcul "dernière affectation" → requête sur `Affectation` groupée par `userId`

---

## 21.6 Archivage automatique des projets terminés

**Objectif :** Passer en `ARCHIVE` les projets dont toutes les représentations sont passées depuis plus de 30 jours.

**Fréquence :** Hebdomadaire (lundi à 4h00)

```
[Cron — hebdomadaire lundi 4h00]
    → SELECT Projet
      WHERE status = 'TERMINE'
        AND dernière représentation < now() - interval '30 days'

    → Projet.status = ARCHIVE
    → ActivityLog: PROJET_ARCHIVE
    → Pas de notification (action transparente)
```

> **Note :** le régisseur peut aussi archiver manuellement à tout moment.
>
> **⚠️ Limite :** ce cron cible uniquement les projets déjà en `TERMINE`. Or aucun mécanisme n'est automatisé pour passer un projet de `EN_COURS` à `TERMINE` — cette transition est manuelle (le régisseur la déclenche). Les projets dont toutes les représentations sont passées mais dont le status reste `EN_COURS` ne seront **jamais** archivés par ce cron. C'est un comportement attendu (le régisseur doit valider la fin du projet), mais il doit être documenté et géré côté UX (ex: badge "projets à clôturer" sur le dashboard).

---

## 21.7 Alerte postes non pourvus (J-7 et J-2) + Archivage feuilles de route

**Objectif :** (1) Prévenir le régisseur et le chef de poste qu'une représentation dans 7 jours ou 2 jours a encore des postes non pourvus. (2) Archiver automatiquement les feuilles de route dont la date est passée.

**Fréquence :** Quotidien à 8h00

```
[Cron — quotidien 8h00]

    ── ÉTAPE 1 — Alerte postes non pourvus J-7 ──

    → SELECT Representation
      WHERE date = CURRENT_DATE + 7
        AND status = 'PLANIFIEE'

    → Pour chaque représentation :
        → Calculer les postes non pourvus par poste :
          PosteRequis.requiredCount
          - COUNT(Affectation WHERE posteRequisId = X
                    AND confirmationStatus NOT IN ('ANNULEE', 'ANNULEE_TARDIVE')
                    AND deletedAt IS NULL)
          ← ⚠️ Ne pas compter les affectations annulées — elles libèrent le poste

        → Si postes_non_pourvus > 0 :
            → Notification URGENT au Régisseur responsable :
              "⚠️ Peter Pan · Sam 14/03 — 2 postes non pourvus dans 7 jours"
            → Notification URGENT au(x) Chef(s) de poste concernés

    ── ÉTAPE 2 — Alerte postes non pourvus J-2 (CRITIQUE) ──

    → SELECT Representation
      WHERE date = CURRENT_DATE + 2
        AND status = 'PLANIFIEE'

    → Pour chaque représentation :
        → Calculer les postes non pourvus (même logique qu'ÉTAPE 1 — exclure ANNULEE/ANNULEE_TARDIVE)

        → Si postes_non_pourvus > 0 :
            → Notification CRITIQUE au Régisseur responsable :
              "🔴 Peter Pan · Lun 16/03 — 2 postes non pourvus dans 48h !"
            → Email urgent au Régisseur
            → Notification CRITIQUE au(x) Chef(s) de poste concernés
            → Email urgent au(x) Chef(s) de poste concernés

    ── ÉTAPE 3 — Archivage automatique des feuilles de route ──

    → SELECT FeuilleDeRoute
      JOIN Representation ON Representation.id = FeuilleDeRoute.representationId
      WHERE Representation.date < CURRENT_DATE   ← représentation passée (hier ou avant)
        AND FeuilleDeRoute.statut = 'PUBLIEE'    ← uniquement les publiées actives

    → FeuilleDeRoute.statut = 'ARCHIVEE'
    → Log : "Archivage : X feuilles de route passées → ARCHIVEE"
    ← Pas de notification (action transparente)
```

---

## 21.8 Configuration Vercel Cron

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/relance-confirmation", "schedule": "0 * * * *"      },
    { "path": "/api/cron/alerte-dpae",          "schedule": "0 7 * * *"       },
    { "path": "/api/cron/expiration-trial",     "schedule": "0 8 * * *"       },
    { "path": "/api/cron/nettoyage-tokens",     "schedule": "0 3 * * *"       },
    { "path": "/api/cron/rgpd-anonymisation",   "schedule": "0 2 1 * *"       },
    { "path": "/api/cron/archivage-projets",    "schedule": "0 4 * * 1"       },
    { "path": "/api/cron/alerte-postes",        "schedule": "0 8 * * *"       }
  ]
}
```

**Protection des endpoints :**
```typescript
// app/api/cron/[job]/route.ts
const authHeader = request.headers.get('authorization')
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return new Response('Unauthorized', { status: 401 })
}
```

---

## 21.9 Champs Prisma ajoutés par les crons

| Modèle | Champ | Type | Usage |
|--------|-------|------|-------|
| `Affectation` | `relanceSentAt` | `DateTime?` | Éviter les doublons de relance (§21.1) |
| `Organization` | `trialReminderSentAt` | `DateTime?` | Éviter les doublons d'email J-3 trial (§21.3) |
| `User` | `anonymizedAt` | `DateTime?` | Traçabilité RGPD — date d'anonymisation (§21.5) |
| `User` | `rgpdWarningAt` | `DateTime?` | Éviter les doublons d'avertissement J-30 (§21.5) |
| `Collaborateur` | `anonymizedAt` | `DateTime?` | Données sensibles effacées (NSS, IBAN) — cohérent avec `User.anonymizedAt` (§21.5) |
