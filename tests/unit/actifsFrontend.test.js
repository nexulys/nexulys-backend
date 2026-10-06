/**
 * Cohérence entre les pages et leurs scripts.
 *
 * Depuis le durcissement de la CSP, le JavaScript des pages vit dans public/js/*.js et
 * les pages l'appellent par <script src>. Cette séparation introduit un mode de panne
 * silencieux : si le script manque, n'est pas déployé ou ne définit plus un gestionnaire
 * appelé en attribut (onsubmit="handleLogin(event)"), le formulaire se soumet en GET,
 * la page se recharge, les champs se vident et AUCUN message n'apparaît. L'utilisateur
 * constate que « rien ne se passe » et rien dans les journaux du serveur ne le signale.
 *
 * Ces tests rendent cette panne impossible à livrer.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUBLIC = path.join(__dirname, '..', '..', 'public');
const pages = fs.readdirSync(PUBLIC).filter(f => f.endsWith('.html'));

// Mots-clés du langage et objets fournis par le navigateur : le motif d'extraction les
// capture comme s'ils étaient des appels de fonction (onclick="if (…)"), mais ils n'ont
// pas à être définis dans un script de la page.
const GLOBALES = new Set([
  'return', 'this', 'window', 'event', 'void', 'if', 'for', 'while', 'switch',
  'typeof', 'delete', 'new', 'do', 'try', 'catch', 'alert', 'confirm', 'setTimeout',
]);

const scriptsDe = (html) =>
  [...html.matchAll(/<script\s+src="(\/[^"]+)"/g)].map(m => m[1]);

const gestionnairesDe = (html) =>
  [...html.matchAll(/\son[a-z]+="\s*([A-Za-z_$][\w$]*)\s*\(/g)]
    .map(m => m[1])
    .filter(n => !GLOBALES.has(n));

describe('actifs du frontend', () => {
  test('au moins une page est analysée', () => {
    expect(pages.length).toBeGreaterThan(5);
  });

  describe.each(pages)('%s', (page) => {
    const html = fs.readFileSync(path.join(PUBLIC, page), 'utf8');
    const scripts = scriptsDe(html);

    test('chaque script référencé existe sur le disque', () => {
      scripts
        .filter(s => !s.startsWith('//') && !s.startsWith('http'))
        .forEach(src => {
          const cible = path.join(PUBLIC, src.replace(/^\//, ''));
          expect(fs.existsSync(cible)).toBe(true);
        });
    });

    test('chaque gestionnaire appelé en attribut est défini dans un script de la page', () => {
      const noms = gestionnairesDe(html);
      if (!noms.length) return;

      const sources = scripts
        .filter(s => s.startsWith('/js/'))
        .map(s => path.join(PUBLIC, s.replace(/^\//, '')))
        .filter(f => fs.existsSync(f))
        .map(f => fs.readFileSync(f, 'utf8'))
        .join('\n');

      // Du JS inline reste possible sur certaines pages : on l'inclut dans la recherche.
      const inline = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
        .map(m => m[1]).join('\n');
      const corpus = sources + '\n' + inline;

      const manquants = [...new Set(noms)].filter(nom => {
        const motifs = [
          new RegExp('function\\s+' + nom + '\\s*\\('),
          new RegExp('(?:const|let|var)\\s+' + nom + '\\s*='),
          new RegExp('window\\.' + nom + '\\s*='),
        ];
        return !motifs.some(m => m.test(corpus));
      });

      expect(manquants).toEqual([]);
    });
  });

  test('chaque script de public/js est syntaxiquement valide', () => {
    const fichiers = fs.readdirSync(path.join(PUBLIC, 'js')).filter(f => f.endsWith('.js'));
    expect(fichiers.length).toBeGreaterThan(3);
    fichiers.forEach(f => {
      const code = fs.readFileSync(path.join(PUBLIC, 'js', f), 'utf8');
      // Compile sans exécuter : une erreur de syntaxe laisserait toute la page inerte.
      expect(() => new vm.Script(code, { filename: f })).not.toThrow();
    });
  });

  test('la page de connexion propose un accès au diagnostic', () => {
    const html = fs.readFileSync(path.join(PUBLIC, 'login.html'), 'utf8');
    expect(html).toContain('/diagnostic.html');
    expect(fs.existsSync(path.join(PUBLIC, 'diagnostic.html'))).toBe(true);
  });
});
