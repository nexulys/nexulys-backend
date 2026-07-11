const { rechercherEntreprise } = require('../utils/sirene');
const { sendError } = require('../utils/errorResponse');

// GET /api/entreprise/recherche?q=... — recherche SIRENE (SIRET/SIREN ou nom)
exports.rechercher = async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || String(q).trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Saisissez au moins 3 caractères (SIRET ou nom).' });
    }
    const results = await rechercherEntreprise(q);
    res.json({ success: true, data: results });
  } catch (err) { sendError(res, err); }
};
