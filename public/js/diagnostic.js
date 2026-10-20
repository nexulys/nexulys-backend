// Diagnostic de la chaîne frontend → API, exécuté depuis le navigateur de
// l'utilisateur. Le serveur ne peut pas faire ce diagnostic lui-même : les deux pannes
// les plus fréquentes (origine non autorisée par le CORS, instance en veille) ne se
// constatent que depuis le poste client.
// L'hôte par défaut est celui de la production. Le paramètre ?api=https://… permet de
// pointer un autre backend (préproduction, service renommé) sans modifier le code ;
// seules les adresses https, ou localhost en développement, sont acceptées.
function hoteApi() {
  const demande = new URLSearchParams(window.location.search).get('api');
  if (demande && /^(https:\/\/|http:\/\/localhost(:\d+)?($|\/))/.test(demande)) {
    return demande.replace(/\/+$/, '');
  }
  return 'https://nexulys-backend-1.onrender.com';
}
const API_RACINE = hoteApi();
const API = API_RACINE + '/api';
const DELAI_MS = 60000;

const CONTROLES = [
  { id: 'joignable',  intitule: 'Le serveur est joignable' },
  { id: 'cors',       intitule: 'Ce site est autorisé à appeler l’API' },
  { id: 'base',       intitule: 'La base de données est connectée' },
  { id: 'auth',       intitule: 'La route de connexion répond correctement' },
];

const resultats = {};

// ── Rendu ──
function elementControle(id) { return document.getElementById('ctrl-' + id); }

function peindre(id, etat, detail, remede) {
  const el = elementControle(id);
  if (!el) return;
  const symbole = { ok: '✓', echec: '✗', alerte: '!', attente: '·' }[etat];
  el.className = 'ligne ' + etat;
  el.querySelector('.etat').textContent = symbole;
  el.querySelector('.detail').textContent = detail || '';
  const r = el.querySelector('.remede');
  r.textContent = remede || '';
  r.style.display = remede ? 'block' : 'none';
}

function enregistrer(id, etat, detail, remede) {
  resultats[id] = { etat: etat, detail: detail || '', remede: remede || '' };
  peindre(id, etat, detail, remede);
}

function construireControles() {
  const hote = document.getElementById('controles');
  hote.textContent = '';
  CONTROLES.forEach(function(c) {
    const ligne = document.createElement('div');
    ligne.className = 'ligne attente';
    ligne.id = 'ctrl-' + c.id;

    const etat = document.createElement('span');
    etat.className = 'etat';
    etat.textContent = '·';

    const corps = document.createElement('div');
    corps.className = 'corps';
    const intitule = document.createElement('div');
    intitule.className = 'intitule';
    intitule.textContent = c.intitule;
    const detail = document.createElement('div');
    detail.className = 'detail';
    detail.textContent = 'en attente…';
    const remede = document.createElement('div');
    remede.className = 'remede';
    remede.style.display = 'none';

    corps.appendChild(intitule);
    corps.appendChild(detail);
    corps.appendChild(remede);
    ligne.appendChild(etat);
    ligne.appendChild(corps);
    hote.appendChild(ligne);
  });
}

function ligneContexte(cle, valeur) {
  const ligne = document.createElement('div');
  ligne.className = 'ligne';
  const corps = document.createElement('div');
  corps.className = 'corps';
  const i = document.createElement('div');
  i.className = 'intitule';
  i.textContent = cle;
  const d = document.createElement('div');
  d.className = 'detail';
  d.textContent = valeur;
  corps.appendChild(i);
  corps.appendChild(d);
  ligne.appendChild(corps);
  return ligne;
}

async function contexte() {
  let sw = 'non pris en charge par ce navigateur';
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      sw = regs.length ? regs.length + ' enregistré(s) — susceptible de servir des fichiers en cache' : 'aucun';
    } catch (_) { sw = 'état illisible'; }
  }
  let jeton = 'absent';
  try {
    jeton = localStorage.getItem('novexa_token') ? 'présent (session déjà ouverte)' : 'absent';
  } catch (_) { jeton = 'stockage local inaccessible — navigation privée ou cookies bloqués'; }

  const infos = [
    ['Origine de cette page', window.location.origin],
    ['Hôte de l’API appelée', API_RACINE],
    ['Même domaine ?', window.location.origin === API_RACINE ? 'oui — le CORS ne s’applique pas' : 'non — le CORS doit autoriser l’origine ci-dessus'],
    ['Connexion internet', navigator.onLine === false ? 'hors ligne' : 'en ligne'],
    ['Service worker', sw],
    ['Jeton en mémoire', jeton],
  ];
  const hote = document.getElementById('contexte');
  hote.textContent = '';
  infos.forEach(function(p) { hote.appendChild(ligneContexte(p[0], p[1])); });
  resultats.contexte = infos;
}

// ── Appel borné dans le temps ──
async function requete(url, options) {
  const controleur = new AbortController();
  const minuterie = setTimeout(function() { controleur.abort(); }, DELAI_MS);
  const depart = Date.now();
  try {
    const res = await fetch(url, Object.assign({ cache: 'no-store', signal: controleur.signal }, options || {}));
    return { ok: true, res: res, ms: Date.now() - depart };
  } catch (err) {
    return { ok: false, err: err, ms: Date.now() - depart, abandon: err && err.name === 'AbortError' };
  } finally {
    clearTimeout(minuterie);
  }
}

// ── Tests ──
// La sonde /health/live est lisible depuis toute origine (voir routes/health.js) : elle
// répond donc même quand la politique CORS refuse le reste de l'API. C'est ce qui permet
// de distinguer « serveur injoignable » de « origine non autorisée » — deux pannes que
// le navigateur signale par la même erreur indifférenciée.
async function testJoignable() {
  const r = await requete(API + '/health/live');
  if (!r.ok) {
    if (r.abandon) {
      enregistrer('joignable', 'echec', 'aucune réponse en 60 s',
        'Le service est probablement arrêté. Vérifiez son état sur le tableau de bord de l’hébergeur.');
    } else {
      enregistrer('joignable', 'echec', 'connexion impossible (' + ((r.err && r.err.message) || 'erreur inconnue') + ')',
        'Causes possibles : service arrêté, nom de domaine introuvable, ou accès bloqué par votre réseau.');
    }
    return false;
  }
  if (r.ms > 5000) {
    enregistrer('joignable', 'alerte', 'réponse en ' + (r.ms / 1000).toFixed(1) + ' s',
      'L’instance sortait de veille. C’est la cause la plus fréquente d’une connexion qui « ne fait rien » : le bouton attend sans rien afficher. Un plan payant sans mise en veille supprime ce délai.');
    return true;
  }
  enregistrer('joignable', 'ok', 'réponse en ' + r.ms + ' ms');
  return true;
}

// /health est soumis à la liste d'origines autorisées, contrairement à /health/live.
async function testCors() {
  const r = await requete(API + '/health');
  if (!r.ok) {
    enregistrer('cors', 'echec', 'la réponse est bloquée par le navigateur',
      'L’API ne reconnaît pas cette origine. Ajoutez ' + window.location.origin +
      ' à la variable ALLOWED_ORIGINS du backend, puis redéployez. C’est le réglage le plus souvent oublié : tant qu’il manque, aucune connexion n’est possible.');
    return false;
  }
  enregistrer('cors', 'ok', 'origine acceptée (HTTP ' + r.res.status + ')');
  return true;
}

async function testBase() {
  const r = await requete(API + '/health');
  if (!r.ok) {
    enregistrer('base', 'echec', 'état de santé illisible', 'Dépend du contrôle précédent.');
    return false;
  }
  let corps = null;
  try { corps = await r.res.json(); } catch (_) { corps = null; }
  if (r.res.status === 503) {
    enregistrer('base', 'echec', 'HTTP 503 — le service tourne mais la base est injoignable',
      'Vérifiez MONGODB_URI et l’autorisation d’adresse IP du cluster de base de données.');
    return false;
  }
  if (r.res.status !== 200) {
    enregistrer('base', 'echec', 'HTTP ' + r.res.status, 'Consultez les journaux du service.');
    return false;
  }
  const env = (corps && (corps.environment || (corps.data && corps.data.environment))) || 'inconnu';
  enregistrer('base', 'ok', 'connectée — environnement « ' + env + ' »');
  return true;
}

// Tentative volontairement vouée à l'échec, sur une adresse réservée aux tests : elle
// valide la route, le corps JSON, le CORS sur une requête POST authentifiée et l'état
// de l'anti-force-brute, sans jamais transmettre de mot de passe réel.
async function testAuth() {
  const r = await requete(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email: 'diagnostic@novexa.invalid', password: 'diagnostic-' + Date.now() })
  });
  if (!r.ok) {
    enregistrer('auth', 'echec', 'la requête de connexion n’aboutit pas (' + ((r.err && r.err.message) || 'erreur inconnue') + ')',
      'Si le contrôle CORS ci-dessus est en échec, corrigez-le d’abord : il explique celui-ci.');
    return false;
  }
  const brut = await r.res.text().catch(function() { return ''; });
  let corps = null;
  try { corps = JSON.parse(brut); } catch (_) { corps = null; }

  if (corps === null) {
    enregistrer('auth', 'echec', 'HTTP ' + r.res.status + ' — réponse non JSON : ' + brut.slice(0, 100),
      'Un intermédiaire répond à la place de l’application. Vérifiez que le service est bien démarré.');
    return false;
  }
  if (r.res.status === 429) {
    enregistrer('auth', 'alerte', 'HTTP 429 — trop de tentatives récentes',
      'L’anti-force-brute est actif : attendez quinze minutes. Si vous n’avez fait que quelques essais, le réglage TRUST_PROXY_HOPS du backend est probablement faux et les quotas sont devenus collectifs.');
    return false;
  }
  if (r.res.status === 401 || r.res.status === 400) {
    enregistrer('auth', 'ok', 'HTTP ' + r.res.status + ' — refus attendu sur un compte inexistant : la chaîne complète fonctionne');
    return true;
  }
  if (r.res.status >= 500) {
    enregistrer('auth', 'echec', 'HTTP ' + r.res.status + ' — ' + (corps.message || 'erreur interne'),
      'L\u2019application échoue en traitant la demande. La cause est dans les journaux du service, pas côté navigateur.');
    return false;
  }
  enregistrer('auth', 'alerte', 'HTTP ' + r.res.status + ' — réponse inattendue : ' + (corps.message || brut.slice(0, 80)));
  return true;
}

// ── Verdict ──
function verdict() {
  const el = document.getElementById('verdict');
  const j = resultats.joignable, c = resultats.cors, b = resultats.base, a = resultats.auth;
  let titre, texte, suite, bon = false;

  if (j && j.etat === 'echec') {
    titre = 'Le serveur ne répond pas.';
    texte = 'Aucune connexion n’est possible tant que le service backend est arrêté ou inaccessible.';
    suite = 'À faire : vérifier l’état du service chez l’hébergeur et consulter ses journaux de démarrage.';
  } else if (c && c.etat === 'echec') {
    titre = 'Le serveur répond, mais refuse ce site.';
    texte = 'Le navigateur bloque les réponses parce que l’API ne déclare pas cette origine comme autorisée. Le bouton de connexion semble alors ne rien faire.';
    suite = 'À faire : ajouter ' + window.location.origin + ' à ALLOWED_ORIGINS sur le backend, puis redéployer.';
  } else if (b && b.etat === 'echec') {
    titre = 'Le serveur tourne sans sa base de données.';
    texte = 'L’application répond mais ne peut lire aucun compte : toute connexion échouera.';
    suite = 'À faire : vérifier MONGODB_URI et les adresses IP autorisées sur le cluster.';
  } else if (a && a.etat === 'echec') {
    titre = 'La route de connexion renvoie une erreur serveur.';
    texte = a.detail + '. Le serveur et la base répondent, mais le traitement de la connexion échoue.';
    suite = 'À faire : consulter les journaux du service au moment de ce test — l\u2019erreur y est détaillée.';
  } else if (a && a.etat === 'alerte') {
    titre = 'La chaîne fonctionne, mais les tentatives sont bloquées.';
    texte = a.detail;
    suite = a.remede;
  } else if (j && j.etat === 'alerte') {
    titre = 'La chaîne fonctionne, le serveur était en veille.';
    texte = 'Le premier appel a mis ' + j.detail.replace('réponse en ', '') + '. Pendant ce temps, la page de connexion paraît inerte.';
    suite = 'Réessayez la connexion maintenant : le serveur est réveillé, la réponse sera immédiate. Si l’identifiant est refusé, c’est que le compte n’existe pas — créez-le depuis l’onglet « Créer un compte ».';
    bon = true;
  } else if (a && a.etat === 'ok') {
    titre = 'Toute la chaîne technique fonctionne.';
    texte = 'Le serveur, le CORS, la base de données et la route de connexion répondent correctement.';
    suite = 'Si la connexion échoue malgré cela, le compte ou le mot de passe est en cause : utilisez « Mot de passe oublié ? », ou créez le compte depuis l’onglet « Créer un compte ».';
    bon = true;
  } else {
    titre = 'Diagnostic incomplet.';
    texte = 'Un contrôle n’a pas abouti.';
    suite = 'Relancez les tests, puis transmettez le rapport ci-dessous.';
  }

  el.textContent = '';
  const t = document.createElement('strong');
  t.textContent = titre;
  const p = document.createElement('div');
  p.textContent = texte;
  const s = document.createElement('div');
  s.className = 'suite';
  s.textContent = suite;
  el.appendChild(t);
  el.appendChild(p);
  el.appendChild(s);
  el.className = 'verdict visible ' + (bon ? 'bon' : 'mauvais');
}

function rapport() {
  const lignes = [
    'Diagnostic Novexa — ' + new Date().toISOString(),
    'Navigateur : ' + navigator.userAgent,
    '',
  ];
  (resultats.contexte || []).forEach(function(p) { lignes.push(p[0] + ' : ' + p[1]); });
  lignes.push('');
  CONTROLES.forEach(function(c) {
    const r = resultats[c.id];
    if (!r) return;
    lignes.push('[' + r.etat.toUpperCase() + '] ' + c.intitule + ' — ' + r.detail);
    if (r.remede) lignes.push('        → ' + r.remede);
  });
  document.getElementById('rapport').textContent = lignes.join('\n');
}

// ── Orchestration ──
async function lancer() {
  const btn = document.getElementById('btn-relancer');
  btn.disabled = true;
  btn.textContent = 'Tests en cours…';
  document.getElementById('verdict').className = 'verdict';
  construireControles();
  await contexte();

  const joignable = await testJoignable();
  if (joignable) {
    const cors = await testCors();
    if (cors) {
      await testBase();
      await testAuth();
    } else {
      enregistrer('base', 'attente', 'non testé — dépend du contrôle précédent');
      enregistrer('auth', 'attente', 'non testé — dépend du contrôle précédent');
    }
  } else {
    ['cors', 'base', 'auth'].forEach(function(id) {
      enregistrer(id, 'attente', 'non testé — le serveur est injoignable');
    });
  }

  verdict();
  rapport();
  btn.disabled = false;
  btn.textContent = 'Relancer les tests';
}

// Un service worker périmé peut servir d'anciennes pages et d'anciens scripts : la
// connexion échoue alors sur du code qui n'est plus celui du serveur.
async function reparer() {
  const btn = document.getElementById('btn-reparer');
  btn.disabled = true;
  btn.textContent = 'Nettoyage…';
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function(r) { return r.unregister(); }));
    }
    if (window.caches) {
      const cles = await caches.keys();
      await Promise.all(cles.map(function(k) { return caches.delete(k); }));
    }
    try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
  } catch (_) {}
  btn.textContent = 'Nettoyé — rechargement…';
  setTimeout(function() { window.location.reload(); }, 600);
}

async function copier() {
  const texte = document.getElementById('rapport').textContent;
  const btn = document.getElementById('btn-copier');
  try {
    await navigator.clipboard.writeText(texte);
    btn.textContent = 'Rapport copié';
  } catch (_) {
    btn.textContent = 'Copie refusée — sélectionnez le texte';
  }
  setTimeout(function() { btn.textContent = 'Copier le rapport'; }, 2500);
}

document.getElementById('btn-relancer').addEventListener('click', lancer);
document.getElementById('btn-reparer').addEventListener('click', reparer);
document.getElementById('btn-copier').addEventListener('click', copier);
lancer();
