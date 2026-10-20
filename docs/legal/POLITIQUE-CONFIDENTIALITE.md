# Politique de confidentialité — Novexa

**Responsable de traitement** : Nexulys — activité en cours de création, non encore
immatriculée. Siège : Saint-Étienne, France. Forme sociale, adresse complète et
numéro RCS : À COMPLÉTER À L'IMMATRICULATION.
**Contact protection des données** : nexulyspro2002@gmail.com
**Délégué à la protection des données** : aucun DPO désigné à ce jour. La désignation
d'un DPO n'est pas obligatoire pour une structure de cette taille (RGPD art. 37), mais
le traitement de données de paie et de candidatures justifie de l'envisager avant
l'ouverture commerciale.

**Version 1.1 — projet, non applicable avant immatriculation.**

> **Document à faire valider par un avocat avant mise en ligne.** Les identités et
> coordonnées ci-dessus sont fictives et doivent être remplacées par les vôtres. La
> désignation d'un délégué à la protection des données est ici présentée comme
> effective : ne publiez cette mention que si la désignation a réellement été faite
> auprès de la CNIL.

---

## 1. Deux rôles distincts, à ne pas confondre

Cette politique décrit deux situations différentes.

**Nexulys agit comme responsable de traitement** pour les données qu'elle traite pour
son propre compte : comptes des utilisateurs, facturation de l'abonnement, sécurité de
la plateforme, prospection commerciale. Ce sont ces traitements que décrit la présente
politique.

**Nexulys agit comme sous-traitant** pour les données que ses clients déposent dans le
Service : données de leurs salariés, de leurs clients, de leurs fournisseurs. Dans ce
cas, c'est le client qui détermine les finalités, et les conditions sont fixées par
l'accord de sous-traitance conclu avec lui. Si vous êtes salarié d'une entreprise
cliente et souhaitez exercer vos droits sur vos données de paie, adressez-vous à votre
employeur, qui en est le responsable.

## 2. Données traitées par Nexulys pour son propre compte

| Catégorie | Données | Finalité | Base légale | Conservation |
|---|---|---|---|---|
| Compte utilisateur | nom, prénom, adresse électronique professionnelle, rôle, mot de passe (condensat) | fourniture du Service, authentification | exécution du contrat | durée du contrat + 30 jours |
| Facturation | raison sociale, SIREN, adresse, historique de paiement | facturation, obligations comptables | obligation légale | 10 ans (art. L123-22 code de commerce) |
| Journal d'audit | identifiant utilisateur, action, date, adresse IP, agent utilisateur | sécurité, preuve, résolution d'incident | intérêt légitime | 365 jours |
| Journaux techniques | adresse IP, horodatage, chemin appelé, code de réponse | supervision, sécurité | intérêt légitime | rotation continue, 5 fichiers |
| Support | contenu des échanges, pièces jointes | traitement des demandes | exécution du contrat | 3 ans après le dernier échange |
| Prospection | nom, fonction, adresse électronique professionnelle, entreprise | démarchage commercial B2B | intérêt légitime | 3 ans sans réponse |

Nous ne traitons aucune donnée de carte bancaire : les paiements sont opérés par
Stripe, qui les collecte directement.

## 3. Données sensibles déposées par nos clients

Dans le cadre de la paie, le Service traite des numéros de sécurité sociale (NIR) et
des coordonnées bancaires (IBAN) de salariés. Ces données sont **chiffrées au repos**
(AES-256-GCM), leur usage est restreint à la production des bulletins, et elles ne sont
accessibles qu'aux utilisateurs habilités du client concerné.

Le NIR relève en droit français d'un encadrement spécifique. Il n'est utilisé à aucune
autre fin que l'établissement des bulletins de paie et des déclarations sociales.

## 4. Destinataires et sous-traitants

Vos données ne sont ni vendues, ni louées, ni cédées à des tiers à des fins
publicitaires. Elles sont accessibles aux personnels habilités de Nexulys, soumis à une
obligation de confidentialité, et aux sous-traitants suivants :

| Sous-traitant | Rôle | Localisation des données |
|---|---|---|
| Render Services, Inc. | hébergement de l'application et de la base de données | États-Unis |
| Cloudflare, Inc. | hébergement de l'interface web, sécurité réseau | États-Unis |
| MongoDB, Inc. (Atlas) | base de données managée, le cas échéant | selon la région retenue |
| Stripe Payments Europe Ltd | encaissement des abonnements | Irlande |
| OpenAI | traitements d'intelligence artificielle | États-Unis |
| Resend, ou le prestataire SMTP retenu | acheminement des courriers électroniques | selon le prestataire |

Cette table doit refléter la pile réellement déployée : un sous-traitant omis, et des
données personnelles partent chez un destinataire non déclaré. L'entité contractante
exacte d'OpenAI et les clauses applicables sont à confirmer à la signature du DPA.

Chacun est lié par un accord conforme à l'article 28 du RGPD.

## 5. Transferts hors Union européenne

Les traitements décrits ci-dessus sont réalisés au sein de l'Union européenne. En cas
de recours ponctuel à un support technique situé hors de l'Union, le transfert est
encadré par les clauses contractuelles types adoptées par la Commission européenne, et
la présente politique est mise à jour.

## 6. Intelligence artificielle

Les documents et données que vous confiez au Service peuvent être soumis à des modèles
d'intelligence artificielle pour en extraire des informations et produire des
propositions.

- Ces traitements sont opérés par Anthropic Ireland Limited, au sein de l'Union
  européenne.
- **Vos contenus ne sont pas utilisés pour entraîner des modèles.**
- Les propositions produites sont soumises à validation humaine : aucune décision
  produisant des effets juridiques n'est prise sur le seul fondement d'un traitement
  automatisé, au sens de l'article 22 du RGPD.

## 7. Sécurité

Nous mettons en œuvre :

- le chiffrement des IBAN et NIR au repos (AES-256-GCM, chiffrement authentifié) ;
- le chiffrement des communications (TLS 1.2 minimum) ;
- le cloisonnement strict des données entre clients, appliqué au niveau du code et du
  moteur de base de données ;
- le hachage des mots de passe (bcrypt) et l'authentification à double facteur sur les
  accès d'administration ;
- des sauvegardes chiffrées, dont la lisibilité est vérifiée à chaque création ;
- la journalisation des actions sensibles.

## 8. Vos droits

Vous disposez des droits d'accès, de rectification, d'effacement, de limitation,
d'opposition et de portabilité, ainsi que du droit de définir des directives relatives
au sort de vos données après votre décès.

**Comment les exercer** : écrivez à nexulyspro2002@gmail.com. Nous répondons dans un délai d'un
mois, prolongeable de deux mois en cas de demande complexe. Une pièce d'identité peut
vous être demandée en cas de doute raisonnable sur votre identité.

**Export et effacement en autonomie** : si vous êtes titulaire d'un compte client, vous
pouvez exporter l'intégralité de vos données et demander leur effacement directement
depuis votre espace, sans passer par nous. L'effacement est révocable pendant trente
jours, puis irréversible.

**Réclamation** : vous pouvez introduire une réclamation auprès de la Commission
nationale de l'informatique et des libertés — 3 place de Fontenoy, TSA 80715, 75334
Paris Cedex 07 — www.cnil.fr.

## 9. Prospection commerciale

Nous adressons des messages de prospection à des professionnels, sur leur adresse
électronique professionnelle, pour des produits en rapport avec leurs fonctions. Cette
prospection repose sur notre intérêt légitime, conformément à la position de la CNIL en
matière de prospection B2B.

Chaque message comporte un moyen de désinscription immédiat et gratuit. Vous pouvez
également vous opposer à tout moment en écrivant à nexulyspro2002@gmail.com : votre adresse est
alors inscrite sur notre liste d'opposition, conservée à cette seule fin.

## 10. Cookies et traceurs

Le Service utilise exclusivement des cookies strictement nécessaires à son
fonctionnement : cookie de session authentifiée (durée 7 jours) et cookie de sécurité
contre la falsification de requêtes. Ces cookies sont exemptés de consentement au sens
de l'article 82 de la loi Informatique et Libertés.

Le site vitrine utilise une mesure d'audience en configuration exemptée de consentement
(Matomo, auto-hébergé, adresses IP tronquées, aucun recoupement, durée de vie 13 mois).

Nous n'utilisons aucun cookie publicitaire, aucun traceur tiers de réseau social et
aucun outil de suivi comportemental.

## 11. Modification de la présente politique

Toute modification substantielle est notifiée aux titulaires de compte par courrier
électronique, avec un préavis de trente jours. La version en vigueur est datée en tête
du présent document.

---

*Nexulys — activité en cours de création — Version 1.1, projet non applicable avant immatriculation — nexulyspro2002@gmail.com*
