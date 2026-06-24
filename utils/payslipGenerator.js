/**
 * Générateur de fiches de paie — Taux légaux France 2024
 * PMSS 2024 : 3 864 €/mois
 * SMIC brut 2024 : 1 766,92 €/mois (151.67h × 11,65 €/h)
 */

const PMSS_2024 = 3864;        // Plafond Mensuel Sécurité Sociale 2024
const HEURES_LEGALES = 151.67; // Heures légales mensuelles

const r = (n) => Math.round(n * 100) / 100; // arrondi 2 décimales

/**
 * Génère les données complètes d'une fiche de paie aux normes françaises 2024.
 * @param {number} salaireBase - Salaire brut de base mensuel
 * @param {number} heuresSup - Nombre d'heures supplémentaires (majorées 25%)
 * @param {number|null} tauxHeureSup - Taux horaire heure sup (null = auto 125%)
 * @param {number} primes - Primes et gratifications
 * @param {number} tauxImpot - Taux prélèvement à la source PAS (0 à 1, ex: 0.075 pour 7.5%)
 * @param {object} opts - Options : { congesDebut, congesPris }
 */
const genererFichePaie = (salaireBase, heuresSup = 0, tauxHeureSup = null, primes = 0, tauxImpot = 0, opts = {}) => {
  const tauxHoraire = r(salaireBase / HEURES_LEGALES);
  const tauxHeureSupEffectif = tauxHeureSup || r(tauxHoraire * 1.25);
  const montantHeuresSup = r(heuresSup * tauxHeureSupEffectif);

  const salaireBrut = r(salaireBase + montantHeuresSup + primes);

  // Tranches de calcul
  const T1 = Math.min(salaireBrut, PMSS_2024); // Tranche 1 (sous plafond SS)
  const baseCsg = r(salaireBrut * 0.9825);      // Base CSG/CRDS (abattement 1.75%)

  // ─── COTISATIONS SALARIALES ───────────────────────────────────────────────

  // Santé : maladie 0% salarial depuis 2018
  const sal_maladie = 0;
  const pat_maladie = r(salaireBrut * 0.0700);

  // Complémentaire santé (mutuelle) — taux indicatifs, obligation patronale 50%+
  const sal_mutuelle = r(salaireBrut * 0.0100); // 1% salarié (indicatif)
  const pat_mutuelle = r(salaireBrut * 0.0150); // 1.5% patronal (indicatif)

  // AT/MP — taux moyen (variable selon secteur, mentionné mais 0% salarié)
  const sal_atmp = 0;
  const pat_atmp = r(salaireBrut * 0.0222); // 2.22% taux moyen 2024

  // Vieillesse plafonnée (sur T1)
  const sal_vieilPlafo = r(T1 * 0.0690);
  const pat_vieilPlafo = r(T1 * 0.0855);

  // Vieillesse déplafonnée (sur brut)
  const sal_vieilDeplafo = r(salaireBrut * 0.0040);
  const pat_vieilDeplafo = r(salaireBrut * 0.0190);

  // AGIRC-ARRCO tranche 1 (sur T1)
  const sal_arrcoT1 = r(T1 * 0.0315);
  const pat_arrcoT1 = r(T1 * 0.0472);

  // Contribution équilibre général (CEG) T1
  const sal_ceg = r(T1 * 0.0086);
  const pat_ceg = r(T1 * 0.0129);

  // Allocations familiales — 3.45% si salaire ≤ 3.5 SMIC (6182€), sinon 5.25%
  const pat_af = salaireBrut <= 6182 ? r(salaireBrut * 0.0345) : r(salaireBrut * 0.0525);

  // Assurance chômage — 0% salarié depuis 2019
  const sal_chomage = 0;
  const pat_chomage = r(salaireBrut * 0.0405);

  // AGS (garantie des salaires)
  const pat_ags = r(salaireBrut * 0.0015);

  // FNAL (fonds logement) — 0.10% T1 pour entreprises < 50 salariés
  const pat_fnal = r(T1 * 0.0010);

  // CSG déductible du revenu imposable
  const sal_csgDed = r(baseCsg * 0.0680);

  // CSG non déductible
  const sal_csgNonDed = r(baseCsg * 0.0240);

  // CRDS (non déductible)
  const sal_crds = r(baseCsg * 0.0050);

  // ─── LIGNES DÉTAILLÉES ────────────────────────────────────────────────────

  const lignesCotisations = [
    // ── SANTÉ ──
    { categorie: 'Santé', libelle: 'Sécurité sociale — maladie, maternité, invalidité, décès', base: r(salaireBrut), tauxSalarial: 0, montantSalarial: 0, tauxPatronal: 7.00, montantPatronal: pat_maladie },
    { categorie: 'Santé', libelle: 'Complémentaire santé', base: r(salaireBrut), tauxSalarial: 1.00, montantSalarial: sal_mutuelle, tauxPatronal: 1.50, montantPatronal: pat_mutuelle },
    // ── AT / MP ──
    { categorie: 'AT/MP', libelle: 'Accidents du travail — maladies professionnelles', base: r(salaireBrut), tauxSalarial: 0, montantSalarial: 0, tauxPatronal: 2.22, montantPatronal: pat_atmp },
    // ── RETRAITE ──
    { categorie: 'Retraite', libelle: 'Sécurité sociale — vieillesse plafonnée', base: r(T1), tauxSalarial: 6.90, montantSalarial: sal_vieilPlafo, tauxPatronal: 8.55, montantPatronal: pat_vieilPlafo },
    { categorie: 'Retraite', libelle: 'Sécurité sociale — vieillesse déplafonnée', base: r(salaireBrut), tauxSalarial: 0.40, montantSalarial: sal_vieilDeplafo, tauxPatronal: 1.90, montantPatronal: pat_vieilDeplafo },
    { categorie: 'Retraite', libelle: 'Retraite complémentaire AGIRC-ARRCO T1', base: r(T1), tauxSalarial: 3.15, montantSalarial: sal_arrcoT1, tauxPatronal: 4.72, montantPatronal: pat_arrcoT1 },
    { categorie: 'Retraite', libelle: 'Contribution équilibre général (CEG)', base: r(T1), tauxSalarial: 0.86, montantSalarial: sal_ceg, tauxPatronal: 1.29, montantPatronal: pat_ceg },
    // ── FAMILLE ──
    { categorie: 'Famille', libelle: 'Allocations familiales', base: r(salaireBrut), tauxSalarial: 0, montantSalarial: 0, tauxPatronal: salaireBrut <= 6182 ? 3.45 : 5.25, montantPatronal: pat_af },
    // ── CHÔMAGE ──
    { categorie: 'Chômage', libelle: 'Assurance chômage', base: r(salaireBrut), tauxSalarial: 0, montantSalarial: 0, tauxPatronal: 4.05, montantPatronal: pat_chomage },
    { categorie: 'Chômage', libelle: 'Garantie des salaires (AGS)', base: r(salaireBrut), tauxSalarial: 0, montantSalarial: 0, tauxPatronal: 0.15, montantPatronal: pat_ags },
    { categorie: 'Chômage', libelle: 'FNAL', base: r(T1), tauxSalarial: 0, montantSalarial: 0, tauxPatronal: 0.10, montantPatronal: pat_fnal },
    // ── CSG / CRDS ──
    { categorie: 'CSG/CRDS', libelle: 'CSG déductible de l\'impôt sur le revenu', base: r(baseCsg), tauxSalarial: 6.80, montantSalarial: sal_csgDed, tauxPatronal: 0, montantPatronal: 0 },
    { categorie: 'CSG/CRDS', libelle: 'CSG non déductible de l\'impôt sur le revenu', base: r(baseCsg), tauxSalarial: 2.40, montantSalarial: sal_csgNonDed, tauxPatronal: 0, montantPatronal: 0 },
    { categorie: 'CSG/CRDS', libelle: 'CRDS', base: r(baseCsg), tauxSalarial: 0.50, montantSalarial: sal_crds, tauxPatronal: 0, montantPatronal: 0 }
  ];

  // ─── TOTAUX ───────────────────────────────────────────────────────────────

  const totalSalarial = r(sal_mutuelle + sal_vieilPlafo + sal_vieilDeplafo + sal_arrcoT1 + sal_ceg + sal_csgDed + sal_csgNonDed + sal_crds);
  const totalPatronal = r(pat_maladie + pat_mutuelle + pat_atmp + pat_vieilPlafo + pat_vieilDeplafo + pat_arrcoT1 + pat_ceg + pat_af + pat_chomage + pat_ags + pat_fnal);

  const netAvantImpot = r(salaireBrut - totalSalarial);

  // Net imposable = brut - cotisations DÉDUCTIBLES (exclut CSG non ded. et CRDS)
  const cotisationsDed = r(sal_mutuelle + sal_vieilPlafo + sal_vieilDeplafo + sal_arrcoT1 + sal_ceg + sal_csgDed);
  const netImposable = r(salaireBrut - cotisationsDed);

  const montantPAS = r(netImposable * (tauxImpot || 0));
  const netAPayer = r(netAvantImpot - montantPAS);

  // Congés payés : 2.5 jours acquis par mois
  const congesAcquisMois = 2.5;
  const congesDebut = opts.congesDebut || 0;
  const congesPris = opts.congesPris || 0;
  const congesPayes = {
    soldeEnDebut: r(congesDebut),
    acquis: congesAcquisMois,
    pris: r(congesPris),
    solde: r(congesDebut + congesAcquisMois - congesPris)
  };

  // ─── COMPATIBILITÉ ancienne structure ────────────────────────────────────

  const cotisationsSalariales = {
    securiteSociale: 0,
    retraite: r(sal_vieilPlafo + sal_vieilDeplafo + sal_arrcoT1 + sal_ceg),
    assuranceChomage: 0,
    csg: r(sal_csgDed + sal_csgNonDed + sal_crds),
    total: totalSalarial
  };
  const cotisationsPatronales = {
    securiteSociale: r(pat_maladie + pat_mutuelle + pat_atmp),
    retraite: r(pat_vieilPlafo + pat_vieilDeplafo + pat_arrcoT1 + pat_ceg),
    assuranceChomage: r(pat_chomage + pat_ags),
    total: totalPatronal
  };

  return {
    // Rémunération
    salaireBase,
    heuresBase: HEURES_LEGALES,
    tauxHoraire,
    heuresSupplementaires: heuresSup,
    montantHeuresSup,
    primes,
    salaireBrut,

    // Cotisations détaillées
    lignesCotisations,

    // Totaux compatibilité
    cotisationsSalariales,
    cotisationsPatronales,

    // Net
    salaireNet: netAvantImpot,  // alias
    netAvantImpot,
    netImposable,
    tauxImpot: tauxImpot || 0,
    montantPAS,
    netAPayer,

    // Congés
    congesPayes
  };
};

/**
 * Alias pour rhController
 */
const generatePayslip = (employee, month, year) => {
  const salary = employee.salaireBase || employee.salary || 0;
  const tauxImpot = employee.tauxImpot || 0;
  const data = genererFichePaie(salary, 0, null, 0, tauxImpot);
  return { mois: month, annee: year, ...data };
};

module.exports = { genererFichePaie, generatePayslip, TAUX_COTISATIONS: {}, PMSS_2024, HEURES_LEGALES };
