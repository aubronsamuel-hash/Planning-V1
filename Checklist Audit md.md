# **✅ Checklist de Mise en Production (Audit Senior)**

## **🔐 Sécurité & Rôles**

* \[ \] Le rôle CHEF\_POSTE ne peut voir que son équipe et pas la rémunération globale (Module 2).  
* \[ \] Les Magic Links expirent bien après usage unique et selon leur purpose : LOGIN 15min · EMAIL\_CHANGE 24h · CONFIRMATION / ACTIVATION / PLANNING\_VIEW 7 jours.  
* \[ \] Les fichiers sensibles (contrats) sont stockés dans des buckets privés (S3/R2) avec URLs signées.

## **💶 Business & Billing**

* \[ \] Le passage en mode "Lecture seule" est effectif si l'abonnement Stripe est impayé.  
* \[ \] La période de Trial (14 jours) déclenche bien un email de rappel à J-3.

## **🎭 Métier (Spectacle)**

* \[ \] Une affectation NON\_REQUISE (CDI) n'envoie pas de mail de confirmation.  
* \[ \] L'annulation d'une représentation (Règle \#26) notifie tous les collaborateurs affectés, quel que soit leur statut de confirmation (y compris EN\_ATTENTE et REFUSEE).  
* \[ \] Le calcul des cachets/heures par mois dans le Dashboard RH correspond aux affectations réelles.

## **🛠️ Technique**

* \[ \] Les logs d'erreurs (Sentry/Logtail) sont actifs en production.  
* \[ \] Backup journalier de la base de données PostgreSQL activé.  
* \[ \] Temps de réponse des API \< 200ms sur les routes critiques (Planning).