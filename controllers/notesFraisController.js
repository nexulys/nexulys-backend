const NoteFrais = require('../models/NoteFrais');
const Company = require('../models/Company');
const { sendSlack } = require('../utils/slack');
const { notifyExpenseSubmitted } = require('../utils/notifications');
const { sendError } = require('../utils/errorResponse');

exports.getNotesFrais = async (req, res) => {
  try {
    const filter = { company: req.user.company };
    if (req.query.statut) filter.statut = req.query.statut;
    const notes = await NoteFrais.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: notes, count: notes.length });
  } catch (err) { sendError(res, err); }
};

exports.createNoteFrais = async (req, res) => {
  try {
    const { titre, montant, categorie, date, employeNom } = req.body;
    if (!titre || !montant) return res.status(400).json({ success: false, message: 'Titre et montant requis' });
    const note = await NoteFrais.create({
      company: req.user.company,
      titre, montant, categorie, date,
      employeNom: employeNom || 'Non précisé',
      createdBy: req.user.id
    });
    notifyExpenseSubmitted(req.user.company, { employeeNom: note.employeNom, montant: note.montant, titre: note.titre });
    res.status(201).json({ success: true, data: note });
  } catch (err) { sendError(res, err); }
};

exports.approuverNoteFrais = async (req, res) => {
  try {
    const note = await NoteFrais.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      { statut: 'approuvee' },
      { new: true }
    );
    if (!note) return res.status(404).json({ success: false, message: 'Note introuvable' });
    const company = await Company.findById(req.user.company);
    if (company?.slackWebhookUrl) {
      await sendSlack(company.slackWebhookUrl, `✅ Note de frais approuvée : *${note.titre}* — ${note.montant} €`);
    }
    res.json({ success: true, data: note });
  } catch (err) { sendError(res, err); }
};

exports.rejeterNoteFrais = async (req, res) => {
  try {
    const note = await NoteFrais.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      { statut: 'rejetee', commentaire: req.body.commentaire },
      { new: true }
    );
    if (!note) return res.status(404).json({ success: false, message: 'Note introuvable' });
    res.json({ success: true, data: note });
  } catch (err) { sendError(res, err); }
};

exports.rembourserNoteFrais = async (req, res) => {
  try {
    const note = await NoteFrais.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      { statut: 'remboursee', rembourseLe: new Date() },
      { new: true }
    );
    if (!note) return res.status(404).json({ success: false, message: 'Note introuvable' });
    res.json({ success: true, data: note });
  } catch (err) { sendError(res, err); }
};

exports.deleteNoteFrais = async (req, res) => {
  try {
    await NoteFrais.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    res.json({ success: true, message: 'Note supprimée' });
  } catch (err) { sendError(res, err); }
};
