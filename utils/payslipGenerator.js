/**
 * Génère les données d'une fiche de paie avec les cotisations françaises
 * Taux approximatifs pour illustration
 */

const TAUX_COTISATIONS = {
  salariales: {
    securiteSociale: 0.0075,   // 0.75%
    retraiteBase: 0.0690,      // 6.90%
    retraiteComplementaire: 0.0386, // 3.86%
    assuranceChomage: 0.0240,  // 2.40%
    csgDeductible: 0.0680,     // 6.80%
    csgNonDeductible: 0.0235   // 2.35%
  },
  patronales: {
    securiteSociale: 0.1300,   // 13.00%
    retraiteBase: 0.0855,      // 8.55%
    retraiteComplementaire: 0.0578, // 5.78%
    assuranceChomage: 0.0405   // 4.05%
  }
};

/**
 * Calcule les cotisations et le salaire net
 * @param {number} salaireBase
 * @param {number} heuresSup - Nombre d'heures supplémentaires
 * @param {number} tauxHeureSup - Taux horaire des heures sup (défaut 125% du taux normal)
 * @param {number} primes
 */
const genererFichePaie = (salaireBase, heuresSup = 0, tauxHeureSup = null, primes = 0) => {
  const tauxHoraire = salaireBase / 151.67; // Base mensuelle légale
  const tauxHeureSupEffectif = tauxHeureSup || tauxHoraire * 1.25;
  const montantHeuresSup = parseFloat((heuresSup * tauxHeureSupEffectif).toFixed(2));

  const salaireBrut = parseFloat((salaireBase + montantHeuresSup + primes).toFixed(2));

  // Cotisations salariales
  const cotSec = parseFloat((salaireBrut * TAUX_COTISATIONS.salariales.securiteSociale).toFixed(2));
  const cotRetraite = parseFloat((salaireBrut * (TAUX_COTISATIONS.salariales.retraiteBase + TAUX_COTISATIONS.salariales.retraiteComplementaire)).toFixed(2));
  const cotChomage = parseFloat((salaireBrut * TAUX_COTISATIONS.salariales.assuranceChomage).toFixed(2));
  const cotCSG = parseFloat((salaireBrut * (TAUX_COTISATIONS.salariales.csgDeductible + TAUX_COTISATIONS.salariales.csgNonDeductible)).toFixed(2));
  const totalCotSalariales = parseFloat((cotSec + cotRetraite + cotChomage + cotCSG).toFixed(2));

  // Cotisations patronales
  const patSec = parseFloat((salaireBrut * TAUX_COTISATIONS.patronales.securiteSociale).toFixed(2));
  const patRetraite = parseFloat((salaireBrut * (TAUX_COTISATIONS.patronales.retraiteBase + TAUX_COTISATIONS.patronales.retraiteComplementaire)).toFixed(2));
  const patChomage = parseFloat((salaireBrut * TAUX_COTISATIONS.patronales.assuranceChomage).toFixed(2));
  const totalCotPatronales = parseFloat((patSec + patRetraite + patChomage).toFixed(2));

  const salaireNet = parseFloat((salaireBrut - totalCotSalariales).toFixed(2));

  return {
    salaireBase,
    heuresSupplementaires: heuresSup,
    montantHeuresSup,
    primes,
    salaireBrut,
    cotisationsSalariales: {
      securiteSociale: cotSec,
      retraite: cotRetraite,
      assuranceChomage: cotChomage,
      csg: cotCSG,
      total: totalCotSalariales
    },
    cotisationsPatronales: {
      securiteSociale: patSec,
      retraite: patRetraite,
      assuranceChomage: patChomage,
      total: totalCotPatronales
    },
    salaireNet
  };
};

/**
 * Alias used by rhController - generates payslip data for an employee object
 */
const generatePayslip = (employee, month, year) => {
  const salary = employee.salaireBase || employee.salary || 0;
  const data = genererFichePaie(salary);
  return {
    mois: month,
    annee: year,
    ...data
  };
};

module.exports = { genererFichePaie, generatePayslip, TAUX_COTISATIONS };
