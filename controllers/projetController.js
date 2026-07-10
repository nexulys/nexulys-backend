const Projet = require('../models/Projet');
const TimeEntry = require('../models/TimeEntry');
const { sendError } = require('../utils/errorResponse');

exports.getProjets = async (req, res) => {
  try {
    const projets = await Projet.find({ company: req.user.company }).sort({ createdAt: -1 });
    const ids = projets.map(p => p._id);
    const entries = await TimeEntry.find({ company: req.user.company, projet: { $in: ids } });
    const projetsAvecStats = projets.map(p => {
      const pEntries = entries.filter(e => e.projet.toString() === p._id.toString());
      const totalHeures = pEntries.reduce((s, e) => s + e.heures, 0);
      const totalFacturable = pEntries.filter(e => e.facturable).reduce((s, e) => s + e.heures, 0);
      const valeurFacturee = totalFacturable * (p.tjm / 8 || 0);
      const rentabilite = p.budget > 0 ? Math.round(valeurFacturee / p.budget * 100) : null;
      return { ...p.toObject(), totalHeures, totalFacturable, valeurFacturee: Math.round(valeurFacturee), rentabilite };
    });
    res.json({ success: true, data: projetsAvecStats, count: projets.length });
  } catch (err) { sendError(res, err); }
};

exports.createProjet = async (req, res) => {
  try {
    if (!req.body.nom) return res.status(400).json({ success: false, message: 'Nom requis' });
    const projet = await Projet.create({ ...req.body, company: req.user.company, createdBy: req.user.id });
    res.status(201).json({ success: true, data: projet });
  } catch (err) { sendError(res, err); }
};

exports.updateProjet = async (req, res) => {
  try {
    const projet = await Projet.findOneAndUpdate({ _id: req.params.id, company: req.user.company }, req.body, { new: true });
    if (!projet) return res.status(404).json({ success: false, message: 'Projet introuvable' });
    res.json({ success: true, data: projet });
  } catch (err) { sendError(res, err); }
};

exports.deleteProjet = async (req, res) => {
  try {
    await Projet.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    await TimeEntry.deleteMany({ projet: req.params.id, company: req.user.company });
    res.json({ success: true, message: 'Projet supprimé' });
  } catch (err) { sendError(res, err); }
};

exports.getTimeEntries = async (req, res) => {
  try {
    const filter = { company: req.user.company };
    if (req.params.projetId) filter.projet = req.params.projetId;
    const entries = await TimeEntry.find(filter).sort({ date: -1 }).limit(100);
    res.json({ success: true, data: entries });
  } catch (err) { sendError(res, err); }
};

exports.addTimeEntry = async (req, res) => {
  try {
    const { projetId, heures, description, date, facturable, employeNom } = req.body;
    if (!projetId || !heures) return res.status(400).json({ success: false, message: 'Projet et heures requis' });
    const projet = await Projet.findOne({ _id: projetId, company: req.user.company });
    if (!projet) return res.status(404).json({ success: false, message: 'Projet introuvable' });
    const entry = await TimeEntry.create({
      company: req.user.company,
      projet: projetId,
      employeNom: employeNom || 'Moi',
      heures, description, facturable: facturable !== false,
      date: date ? new Date(date) : new Date(),
      createdBy: req.user.id
    });
    res.status(201).json({ success: true, data: entry });
  } catch (err) { sendError(res, err); }
};

exports.deleteTimeEntry = async (req, res) => {
  try {
    await TimeEntry.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    res.json({ success: true, message: 'Entrée supprimée' });
  } catch (err) { sendError(res, err); }
};
