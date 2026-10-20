# Conditions générales d'utilisation et de service — Novexa

> **Projet en cours de création — document non applicable en l'état.**
> L'entreprise n'est pas immatriculée. Les articles relatifs à la vente, à la
> facturation et aux abonnements (articles 5 à 7) n'entreront en vigueur qu'à
> l'immatriculation et à l'ouverture commerciale du Service, en même temps que le
> passage de `VENTE_ACTIVE` à `true` (voir `config/vente.js`). Les champs marqués
> « À COMPLÉTER À L'IMMATRICULATION » doivent être renseignés avant toute mise en
> ligne de ce document, et l'ensemble relu par un avocat.

**Éditeur** : Nexulys — activité en cours de création, non encore immatriculée.
Forme sociale, capital, numéro RCS et numéro de TVA intracommunautaire :
À COMPLÉTER À L'IMMATRICULATION.
**Siège** : Saint-Étienne, France. Adresse complète : À COMPLÉTER À L'IMMATRICULATION.
**Directeur de la publication** : Ethane Mendy.
**Contact** : nexulyspro2002@gmail.com
**Hébergeurs** : Render Services, Inc. (application et base de données),
525 Brannan Street, Suite 300, San Francisco, CA 94107, États-Unis — et
Cloudflare, Inc. (interface web), 101 Townsend Street, San Francisco, CA 94107,
États-Unis.

**Version 1.1 — projet, non applicable avant immatriculation.**

> **Document à faire valider par un avocat avant mise en ligne.** Il a été rédigé
> d'après le fonctionnement réel du service, mais il vous engage contractuellement
> envers vos clients. Les identités, numéros et adresses ci-dessus sont fictifs et
> doivent être remplacés par les vôtres.

---

## Article 1 — Objet

Les présentes conditions régissent l'accès et l'utilisation de la plateforme Novexa,
solution logicielle en ligne (SaaS) d'automatisation comptable et de gestion des
ressources humaines assistée par intelligence artificielle, éditée par Nexulys.

Toute souscription emporte acceptation sans réserve des présentes. Elles prévalent sur
tout document contraire émanant du Client, y compris ses conditions générales d'achat.

## Article 2 — Définitions

- **Client** : la personne morale souscrivant l'abonnement.
- **Utilisateur** : la personne physique accédant au Service sous les identifiants du
  Client.
- **Service** : la plateforme Novexa, ses interfaces, ses API et ses traitements.
- **Contenus Client** : les données, documents et fichiers téléversés ou générés par
  le Client dans le Service.
- **Traitements IA** : les analyses, extractions et suggestions produites par les
  modèles d'intelligence artificielle intégrés au Service.

## Article 3 — Souscription et compte

3.1. Le Service est réservé aux professionnels agissant dans le cadre de leur activité.
Il n'est pas accessible aux consommateurs au sens du code de la consommation.

3.2. Le Client garantit l'exactitude des informations fournies à la souscription et
s'engage à les tenir à jour.

3.3. Le Client est responsable de la confidentialité des identifiants de ses
Utilisateurs et de toute action effectuée depuis son compte. Il informe sans délai
Nexulys de tout accès non autorisé dont il aurait connaissance.

3.4. Le Client désigne un Utilisateur titulaire du rôle Propriétaire, seul habilité à
souscrire, résilier et demander l'effacement des données.

## Article 4 — Essai gratuit

4.1. Le Service est accessible en essai gratuit pendant quatorze (14) jours, sans
communication de moyen de paiement.

4.2. À l'issue de l'essai, à défaut de souscription, l'accès en écriture est suspendu.
Cette suspension ne s'applique pas pendant la phase de pré-lancement : tant que la
souscription n'est pas ouverte, aucun compte n'est restreint pour défaut de paiement.
Les Contenus Client demeurent consultables et exportables pendant trente (30) jours,
puis sont supprimés.

## Article 5 — Offres et tarifs

5.1. Le Service est proposé selon trois offres, aux tarifs mensuels hors taxes
suivants. Cette table reproduit `config/plans.js`, source unique des tarifs appliqués
par le Service et par le prestataire de paiement ; un test automatisé en vérifie la
concordance.

| Offre | Tarif | Utilisateurs | Salariés |
|---|---|---|---|
| Starter | 39 € | 1 | 0 |
| Business | 89 € | 10 | 25 |
| Pro | 199 € | illimité | illimité |

5.2. Les limites portent sur le nombre d'utilisateurs et de salariés enregistrés. Le
Service ne décompte ni les écritures comptables, ni les documents traités par
intelligence artificielle, et ne facture aucun dépassement à l'unité.

5.3. La facturation est mensuelle. Aucun engagement de durée n'est exigé.

5.4. Nexulys peut modifier ses tarifs moyennant un préavis de deux (2) mois notifié par
courrier électronique. Le Client qui refuse peut résilier sans frais avant l'entrée en
vigueur des nouveaux tarifs.

## Article 6 — Facturation et paiement

6.1. L'abonnement est payable d'avance, par prélèvement ou carte bancaire, via le
prestataire Stripe Payments Europe Ltd. Aucune donnée de carte bancaire ne transite ni
n'est conservée par Nexulys.

6.2. L'accès aux fonctionnalités payantes n'est ouvert qu'après encaissement effectif
du premier paiement.

6.3. En cas d'échec de paiement, Nexulys en informe le Client. À défaut de
régularisation sous quinze (15) jours, l'accès en écriture est suspendu, l'accès en
lecture et l'export demeurant ouverts.

6.4. Conformément à l'article L441-10 du code de commerce, tout retard de paiement
entraîne de plein droit des pénalités au taux de trois fois le taux d'intérêt légal,
ainsi qu'une indemnité forfaitaire de recouvrement de 40 €.

## Article 7 — Durée et résiliation

7.1. L'abonnement est souscrit pour un mois ou un an, renouvelable par tacite
reconduction.

7.2. Le Client peut résilier à tout moment depuis son espace. La résiliation prend
effet au terme de la période en cours, sans remboursement au prorata.

7.3. Nexulys peut résilier en cas de manquement grave du Client, après mise en demeure
restée sans effet quinze (15) jours.

7.4. À la résiliation, le Client dispose de trente (30) jours pour exporter ses
Contenus. Au-delà, ils sont supprimés dans les conditions de l'article 12.

## Article 8 — Disponibilité et maintenance

8.1. Nexulys s'engage à un taux de disponibilité mensuel de 99,5 % pour les offres
Starter et Business, et de 99,9 % pour l'offre Pro, hors maintenances planifiées.

8.2. Les maintenances planifiées sont annoncées au moins quarante-huit (48) heures à
l'avance et programmées en dehors des heures ouvrées françaises.

8.3. En cas de manquement à l'engagement de disponibilité, le Client peut demander un
avoir égal à 5 % de la mensualité par tranche de 0,1 % en dessous du seuil, plafonné à
30 % de la mensualité concernée.

## Article 9 — Traitements par intelligence artificielle

9.1. **Nature des Traitements IA.** Le Service met en œuvre des modèles d'intelligence
artificielle pour extraire des informations de documents, proposer des écritures
comptables, contrôler des bulletins de paie et produire des analyses.

9.2. **Caractère non décisionnel.** Les résultats des Traitements IA constituent des
propositions. Aucune écriture comptable, aucun bulletin de paie et aucune déclaration
ne sont enregistrés ni transmis sans validation humaine par un Utilisateur habilité.

9.3. **Absence de garantie d'exactitude.** Les Traitements IA peuvent produire des
résultats inexacts ou incomplets. Le Client demeure seul responsable de la vérification
des propositions avant validation, ainsi que de la régularité de sa comptabilité, de sa
paie et de ses déclarations.

9.4. **Absence de conseil.** Le Service ne constitue ni un conseil comptable, ni un
conseil juridique, ni un conseil fiscal, ni un conseil en droit social. Il ne remplace
pas l'intervention d'un expert-comptable, d'un commissaire aux comptes ou d'un avocat.
Nexulys n'est pas inscrite à l'Ordre des experts-comptables et n'exerce aucune activité
réglementée au sens de l'ordonnance du 19 septembre 1945.

9.5. **Sous-traitants IA.** Les Traitements IA sont opérés via Anthropic Ireland
Limited. Les Contenus Client transmis ne sont pas utilisés pour l'entraînement de
modèles.

## Article 10 — Obligations du Client

10.1. Le Client s'engage à utiliser le Service conformément aux présentes, à la
réglementation applicable et aux droits des tiers.

10.2. Il garantit disposer des droits et bases légales nécessaires au téléversement des
Contenus Client, notamment s'agissant des données personnelles de ses salariés et de
ses clients.

10.3. Il s'interdit de porter atteinte à la sécurité du Service, de contourner les
limitations techniques, d'effectuer des tests d'intrusion sans autorisation écrite
préalable, ou d'extraire massivement les données du Service par des moyens automatisés
non prévus par l'API.

10.4. Le Client conserve la responsabilité de ses obligations légales de conservation,
notamment la conservation des pièces comptables pendant dix ans (article L123-22 du
code de commerce) et des bulletins de paie pendant cinq ans (article L3243-4 du code du
travail). Il lui appartient d'exporter les documents correspondants.

## Article 11 — Propriété intellectuelle

11.1. Le Service, ses composants logiciels, ses interfaces et sa documentation demeurent
la propriété exclusive de Nexulys. Le Client bénéficie d'un droit d'usage personnel,
non exclusif et non cessible, pour la durée de son abonnement.

11.2. Les Contenus Client demeurent la propriété exclusive du Client. Nexulys ne
dispose que des droits nécessaires à l'exécution du Service.

11.3. Nexulys peut produire des statistiques agrégées et anonymisées, ne permettant ni
directement ni indirectement d'identifier le Client ou une personne physique, à des
fins d'amélioration du Service.

## Article 12 — Données personnelles

12.1. Dans le cadre du Service, le Client agit en qualité de responsable de traitement
et Nexulys en qualité de sous-traitant au sens du RGPD. Les conditions de cette
sous-traitance figurent dans l'accord de sous-traitance annexé aux présentes.

12.2. Le traitement des données des Utilisateurs par Nexulys pour son propre compte est
décrit dans la Politique de confidentialité.

12.3. Le Client peut demander à tout moment l'effacement de ses données depuis son
espace. La demande est révocable pendant trente (30) jours, à l'issue desquels
l'effacement est irréversible. Nexulys conserve, sous forme pseudonymisée, les seules
données nécessaires à sa propre comptabilité.

## Article 13 — Sécurité

13.1. Nexulys met en œuvre des mesures techniques et organisationnelles appropriées :
chiffrement des données bancaires et des numéros de sécurité sociale au repos,
chiffrement en transit, cloisonnement des données par Client, authentification à
double facteur sur les accès d'administration, journalisation des actions sensibles et
sauvegardes chiffrées.

13.2. Nexulys notifie le Client de toute violation de données le concernant dans les
meilleurs délais après en avoir pris connaissance, et lui fournit les éléments
nécessaires à ses propres obligations de notification.

## Article 14 — Responsabilité

14.1. Nexulys est tenue d'une obligation de moyens dans la fourniture du Service.

14.2. La responsabilité de Nexulys ne saurait être engagée en cas de faute du Client ou
d'un Utilisateur, de validation par le Client d'une proposition inexacte d'un Traitement
IA, de données erronées fournies par le Client, de force majeure, ou de défaillance
d'un réseau ou d'un service tiers.

14.3. La responsabilité de Nexulys, toutes causes confondues, est plafonnée au montant
hors taxes effectivement payé par le Client au titre des douze (12) mois précédant le
fait générateur.

14.4. Nexulys ne répond pas des dommages indirects, notamment perte d'exploitation,
perte de chiffre d'affaires, perte de clientèle, ni des redressements, majorations ou
pénalités prononcés par une administration.

14.5. Les limitations du présent article ne s'appliquent ni en cas de faute lourde ou
dolosive, ni en cas de dommage corporel, ni dans les cas où la loi les écarte.

## Article 15 — Assurance

Nexulys déclare être titulaire d'une police d'assurance de responsabilité civile
professionnelle couvrant les conséquences pécuniaires de sa responsabilité, souscrite
auprès d'un assureur notoirement solvable.

## Article 16 — Sous-traitance et cession

16.1. Nexulys peut recourir à des sous-traitants pour l'hébergement, le paiement,
l'acheminement des messages et les traitements IA. Elle demeure responsable de leur
exécution.

16.2. Le Client ne peut céder son abonnement sans accord écrit préalable de Nexulys,
sauf dans le cadre d'une opération de restructuration interne.

## Article 17 — Modification des présentes

Nexulys peut modifier les présentes. Toute modification substantielle est notifiée au
Client par courrier électronique avec un préavis de trente (30) jours. Le Client qui
refuse peut résilier sans frais avant l'entrée en vigueur.

## Article 18 — Droit applicable et juridiction

18.1. Les présentes sont soumises au droit français.

18.2. En cas de litige, les parties s'efforcent de trouver une solution amiable. À
défaut d'accord dans un délai de trente (30) jours, **le litige est porté devant le
tribunal de commerce du ressort du siège social (À COMPLÉTER À L'IMMATRICULATION)**, y compris en cas de pluralité de défendeurs
ou d'appel en garantie.

---

*Nexulys — activité en cours de création — Version 1.1, projet non applicable avant immatriculation.*
