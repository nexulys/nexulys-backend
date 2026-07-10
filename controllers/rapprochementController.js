const RapprochementBancaire = require('../models/RapprochementBancaire');
const { sendError } = require('../utils/errorResponse');

exports.getRapprochements = async (req, res) => {
  try {
    const releves = await RapprochementBancaire.find({ company: req.user.company }).sort({ createdAt: -1 });
    const data = releves.map(r => {
      const obj = r.toObject();
      obj.nbTransactions = r.transactions.length;
      obj.nbNonRapproches = r.transactions.filter(t => !t.rapproche).length;
      return obj;
    });
    res.json({ success: true, data, count: data.length });
  } catch (err) { sendError(res, err); }
};

exports.createReleve = async (req, res) => {
  try {
    const { banque, compte, periode, soldeOuverture, soldeCloture, transactions } = req.body;
    const releve = await RapprochementBancaire.create({
      company: req.user.company,
      banque,
      compte,
      periode,
      soldeOuverture,
      soldeCloture,
      transactions: (transactions || []).map(t => ({
        date: t.date,
        libelle: t.libelle,
        montant: t.montant,
        rapproche: false
      })),
      createdBy: req.user.id
    });
    res.status(201).json({ success: true, data: releve });
  } catch (err) { sendError(res, err); }
};

exports.rapprochierTransaction = async (req, res) => {
  try {
    const { releveId, idx } = req.params;
    const { factureId, depenseId } = req.body;
    const index = parseInt(idx);

    const releve = await RapprochementBancaire.findOne({ _id: releveId, company: req.user.company });
    if (!releve) return res.status(404).json({ success: false, message: 'Relevé introuvable' });
    if (index < 0 || index >= releve.transactions.length) {
      return res.status(400).json({ success: false, message: 'Index de transaction invalide' });
    }

    releve.transactions[index].rapproche = true;
    if (factureId) releve.transactions[index].factureId = factureId;
    if (depenseId) releve.transactions[index].depenseId = depenseId;

    await releve.save();
    res.json({ success: true, data: releve, message: 'Transaction rapprochée' });
  } catch (err) { sendError(res, err); }
};

exports.deleteReleve = async (req, res) => {
  try {
    const releve = await RapprochementBancaire.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    if (!releve) return res.status(404).json({ success: false, message: 'Relevé introuvable' });
    res.json({ success: true, message: 'Relevé supprimé' });
  } catch (err) { sendError(res, err); }
};

exports.validerReleve = async (req, res) => {
  try {
    const releve = await RapprochementBancaire.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      { statut: 'valide' },
      { new: true }
    );
    if (!releve) return res.status(404).json({ success: false, message: 'Relevé introuvable' });
    res.json({ success: true, data: releve, message: 'Relevé validé' });
  } catch (err) { sendError(res, err); }
};
