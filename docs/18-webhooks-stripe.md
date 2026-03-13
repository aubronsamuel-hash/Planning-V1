# 💳 Webhooks Stripe
> SaaS Gestion du Spectacle Vivant — [← Index](./README.md)
> **Version :** 12.0 · **Date :** 02/03/2026 · **Statut :** ✅ Spec finale

---

## Concept

Stripe pilote l'état des abonnements via des événements webhook. Notre app ne doit jamais déduire l'état d'un abonnement depuis l'interface — elle réagit aux événements Stripe comme source de vérité unique pour la facturation.

**Principe fondamental :** l'utilisateur change son plan via le Stripe Customer Portal (§16.5) ou le SUPER_ADMIN via le back-office (§17.5.1) — dans les deux cas, Stripe envoie un webhook qui met à jour `Organization.plan` en base. **Jamais l'inverse.**

---

## 18.0 Flux de souscription initiale (trial → abonnement payant)

C'est le flux qui manquait — comment `stripeCustomerId` passe de `NULL` à une vraie valeur.

### Déclencheur

L'org est en trial (`stripeCustomerId IS NULL`). Le Directeur clique sur `[ Choisir un plan → ]` dans `/settings/organisation#facturation` (le bouton Stripe Portal est remplacé par ce CTA tant que `stripeCustomerId IS NULL` — cf. §16.5).

### Flux complet

```
[Directeur clique "Choisir un plan →"]
    │
    ▼
POST /api/billing/checkout
  body: { plan: 'PRO' | 'ENTERPRISE' }
  auth: requireOrgSession('DIRECTEUR')

    → Guard : si stripeCustomerId IS NOT NULL → 409 CONFLICT "Déjà abonné — utiliser le Customer Portal"
    → Création du customer Stripe :
        const customer = await stripe.customers.create({
          email: org.billingEmail ?? session.user.email,
          name:  org.name,
          metadata: { organizationId: org.id }  // ← clé de liaison
        })
    → Sauvegarde IMMÉDIATE en base (avant la Checkout Session — évite les orphelins) :
        await prisma.organization.update({
          where: { id: org.id },
          data: { stripeCustomerId: customer.id }
        })
    → ActivityLog: STRIPE_CUSTOMER_CREATED
    → Création de la Checkout Session :
        const checkoutSession = await stripe.checkout.sessions.create({
          customer:    customer.id,
          mode:        'subscription',
          line_items:  [{ price: plan === 'PRO' ? STRIPE_PRICE_PRO : STRIPE_PRICE_ENTERPRISE, quantity: 1 }],
          // ← ⚠️ price_id doit être sélectionné dynamiquement — ne pas hardcoder STRIPE_PRICE_PRO
          success_url: `${APP_URL}/settings/organisation?checkout=success`,
          cancel_url:  `${APP_URL}/settings/organisation?checkout=cancelled`,
          metadata:    { organizationId: org.id },
          subscription_data: {
            metadata: { organizationId: org.id }  // propagé au webhook subscription.updated
          }
        })
    → Répondre { checkoutUrl: checkoutSession.url }

[Client reçoit checkoutUrl → redirect vers Stripe Checkout]
    │
    ▼
[Stripe Checkout — paiement CB par l'utilisateur]
    │
    ├─ Succès ──→ redirect vers /settings/organisation?checkout=success
    │              → Afficher toast "🎉 Bienvenue en plan PRO !"
    │              → Le plan sera mis à jour par le webhook ci-dessous
    │
    └─ Annulation → redirect vers /settings/organisation?checkout=cancelled
                     → Toast "Souscription annulée."
                     → Organization.plan reste FREE (stripeCustomerId déjà créé — pas de rollback)

[Stripe envoie webhook customer.subscription.updated]
    → Handler §18.3 met à jour Organization.plan = PRO
    → Notification in-app au Directeur
```

### Points critiques

- `stripeCustomerId` est sauvé en base **avant** la redirection Stripe — si l'utilisateur ferme la fenêtre, l'org a un customer Stripe sans abonnement. C'est intentionnel : le Customer Portal fonctionnera dès sa prochaine visite.
- Ne jamais appeler `stripe.customers.create()` deux fois pour la même org — le guard vérifie `stripeCustomerId IS NOT NULL`.
- La sauvegarde du `stripeCustomerId` est **synchrone** dans la route (pas via webhook) — Stripe ne renvoie pas un événement "customer.created" utilisable avant l'abonnement.
- Pour les upgrades/downgrades ultérieurs → Stripe Customer Portal (§16.5) — plus de Checkout Session.

### Route complète

| Méthode | Route | Auth |
|---------|-------|------|
| POST | `/api/billing/checkout` | DIRECTEUR |
| GET | `/api/billing/portal` | DIRECTEUR (génère un lien Customer Portal) |

---

## 18.1 Endpoint

| Méthode | Route | Auth |
|---------|-------|------|
| POST | `/api/webhooks/stripe` | Signature Stripe (`stripe-signature` header) |

**Vérification de signature (obligatoire) :**
```typescript
// app/api/webhooks/stripe/route.ts
const sig = headers().get('stripe-signature')!
const event = stripe.webhooks.constructEvent(
  await req.text(),       // raw body — ne pas parser en JSON avant
  sig,
  process.env.STRIPE_WEBHOOK_SECRET
)
```

> ⚠️ Si la signature est invalide → répondre `400` immédiatement. Ne jamais traiter un payload non signé.
> ⚠️ Utiliser le **raw body** — Next.js doit être configuré pour ne pas parser ce endpoint automatiquement.

**Idempotence :** Stripe peut renvoyer le même événement plusieurs fois. Chaque handler doit être idempotent — vérifier `ActivityLog` ou l'état en base avant d'agir.

---

## 18.2 Événements traités

| Événement Stripe | Déclencheur | Action dans l'app |
|-----------------|-------------|-------------------|
| `customer.subscription.updated` | Upgrade / downgrade de plan | Mettre à jour `Organization.plan` |
| `customer.subscription.deleted` | Résiliation (fin de période ou immédiate) | Passer l'org en `FREE` ou suspendre |
| `invoice.payment_failed` | Échec de paiement (carte expirée, fonds insuffisants…) | Notifier le Directeur + alerte admin |
| `invoice.payment_succeeded` | Paiement réussi (renouvellement mensuel) | Confirmer le plan, lever la suspension si applicable |
| `invoice.finalized` | Facture émise | Log ActivityLog (pas d'action UI requise) |
| `customer.subscription.trial_will_end` | 3 jours avant fin du trial PRO | Email de conversion au Directeur |

---

## 18.3 Handler — `customer.subscription.updated`

Déclenché quand le plan change (upgrade, downgrade, ou annulation programmée).

```
[Stripe → POST /api/webhooks/stripe]
    event.type = "customer.subscription.updated"

    → Extraire stripeCustomerId = event.data.object.customer
    → Trouver Organization par stripeCustomerId
    → Lire event.data.object.items.data[0].price.id
        → Mapper le price_id vers un plan applicatif :
            PRO_PRICE_ID        → OrganizationPlan.PRO
            ENTERPRISE_PRICE_ID → OrganizationPlan.ENTERPRISE
            (price_id inconnu ou subscription annulée → géré par subscription.deleted §18.4)
        → Si price_id ne correspond à aucun plan connu → log d'erreur + alerter SUPER_ADMIN, ne pas modifier Organization.plan
    → Mettre à jour Organization.plan
    → Si nouveau plan = PRO ou ENTERPRISE :
        → Organization.isReadOnly = false  ← ⚠️ toujours remettre à false — l'org avait pu être isReadOnly suite à un passage en FREE
    → Si nouveau plan = FREE → vérifier les quotas (règle #28) :
        → nbCollabs = COUNT(OrganizationMembership WHERE organizationId = org.id AND role = 'COLLABORATEUR')
        → Si nbCollabs > 3 → Organization.isReadOnly = true
        → Sinon → Organization.isReadOnly = false
    → ActivityLog: PLAN_CHANGED (source: "stripe_webhook", stripeEventId)
    → Notification in-app au Directeur :
        Upgrade → "Votre plan a été mis à jour vers PRO. Bonne production ! 🎭"
        Downgrade → "Votre plan a été réduit à FREE."
    → Répondre 200 { received: true }
```

**Mapping price_id → plan :** stocké dans les variables d'environnement, pas en dur dans le code.
```env
STRIPE_PRICE_PRO=price_yyy
STRIPE_PRICE_ENTERPRISE=price_zzz
# FREE n'a pas de price_id Stripe — pas d'abonnement Stripe pour ce plan
# La résiliation (→ FREE) est traitée par subscription.deleted (§18.4), pas ici
```

---

## 18.4 Handler — `customer.subscription.deleted`

Déclenché quand l'abonnement est résilié (fin de période ou annulation immédiate).

```
event.type = "customer.subscription.deleted"

    → Trouver Organization par stripeCustomerId
    → Décision selon la politique choisie :
        Option A (RECOMMANDÉE) : rétrograder vers FREE
            → Organization.plan = FREE
            → nbCollabs = COUNT(OrganizationMembership WHERE organizationId = org.id AND role = 'COLLABORATEUR')
              ← org.collaborateurCount n'est pas un champ DB — toujours calculer via COUNT()
            → Si nbCollabs > 3 → Organization.isReadOnly = true
            → Notification Directeur : "Votre abonnement a expiré. Vous êtes passé en plan Découverte."
        Option B : suspendre l'organisation
            → Organization.suspendedAt = now()
            → Organization.suspendedReason = "Abonnement résilié"
    → ActivityLog: SUBSCRIPTION_CANCELLED
    → Répondre 200
```

> **Décision retenue :** Option A (dégradation douce → FREE). L'org perd les fonctionnalités PRO/ENTERPRISE mais garde l'accès en lecture seule si les quotas FREE sont dépassés (`isReadOnly = true`).

---

## 18.5 Handler — `invoice.payment_failed`

Déclenché à chaque tentative de débit échouée. Stripe réessaie automatiquement (J+3, J+5, J+7 selon la config Stripe). Après épuisement des tentatives, `subscription.deleted` est envoyé.

```
event.type = "invoice.payment_failed"

    → Trouver Organization par stripeCustomerId
    → Lire event.data.object.attempt_count (nombre de tentatives)

    → Toujours (toutes tentatives) :
        → Organization.paymentFailedAt = now()   ← signal back-office
        → ActivityLog: PAYMENT_FAILED (attempt_count, invoiceId)  ← ⚠️ loguer dès la 1ère tentative

    → Si attempt_count = 1 (premier échec) :
        → Email au billingEmail : "Votre paiement a échoué — vérifiez votre moyen de paiement"
        → Notification in-app au Directeur
        → Alerte dans le back-office admin (badge 🔴 sur la fiche org)

    → Si attempt_count >= 2 :
        → Email de relance + lien Stripe Customer Portal pour mettre à jour la carte

    → Répondre 200
```

**Alerte admin :** ajouter `Organization.paymentFailedAt: DateTime?` au modèle pour permettre au back-office de lister les orgs en échec de paiement (cf. §17.3 alertes système).

---

## 18.6 Handler — `invoice.payment_succeeded`

Déclenché à chaque paiement réussi (renouvellement mensuel ou reprise après échec).

```
event.type = "invoice.payment_succeeded"

    → Trouver Organization par stripeCustomerId
    → Remettre à zéro Organization.paymentFailedAt = null (si précédemment en échec)
    → Si Organization.suspendedReason = "Abonnement résilié" → lever la suspension :
        Organization.suspendedAt = null
        Organization.suspendedReason = null
        Notification Directeur : "Votre accès a été rétabli."
    → ActivityLog: PAYMENT_SUCCEEDED (invoiceId, amount)
    → Répondre 200
```

---

## 18.7 Handler — `customer.subscription.trial_will_end`

**Durée du trial :** 14 jours sur le plan PRO (voir `20-plans-tarifaires.md §20.3`).

Stripe envoie cet événement 3 jours avant la fin du trial.

```
event.type = "customer.subscription.trial_will_end"

    → Trouver Organization par stripeCustomerId
    → Calculer le nombre de jours restants : Math.ceil((trialEnd - now) / 86400)
    → Email de conversion au Directeur (billingEmail) :
        "Votre essai PRO se termine dans 3 jours.
         Pour continuer sans interruption, choisissez un plan."
        + CTA → lien Stripe Customer Portal
        + Rappel des avantages PRO vs FREE
    → Notification in-app URGENT au Directeur :
        "⏳ Votre essai gratuit se termine dans 3 jours"
    → ActivityLog: TRIAL_ENDING_SOON (trialEndsAt)
    → Répondre 200
```

> **⚠️ Note :** Le trial est **100% app-side** — `stripeCustomerId IS NULL` pendant toute la durée du trial, donc aucun client Stripe n'existe pour déclencher `customer.subscription.trial_will_end`. **Ce handler ne se déclenchera jamais pour un trial en cours.** Le J-3 et l'expiration du trial sont gérés exclusivement par le cron `§21.3`. Ce handler s'applique uniquement si une migration vers les trials Stripe natifs est implémentée ultérieurement.

---

## 18.8 Impact sur le schéma Prisma

Deux champs supplémentaires à ajouter à `Organization` :

```prisma
model Organization {
  // ... champs existants ...
  paymentFailedAt DateTime? // null = paiements OK · non-null = dernier échec
  trialEndsAt     DateTime? // null si pas de trial actif
}
```

> ✅ Ces champs sont déjà présents dans `05-data-models.md` et `15-schema-prisma.md`.

---

## 18.9 Configuration Stripe (checklist)

Avant la mise en production :

- [ ] Créer l'endpoint webhook dans le dashboard Stripe → `https://[domaine]/api/webhooks/stripe`
- [ ] Sélectionner les événements : `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`, `invoice.finalized`, `customer.subscription.trial_will_end`
- [ ] Copier le `STRIPE_WEBHOOK_SECRET` dans les variables d'environnement
- [ ] Configurer les relances de paiement dans Stripe (Smart Retries recommandé)
- [x] ~~Configurer la durée du trial PRO dans le dashboard Stripe~~ — **sans objet** : le trial est 100% app-side (`stripeCustomerId IS NULL` pendant le trial, Stripe n'est pas impliqué — cf. §18.7 et §21.3)
- [ ] Tester avec la CLI Stripe en local : `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

---

## 18.10 Routes

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/webhooks/stripe` | Réception et dispatch des événements Stripe |

> Une seule route qui dispatche vers les handlers selon `event.type`. Pas de routes séparées par type d'événement.

---

## 18.11 Questions ouvertes

- **Webhooks idempotents — stockage des event IDs :** actuellement on se base sur l'état en base (si `Organization.plan === PRO` et le webhook demande PRO → no-op). Pour une garantie stricte, stocker les `stripeEventId` traités dans une table dédiée.
- **Métriques MRR temps réel :** brancher sur `invoice.payment_succeeded` pour alimenter une table de revenus.
- **Alertes Slack :** envoyer un message Slack à l'équipe sur `invoice.payment_failed` et `customer.subscription.deleted`.
