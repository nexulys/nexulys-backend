# Quand la connexion « ne fait rien »

Le symptôme est toujours le même — on clique sur « Se connecter » et rien ne se produit —
mais il recouvre cinq pannes distinctes, qui n'ont ni la même cause ni le même remède.
Ce document sert à les séparer en deux minutes.

## Première chose à faire

Ouvrez **`/diagnostic.html`** sur le site (le lien figure sous le formulaire de
connexion : « La connexion ne fonctionne pas ? »).

Cette page s'exécute dans votre navigateur et teste la chaîne complète : joignabilité du
serveur, autorisation de l'origine, état de la base, réponse de la route de connexion.
Elle nomme le maillon fautif et le réglage à corriger. Le serveur ne peut pas faire ce
diagnostic lui-même : les deux pannes les plus fréquentes ne se constatent que depuis le
poste client.

Pour tester un autre backend : `/diagnostic.html?api=https://autre-domaine`. L'hôte visé
doit figurer dans la directive `connect-src` de `public/_headers`, sinon le navigateur
bloque l'appel avant même qu'il parte — ce paramètre sert à viser une préproduction
déclarée, pas un domaine arbitraire.

---

## Les cinq causes, par fréquence

### 1. L'instance backend sortait de veille

L'hébergement met le service en sommeil après une période d'inactivité. La première
requête le réveille et peut approcher la minute.

*Ce que vous voyez* : un message « Le serveur sort de veille » après trois secondes, puis
la connexion aboutit. Avant le correctif qui a introduit ce message, la page restait
muette pendant toute l'attente — c'est l'explication la plus probable d'une connexion qui
paraissait inerte.

*Remède* : réessayer suffit. Pour supprimer le délai durablement, un plan d'hébergement
sans mise en veille, ou une requête périodique sur `/api/health/live`.

### 2. L'origine du frontend n'est pas déclarée dans `ALLOWED_ORIGINS`

Les pages et l'API sont hébergées sur deux domaines distincts. Le navigateur n'autorise
la lecture des réponses de l'API que si celle-ci déclare explicitement l'origine des
pages. Tant que la déclaration manque, **aucune** requête n'aboutit.

*Ce que vous voyez* : le diagnostic affiche « Le serveur répond, mais refuse ce site » et
donne l'origine exacte à déclarer.

*Remède* : ajouter cette origine à `ALLOWED_ORIGINS` sur le backend, puis redéployer.
C'est le réglage le plus souvent oublié après un changement de nom de domaine ou la
création d'un nouvel environnement.

```bash
# vérification depuis la ligne de commande
FRONTEND_ORIGIN=https://votre-site npm run smoke -- https://votre-api
```

### 3. Le service tourne sans sa base de données

L'application répond, mais ne peut lire aucun compte.

*Ce que vous voyez* : le diagnostic affiche « Le serveur tourne sans sa base de
données » ; `/api/health` renvoie 503.

*Remède* : vérifier `MONGODB_URI` et la liste d'adresses IP autorisées sur le cluster.
Un hébergeur qui change d'adresse de sortie suffit à provoquer cette panne.

### 4. Le répertoire `public/js/` n'a pas été déployé

Depuis le durcissement de la politique de sécurité du contenu, le JavaScript des pages
vit dans des fichiers séparés. Une page déployée sans ses scripts se soumet en GET : la
page se recharge, les champs se vident, et **aucun message n'apparaît**.

*Ce que vous voyez* : exactement « rien ne se passe ». La console du navigateur affiche
`handleLogin is not defined` et un 404 sur `/js/login.js`.

*Remède* : déployer l'intégralité de `public/`. `wrangler.jsonc` le fait
(`assets.directory: "public"`). Le test `tests/unit/actifsFrontend.test.js` vérifie en
amont que chaque script référencé existe et que chaque gestionnaire appelé en attribut est
bien défini : cette panne ne peut plus franchir la CI.

### 5. Le compte n'existe pas, ou les tentatives sont bloquées

Si toute la chaîne technique fonctionne, c'est l'identifiant qui est en cause.

*Ce que vous voyez* : « Email ou mot de passe incorrect », ou « Trop de tentatives » après
une dizaine d'essais en quinze minutes.

*Remède* : créer le compte depuis l'onglet « Créer un compte », ou utiliser « Mot de passe
oublié ? ». Si le blocage survient dès les premiers essais, c'est `TRUST_PROXY_HOPS` qui
est mal réglé : tous les clients partagent alors un même quota.

---

## Si le diagnostic ne suffit pas

Le bouton « Vider le cache et les jetons » de la page de diagnostic désinscrit le service
worker, supprime les caches et efface le stockage local. Un service worker périmé peut
servir d'anciennes pages pointant vers des scripts qui n'existent plus.

Reste ensuite le rapport en bas de page : il contient l'origine, l'hôte de l'API, l'état
de chaque contrôle et le navigateur utilisé. C'est ce qu'il faut transmettre au support,
plutôt qu'une capture d'écran du formulaire.
