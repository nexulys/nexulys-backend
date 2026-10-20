# Procédure en cas de violation de données

> **Modèle à faire valider.** Établi d'après les articles 33 et 34 du RGPD. Ce n'est pas
> un conseil juridique. En tant que sous-traitant, votre obligation est de **notifier vos
> clients** sans délai injustifié ; c'est à eux, responsables de traitement, de notifier
> la CNIL et, le cas échéant, les personnes concernées.

**Une violation n'est pas seulement un piratage.** C'est toute destruction, perte,
altération, divulgation ou accès non autorisé — y compris accidentel. Une sauvegarde
égarée, un export envoyé au mauvais destinataire ou une base effacée par erreur en sont.

---

## Le délai qui compte

**72 heures** à partir du moment où vous **prenez connaissance** de la violation — pas
du moment où elle s'est produite. Le compte à rebours démarre dès qu'un doute
raisonnable existe, avant même d'en connaître l'étendue. Une notification incomplète
vaut mieux qu'une notification tardive : elle peut être complétée ensuite.

## 1. Contenir (immédiat)

- [ ] Identifier et interrompre la cause (révoquer un accès, isoler un composant, couper un flux)
- [ ] **Ne rien détruire** : les journaux sont la preuve de ce qui s'est passé. Sauvegardez
      immédiatement les journaux applicatifs, nginx et le journal d'audit avant toute rotation.
- [ ] Noter l'heure de découverte, qui a découvert, comment. Cet horodatage fait foi.

## 2. Qualifier (dans les heures qui suivent)

| Question | Où chercher |
|---|---|
| Quelles catégories de données ? | `docs/RGPD-REGISTRE.md` |
| Les IBAN ou NIR sont-ils concernés ? | s'ils proviennent de la base, ils sont chiffrés — voir ci-dessous |
| Combien de personnes concernées ? | comptage par entreprise touchée |
| Quels clients (responsables de traitement) ? | cloisonnement par `company` |
| Données exfiltrées, altérées, ou seulement exposées ? | journaux d'accès, journal d'audit |

**Le chiffrement change l'analyse.** Si la fuite porte sur la base ou une sauvegarde, les
IBAN et NIR y sont chiffrés en AES-256-GCM, et les sauvegardes en AES-256. Une donnée
chiffrée dont la clé n'a pas fuité est considérée comme incompréhensible pour un tiers :
cela peut dispenser de la notification aux personnes concernées (art. 34.3.a) — **à
condition que la clé n'ait pas été compromise en même temps**. D'où la règle : la clé ne
doit jamais être stockée avec les données ni avec les sauvegardes.

Vérifiez donc explicitement : `DATA_ENCRYPTION_KEY` et `BACKUP_PASSPHRASE` ont-elles pu
être exposées ? Si oui, le bénéfice tombe.

## 3. Notifier les clients concernés (sans délai injustifié)

Vous êtes sous-traitant : vous notifiez **le client**, pas la CNIL. Modèle :

> Objet : Notification d'une violation de données — `<DATE>`
>
> Madame, Monsieur,
>
> Nous vous informons d'une violation de données affectant votre compte Novexa.
>
> **Nature** : `<description factuelle, sans minimiser>`
> **Découverte le** : `<date et heure>`
> **Données concernées** : `<catégories>`
> **Personnes concernées** : `<nombre estimé et qualité>`
> **Conséquences probables** : `<analyse>`
> **Mesures prises** : `<containment, correctifs>`
> **Mesures que nous vous recommandons** : `<le cas échéant>`
>
> Contact : `<NOM, EMAIL, TÉLÉPHONE>`
>
> Nous restons à votre disposition pour les éléments nécessaires à votre propre
> notification auprès de la CNIL, qui vous incombe en qualité de responsable de traitement.

## 4. Consigner (obligatoire, même sans notification)

Toute violation doit être documentée, **y compris celle que vous décidez de ne pas
notifier** — la CNIL peut demander à voir ce registre et votre raisonnement.

| Champ | Contenu |
|---|---|
| Date et heure de la violation | |
| Date et heure de la découverte | |
| Nature | |
| Catégories et volume de données | |
| Catégories et nombre de personnes | |
| Conséquences probables | |
| Mesures prises | |
| Clients notifiés, date | |
| Si non notifiée : justification | |

Conservez ce registre avec les documents RGPD, et non dans la base applicative.

## 5. Corriger durablement

- [ ] Corriger la cause racine, pas seulement le symptôme
- [ ] Ajouter un test de non-régression quand la cause est logicielle
- [ ] Faire tourner une rotation de secrets si un secret a pu être exposé (voir ci-dessous)
- [ ] Revoir si la même faiblesse existe ailleurs

## Rotation des secrets

Si un secret a pu fuiter, dans l'ordre :

| Secret | Effet de la rotation | Précaution |
|---|---|---|
| `JWT_SECRET` | déconnecte tous les utilisateurs | sans danger pour les données |
| `ADMIN_SECRET`, `ADMIN_TOTP_SECRET` | réenrôlement de l'administration | `npm run admin:mfa` |
| `BACKUP_PASSPHRASE` | les anciennes archives restent lisibles avec l'ancienne | conserver l'ancienne jusqu'à expiration de la rétention |
| `STRIPE_SECRET_KEY` | à révoquer depuis le tableau de bord Stripe | |
| `DATA_ENCRYPTION_KEY` | **délicat** | voir ci-dessous |

**Ne remplacez jamais `DATA_ENCRYPTION_KEY` sans déchiffrer d'abord.** Les données
chiffrées avec l'ancienne clé deviendraient définitivement illisibles. Une rotation
implique : déchiffrer avec l'ancienne, rechiffrer avec la nouvelle, dans une opération
sauvegardée au préalable et vérifiée.

## Contacts

| Rôle | Nom | Contact |
|---|---|---|
| Référent protection des données | `<À COMPLÉTER>` | |
| Responsable technique | `<À COMPLÉTER>` | |
| Conseil juridique | `<À COMPLÉTER>` | |
| Assurance cyber / RC pro | `<À COMPLÉTER>` | `<n° de police>` |

CNIL — notification en ligne : https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles
