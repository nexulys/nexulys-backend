/**
 * Chaque appel du frontend doit viser une route qui existe.
 *
 * Quatre fonctionnalités ont été livrées mortes faute de ce contrôle : la lecture
 * automatique d'une facture appelait /ai/analyse (route jamais créée), la liste des
 * saisies de temps /projets/temps (non exposée), le détail d'un relevé bancaire
 * /rapprochement/:id (absent) et le rapprochement d'une transaction une URL d'une
 * autre forme. Dans les quatre cas l'API répondait 404, le frontend lisait un corps
 * vide et l'écran restait muet : rien dans les journaux, rien à l'écran.
 *
 * Ce test confronte les deux côtés. Il échoue si un appel ne correspond à aucune
 * route, ou si la méthode HTTP diffère.
 */
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');

// ── Table de routage, lue depuis les routeurs réellement chargés ──
const tableRoutes = () => {
  const serveur = fs.readFileSync(path.join(RACINE, 'server.js'), 'utf8');
  const routes = [];
  for (const m of serveur.matchAll(/app\.use\(\s*'(\/api[^']*)'[^)]*require\('\.\/routes\/(\w+)'\)/g)) {
    const [, prefixe, fichier] = m;
    const routeur = require(path.join(RACINE, 'routes', fichier + '.js'));
    for (const couche of routeur.stack || []) {
      if (!couche.route) continue;
      const chemin = (prefixe + couche.route.path).replace(/\/+$/, '') || prefixe;
      for (const methode of Object.keys(couche.route.methods)) {
        if (methode === '_all') continue;
        routes.push({
          methode: methode.toUpperCase(),
          chemin,
          re: new RegExp('^' + chemin.replace(/:[^/]+/g, '[^/]+') + '$'),
        });
      }
    }
  }
  return routes;
};

// Extrait l'argument complet d'un appel en respectant parenthèses et chaînes.
const argument = (src, debut) => {
  let prof = 0, i = debut, chaine = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (chaine) {
      if (c === '\\') { i++; continue; }
      if (c === chaine) chaine = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { chaine = c; continue; }
    if ('(['.includes(c) || c === '{') prof++;
    else if (')]'.includes(c) || c === '}') { if (prof === 0) break; prof--; }
    else if (c === ',' && prof === 0) break;
  }
  return src.slice(debut, i);
};

// Concaténation → chemin : les littéraux sont gardés, le reste devient un paramètre.
const PARAM = '\u0001';
const normaliser = (expr) => {
  let out = '', i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === "'" || c === '"') {
      const fin = expr.indexOf(c, i + 1);
      if (fin === -1) break;
      out += expr.slice(i + 1, fin);
      i = fin + 1;
    } else if (c === '`') {
      const fin = expr.indexOf('`', i + 1);
      if (fin === -1) break;
      out += expr.slice(i + 1, fin).replace(/\$\{[^}]*\}/g, PARAM);
      i = fin + 1;
    } else {
      let j = i;
      while (j < expr.length && !["'", '"', '`'].includes(expr[j])) j++;
      const seg = expr.slice(i, j).trim();
      if (seg && seg !== '+' && !/^\+?\s*API\s*\+?$/.test(seg)) out += PARAM;
      i = j;
    }
  }
  return out;
};

// Appels dont le segment dynamique ne prend que des valeurs statiques connues :
// l'analyse ne peut pas le déduire, les routes correspondantes existent bien.
const DEROGATIONS = new Set([
  'POST /api/import/:p',   // type ∈ clients | produits | employes
]);

const BASES = { 'admin.js': '/api/admin' };

const appelsFrontend = () => {
  const JS = path.join(RACINE, 'public', 'js');
  const appels = [];
  for (const f of fs.readdirSync(JS).filter((f) => f.endsWith('.js'))) {
    const base = BASES[f] || '/api';
    const src = fs.readFileSync(path.join(JS, f), 'utf8');
    for (const m of src.matchAll(/\b(?:fetch|apiFetch|appelApi|requete)\s*\(/g)) {
      const debut = m.index + m[0].length;
      let chemin = normaliser(argument(src, debut)).replace(/^https?:\/\/[^/]+/, '');
      if (!chemin.startsWith('/api')) {
        if (chemin.startsWith('/')) chemin = base + chemin;
        else continue;
      }
      chemin = chemin.split('?')[0].replace(new RegExp(PARAM, 'g'), ':p').replace(/\/+$/, '');
      if (!chemin.startsWith('/api')) continue;
      const suite = src.slice(debut, debut + 400).match(/method\s*:\s*['"`](\w+)['"`]/);
      const ligne = src.slice(0, m.index).split('\n').length;
      appels.push({
        fichier: f, ligne, chemin,
        methode: suite ? suite[1].toUpperCase() : 'GET',
      });
    }
  }
  return appels;
};

describe('câblage frontend ↔ API', () => {
  const routes = tableRoutes();
  const appels = appelsFrontend();

  test('la table de routage et les appels sont bien détectés', () => {
    expect(routes.length).toBeGreaterThan(200);
    expect(appels.length).toBeGreaterThan(100);
  });

  test('aucun appel ne vise une route inexistante', () => {
    const vus = new Set();
    const orphelins = [];
    for (const a of appels) {
      const cle = a.methode + ' ' + a.chemin;
      if (vus.has(cle) || DEROGATIONS.has(cle)) continue;
      vus.add(cle);
      const url = a.chemin.replace(/:p/g, 'X');
      if (!routes.some((r) => r.methode === a.methode && r.re.test(url))) {
        const methodeSeule = routes.some((r) => r.re.test(url));
        orphelins.push(`${cle} (${a.fichier}:${a.ligne})` +
          (methodeSeule ? ' — chemin existant, méthode absente' : ' — chemin inexistant'));
      }
    }
    expect(orphelins).toEqual([]);
  });

  test('chaque dérogation correspond bien à des routes réelles', () => {
    // Une dérogation qui ne protège plus rien doit être retirée, pas oubliée.
    const chemins = routes.map((r) => r.chemin);
    expect(chemins).toContain('/api/import/clients');
    expect(chemins).toContain('/api/import/produits');
    expect(chemins).toContain('/api/import/employes');
  });
});
