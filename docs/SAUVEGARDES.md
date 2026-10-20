# Sauvegardes et restauration

Novexa héberge la comptabilité, la paie et les factures d'entreprises clientes. Une
perte de base sans restauration possible mettrait fin à l'activité et engagerait votre
responsabilité vis-à-vis de vos clients. Ce document décrit la procédure en place.

## Prérequis

| Variable | Rôle |
|---|---|
| `MONGODB_URI` | base à sauvegarder |
| `BACKUP_PASSPHRASE` | **requis** — chiffre l'archive (AES-256, PBKDF2 200 000 itérations) |
| `BACKUP_DIR` | répertoire local (défaut `./backups`) |
| `BACKUP_RETENTION_DAYS` | rétention locale (défaut 30) |
| `BACKUP_REMOTE` | destination `rclone` (ex. `s3:novexa-backups`) |

Outils : `mongodump` / `mongorestore` (paquet `mongodb-database-tools`), `openssl`, et
`rclone` pour la copie distante.

> **Trois secrets, trois emplacements distincts.** `BACKUP_PASSPHRASE` protège
> l'archive, `DATA_ENCRYPTION_KEY` protège les IBAN et numéros de sécurité sociale
> à l'intérieur. Stocker l'un ou l'autre à côté des sauvegardes annule la protection ;
> les perdre rend les données définitivement illisibles.

## Sauvegarder

```bash
npm run backup
```

Le script exporte la base, chiffre l'archive, **vérifie qu'elle est déchiffrable**,
calcule son empreinte SHA-256, l'envoie au stockage distant si configuré, puis purge
les archives au-delà de la rétention. Il s'arrête en erreur si l'export est vide ou
suspect — une sauvegarde silencieusement vide est pire que pas de sauvegarde.

## Restaurer

```bash
RESTORE_URI="mongodb://localhost:27017/novexa_restauration" \
  npm run restore -- backups/novexa-20260101T030000Z.archive.enc
```

La destination est toujours explicite : le script ne restaure jamais sur
`MONGODB_URI` par défaut. Viser la production exige `CONFIRMER_PRODUCTION=oui`.

L'empreinte est vérifiée avant toute écriture. `mongorestore --drop` **remplace** les
collections restaurées : restaurez d'abord sur une base de contrôle, vérifiez, puis
basculez.

Après restauration, `DATA_ENCRYPTION_KEY` doit être celle en vigueur au moment de la
sauvegarde, sinon les IBAN et NIR resteront illisibles.

## Automatisation

Sauvegarde quotidienne à 3 h, via la crontab de l'utilisateur applicatif :

```cron
0 3 * * * cd /srv/novexa && /usr/bin/npm run backup >> /var/log/novexa-backup.log 2>&1
```

Ne faites pas exécuter la sauvegarde par un service externe (CI, runner partagé) :
cela lui donnerait un accès direct à la base de production et ferait transiter des
données clients hors de votre infrastructure.

## Points de vigilance

- **Une sauvegarde sur la même machine que la base ne protège de rien.** Configurez
  `BACKUP_REMOTE` vers un stockage distinct — et, pour des données de paie françaises,
  hébergé dans l'Union européenne.
- **Testez la restauration tous les trimestres** sur une base de contrôle. Une
  sauvegarde jamais restaurée est une hypothèse, pas une garantie.
- **Surveillez les échecs.** Le script sort en code non nul ; faites-le remonter
  (alerte mail, supervision) plutôt que de découvrir la panne le jour de l'incident.
- **Durée de conservation.** 30 jours par défaut ; la conservation doit rester
  proportionnée à la finalité (RGPD art. 5.1.e) tout en couvrant vos obligations
  comptables.

## Vérifier une sauvegarde sans la restaurer

```bash
cd backups && sha256sum -c novexa-<horodatage>.archive.enc.sha256
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in novexa-<horodatage>.archive.enc -pass env:BACKUP_PASSPHRASE | head -c 512 | file -
```
