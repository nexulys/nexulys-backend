# Accord de sous-traitance (DPA)

> **Modèle à faire valider.** Ce document a été rédigé d'après l'article 28 du RGPD et
> d'après ce que fait réellement le code de cette plateforme. Il n'a pas été rédigé par
> un juriste et ne vaut pas conseil juridique. Faites-le relire par un avocat avant de
> le remettre à un client : les mentions qu'il contient vous engagent contractuellement.
>
> Les champs `<À COMPLÉTER>` doivent l'être avant tout usage.

---

## Entre les parties

**Le responsable de traitement** (« le Client »)
`<RAISON SOCIALE>`, `<FORME JURIDIQUE>` au capital de `<CAPITAL>`, immatriculée au RCS de
`<VILLE>` sous le numéro `<SIRET>`, dont le siège est `<ADRESSE>`.

**Le sous-traitant** (« Nexulys »)
`<RAISON SOCIALE NEXULYS>`, `<FORME JURIDIQUE>`, immatriculée au RCS de `<VILLE>` sous le
numéro `<SIRET>`, dont le siège est `<ADRESSE>`, éditrice de la plateforme Novexa.

Contact pour les questions de protection des données : `<EMAIL DPO OU RÉFÉRENT>`.

## 1. Objet

Le Client confie à Nexulys le traitement de données à caractère personnel dans le cadre
de la fourniture de la plateforme Novexa (gestion commerciale, comptabilité, ressources
humaines, relation client).

Le Client demeure responsable de traitement : il détermine les finalités et les moyens.
Nexulys agit uniquement sur instruction documentée du Client, dont le présent accord et
le contrat de service constituent les instructions initiales.

## 2. Durée

Le présent accord s'applique pendant toute la durée de l'abonnement et jusqu'à
l'effacement complet des données dans les conditions de l'article 9.

## 3. Nature et finalité des traitements

| Finalité | Traitement réalisé |
|---|---|
| Facturation et devis | création, émission, suivi des règlements, relances |
| Comptabilité | dépenses, TVA, rapprochement bancaire, export FEC |
| Ressources humaines | dossiers salariés, bulletins de paie, congés, notes de frais |
| Relation client | prospects, contrats, portail client, signature électronique |
| Facturation électronique | transmission via une plateforme agréée (PDP) |
| Assistance IA | analyse des données de gestion pour restitution de recommandations |

## 4. Catégories de personnes concernées

Salariés du Client, dirigeants et utilisateurs de la plateforme, clients et prospects du
Client, contacts chez les fournisseurs du Client.

## 5. Catégories de données

- **Identification** : nom, prénom, adresse électronique, téléphone, adresse postale
- **Vie professionnelle** : poste, département, date d'embauche, contrat
- **Données économiques** : rémunération, taux de prélèvement à la source, notes de frais
- **Données bancaires** : IBAN
- **Numéro de sécurité sociale (NIR)**, aux seules fins d'établissement des bulletins de paie
- **Données de connexion** : adresse IP, horodatage, journaux d'accès

> Le NIR relève d'un encadrement spécifique en droit français. Son traitement est ici
> limité à la finalité « paie » et son usage à toute autre fin est exclu.

## 6. Sous-traitants ultérieurs

Le Client autorise Nexulys à recourir aux sous-traitants ultérieurs suivants. Nexulys
informe le Client de tout changement projeté, dans un délai lui permettant d'émettre des
objections.

| Sous-traitant | Rôle | Localisation | À compléter |
|---|---|---|---|
| `<HÉBERGEUR>` | hébergement applicatif et base de données | `<PAYS / RÉGION>` | garanties de transfert |
| Stripe | encaissement des abonnements | `<RÉGION>` | clauses contractuelles types |
| `<FOURNISSEUR SMTP>` | acheminement des courriels | `<PAYS>` | |
| `<FOURNISSEUR IA>` | assistant et analyses | `<PAYS>` | sous-traitance, non-entraînement |
| `<PDP>` | facturation électronique | France | agrément DGFiP |

> **Point de vigilance.** Si l'hébergement ou un sous-traitant se situe hors de l'Union
> européenne, un mécanisme de transfert conforme au chapitre V du RGPD est requis
> (clauses contractuelles types et analyse d'impact du transfert). Ce point doit être
> tranché avant toute commercialisation, en particulier pour des données de paie.

## 7. Mesures de sécurité (art. 32)

Mesures effectivement mises en œuvre dans la plateforme :

**Chiffrement**
- IBAN et numéros de sécurité sociale chiffrés au repos en AES-256-GCM, chiffrement
  authentifié (une altération du stockage est détectée, jamais silencieusement acceptée)
- transport en TLS 1.2 minimum, HSTS activé
- sauvegardes chiffrées en AES-256 (PBKDF2, 200 000 itérations), avec empreinte SHA-256

**Contrôle d'accès**
- cloisonnement strict par entreprise sur l'ensemble des accès aux données
- rôles et permissions ; les écritures sur les comptes réservées aux administrateurs
- mots de passe hachés en bcrypt (12 tours) ; jetons de session révocables
- second facteur (TOTP) exigé sur l'administration de la plateforme
- limitation du débit et protection contre la force brute

**Journalisation**
- journal d'audit des actions sensibles, cloisonné par entreprise
- supervision des erreurs applicatives

**Continuité**
- sauvegardes chiffrées avec vérification de lisibilité à la création et rétention
  paramétrable (30 jours par défaut)

## 8. Assistance au Client

Nexulys assiste le Client, compte tenu de la nature du traitement :

- **Droit d'accès et portabilité** : export complet et structuré (JSON) accessible en
  autonomie depuis la plateforme, réservé aux administrateurs du compte
- **Droit à l'effacement** : procédure d'effacement accessible depuis la plateforme,
  décrite à l'article 9
- **Violation de données** : notification au Client dans les meilleurs délais après en
  avoir pris connaissance, avec les éléments utiles à sa propre notification (procédure
  interne : `docs/RGPD-VIOLATION.md`)
- **Analyses d'impact** : fourniture des informations techniques nécessaires

## 9. Sort des données en fin de prestation

Sur demande d'effacement formulée depuis la plateforme :

1. la demande est enregistrée et reste **révocable pendant 30 jours** ;
2. l'export des données reste accessible pendant ce délai ;
3. à l'échéance, les données du Client sont **effacées de manière irréversible** de la
   base active, y compris les dossiers salariés, factures, documents et journaux ;
4. les sauvegardes chiffrées encore en rétention expirent selon leur cycle propre
   (30 jours par défaut), sans réintroduction possible dans la base active.

**Données conservées après effacement.** Nexulys conserve, sous forme pseudonymisée, les
seules données nécessaires à sa propre comptabilité (historique de facturation de
l'abonnement, raison sociale, identifiant), au titre de l'obligation de conservation de
dix ans de l'article L123-22 du code de commerce, laquelle relève de l'exception prévue
à l'article 17.3.b du RGPD. Ces données ne sont plus utilisées à d'autre fin.

Il appartient au Client d'exporter, **avant l'effacement**, les données qu'il doit lui-même
conserver au titre de ses obligations propres (bulletins de paie, pièces comptables).

## 10. Audit

Nexulys met à disposition du Client les informations nécessaires pour démontrer le
respect des obligations du présent accord et permet la réalisation d'audits, dans des
conditions convenues entre les parties et sans compromettre la sécurité des autres
clients de la plateforme.

## 11. Confidentialité

Nexulys garantit que les personnes autorisées à traiter les données s'engagent à la
confidentialité et reçoivent la formation nécessaire.

---

Fait à `<LIEU>`, le `<DATE>`, en deux exemplaires.

| Le Client | Nexulys |
|---|---|
| Nom : | Nom : |
| Qualité : | Qualité : |
| Signature : | Signature : |
