const ContratClient = require('../models/ContratClient');
const { sendError } = require('../utils/errorResponse');

exports.getContrats = async (req, res) => {
  try {
    const { statut } = req.query;
    const filter = { company: req.user.company };
    if (statut) filter.statut = statut;
    const contrats = await ContratClient.find(filter).sort({ dateFin: 1 });

    // Marquer automatiquement les contrats expirés
    const now = new Date();
    const expirantBientot = contrats.filter(c => {
      if (!c.dateFin || c.statut !== 'actif') return false;
      const daysLeft = Math.ceil((c.dateFin - now) / (1000 * 60 * 60 * 24));
      return daysLeft <= (c.alerteRenouvellement || 30);
    });

    res.json({ success: true, data: contrats, count: contrats.length, expirantBientot: expirantBientot.length });
  } catch (err) { sendError(res, err); }
};

exports.createContrat = async (req, res) => {
  try {
    const contrat = await ContratClient.create({ ...req.body, company: req.user.company, createdBy: req.user.id });
    res.status(201).json({ success: true, data: contrat });
  } catch (err) { sendError(res, err); }
};

exports.updateContrat = async (req, res) => {
  try {
    const contrat = await ContratClient.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company }, req.body, { new: true }
    );
    if (!contrat) return res.status(404).json({ success: false, message: 'Contrat introuvable' });
    res.json({ success: true, data: contrat });
  } catch (err) { sendError(res, err); }
};

exports.deleteContrat = async (req, res) => {
  try {
    await ContratClient.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    res.json({ success: true, message: 'Contrat supprimé' });
  } catch (err) { sendError(res, err); }
};

exports.getContratsExpirants = async (req, res) => {
  try {
    const now = new Date();
    const dans30Jours = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const contrats = await ContratClient.find({
      company: req.user.company,
      statut: 'actif',
      dateFin: { $gte: now, $lte: dans30Jours }
    }).sort({ dateFin: 1 });
    res.json({ success: true, data: contrats, count: contrats.length });
  } catch (err) { sendError(res, err); }
};
