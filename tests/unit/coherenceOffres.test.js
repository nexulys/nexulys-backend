/**
 * Une seule source de vérité pour les offres, et un seul fournisseur d'IA déclaré.
 *
 * Les CGU annonçaient trois offres « Essentiel / Pilotage / Intégral » à 149, 349 et
 * 890 € quand le site et le code facturaient « Starter / Business / Pro » à 39, 89 et
 * 199 €. Le contrat opposable au client décrivait un produit qui n'existait pas, à des
 * prix quatre fois supérieurs à ceux prélevés.
 *
 * De même, la politique de confidentialité listait cinq sous-traitants sans mentionner
 * le fournisseur d'intelligence artificielle, alors que le produit lui transmet du
 * texte de facture, des CV de candidats et des comptes rendus d'entretien.
 *
 * Ces tests échouent dès qu'un de ces documents s'écarte du code.
 */
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8');

const { PLANS } = require('../../config/plans');

describe('offres — le contrat, le site et le code disent la même chose', () => {
  const cgu = lire('docs/legal/CGU.md');
  const accueil = lire('public/index.html');

  test('config/plans.js reste la source : trois offres tarifées', () => {
    expect(PLANS).toHaveLength(3);
    PLANS.forEach((p) => {
      expect(typeof p.prix).toBe('number');
      expect(p.prix).toBeGreaterThan(0);
      expect(p.limites).toHaveProperty('utilisateurs');
      expect(p.limites).toHaveProperty('employes');
    });
  });

  test.each(PLANS.map((p) => [p.nom, p]))('les CGU annoncent %s au tarif du code', (nom, plan) => {
    // Ligne attendue : | Starter | 39 € | 1 | 0 |
    const ligne = cgu.split('\n').find((l) => l.trim().startsWith(`| ${nom} |`));
    expect(ligne).toBeDefined();
    const cellules = ligne.split('|').map((c) => c.trim()).filter(Boolean);
    expect(cellules[1]).toBe(`${plan.prix} €`);
    expect(cellules[2]).toBe(String(plan.limites.utilisateurs));
    expect(cellules[3]).toBe(String(plan.limites.employes));
  });

  test.each(PLANS.map((p) => [p.nom, p.prix]))('la page d\'accueil affiche %s au bon tarif', (nom, prix) => {
    expect(accueil).toContain(`>${nom}<`);
    expect(accueil).toMatch(new RegExp(`data-monthly="${prix}"`));
  });

  test('aucune offre fantôme ne subsiste dans les documents', () => {
    const connues = PLANS.map((p) => p.nom);
    for (const fantome of ['Essentiel', 'Pilotage', 'Intégral']) {
      if (connues.includes(fantome)) continue;
      expect(cgu).not.toContain(`| ${fantome} |`);
    }
  });

  test('les CGU ne promettent pas de quota que le code ne mesure pas', () => {
    // verifierQuota ne sait compter que les utilisateurs et les salariés.
    const { verifierQuota } = require('../../utils/quotas');
    expect(typeof verifierQuota).toBe('function');
    expect(cgu).not.toMatch(/Écritures \/ mois/);
    expect(cgu).not.toMatch(/Documents IA \/ mois/);
    expect(cgu).not.toMatch(/0,08 € HT par document/);
  });
});

describe('fournisseur d\'IA — déclaré partout où il traite des données', () => {
  const source = lire('controllers/aiController.js');
  const declare = source.match(/const FOURNISSEUR_IA = '([^']+)'/);

  test('le code nomme explicitement son fournisseur', () => {
    expect(declare).not.toBeNull();
  });

  test.each([
    ['la politique de confidentialité publiée', 'public/confidentialite.html'],
    ['le registre des traitements', 'docs/RGPD-REGISTRE.md'],
    ['le DPA', 'docs/RGPD-DPA.md'],
    ['la politique de confidentialité détaillée', 'docs/legal/POLITIQUE-CONFIDENTIALITE.md'],
  ])('%s le mentionne', (_, fichier) => {
    expect(lire(fichier)).toContain(declare[1]);
  });

  test('aucun fournisseur concurrent ne traîne dans le code sans être déclaré', () => {
    // Une seconde bascule non déclarée enverrait des données à un destinataire absent
    // des documents RGPD — c'était le cas de Groq avant cette correction.
    expect(source).not.toMatch(/GROQ_API_KEY/);
    const politique = lire('public/confidentialite.html');
    for (const autre of ['Groq', 'Anthropic', 'Mistral']) {
      if (autre === declare[1]) continue;
      expect(source).not.toContain(`'${autre}'`);
      expect(politique).not.toContain(autre);
    }
  });
});

describe('identité juridique — rien d\'inventé dans les documents', () => {
  const documents = [
    'docs/legal/CGU.md',
    'docs/legal/POLITIQUE-CONFIDENTIALITE.md',
    'docs/RGPD-REGISTRE.md',
    'docs/RGPD-DPA.md',
    'public/mentions-legales.html',
    'public/cgv.html',
    'public/confidentialite.html',
  ];

  // Identités fabriquées sous une consigne « invente ce qui manque », et restées dans
  // des documents juridiques : numéro RCS, numéro de TVA, dirigeant et DPO inexistants.
  const INVENTIONS = ['934 512 786', 'FR 42 934512786', 'Yanis Maréchal', 'Camille Ferrand', 'rue des Arts'];

  test.each(documents)('%s ne contient aucune identité fabriquée', (fichier) => {
    const contenu = lire(fichier);
    INVENTIONS.forEach((invention) => expect(contenu).not.toContain(invention));
  });

  test('les hébergeurs cités sont ceux réellement utilisés', () => {
    const cgu = lire('docs/legal/CGU.md');
    expect(cgu).toContain('Render');
    expect(cgu).toContain('Cloudflare');
    expect(cgu).not.toContain('Scaleway');
  });
});
