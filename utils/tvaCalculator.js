/**
 * Calcule la TVA et les montants associés
 * @param {number} montantHT - Montant hors taxes
 * @param {number} tauxTVA - Taux de TVA en pourcentage (défaut: 20%)
 * @returns {{ montantHT, tauxTVA, montantTVA, montantTTC }}
 */
const calculerTVA = (montantHT, tauxTVA = 20) => {
  const montantTVA = parseFloat((montantHT * tauxTVA / 100).toFixed(2));
  const montantTTC = parseFloat((montantHT + montantTVA).toFixed(2));
  return {
    montantHT: parseFloat(montantHT.toFixed(2)),
    tauxTVA,
    montantTVA,
    montantTTC
  };
};

/**
 * Calcule le montant HT depuis un montant TTC
 * @param {number} montantTTC
 * @param {number} tauxTVA
 */
const htDepuisTTC = (montantTTC, tauxTVA = 20) => {
  const montantHT = parseFloat((montantTTC / (1 + tauxTVA / 100)).toFixed(2));
  const montantTVA = parseFloat((montantTTC - montantHT).toFixed(2));
  return { montantHT, montantTVA, montantTTC: parseFloat(montantTTC.toFixed(2)), tauxTVA };
};

// Alias for English naming convention used in some controllers
const calculateTVA = (montantHT, tauxTVA = 20) => {
  const tva = parseFloat((montantHT * tauxTVA / 100).toFixed(2));
  const total = parseFloat((montantHT + tva).toFixed(2));
  return { tva, total, montantHT: parseFloat(montantHT.toFixed(2)), tauxTVA };
};

module.exports = { calculerTVA, htDepuisTTC, calculateTVA };
