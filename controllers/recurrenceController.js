const RecurringInvoice = require('../models/RecurringInvoice');
const Invoice = require('../models/Invoice');
const Company = require('../models/Company');
const { calculerTVA } = require('../utils/tvaCalculator');
const { sendSlack } = require('../utils/slack');
const { sendError } = require('../utils/errorResponse');

const freqToMonths = { mensuel: 1, trimestriel: 3, semestriel: 6, annuel: 12 };

exports.getRecurrences = async (req, res) => {
  try {
    const list = await RecurringInvoice.find({ company: req.user.company }).sort({ prochainEnvoi: 1 });
    res.json({ success: true, data: list });
  } catch (err) { sendError(res, err); }
};

exports.createRecurrence = async (req, res) => {
  try {
    const { clientNom, clientEmail, lignes, notes, frequence, prochainEnvoi } = req.body;
    if (!clientNom || !lignes || !lignes.length) return res.status(400).json({ success: false, message: 'Client et lignes requis' });
    const rec = await RecurringInvoice.create({
      company: req.user.company, clientNom, clientEmail, lignes, notes, frequence, prochainEnvoi: prochainEnvoi || new Date(), createdBy: req.user.id
    });
    res.status(201).json({ success: true, data: rec });
  } catch (err) { sendError(res, err); }
};

exports.updateRecurrence = async (req, res) => {
  try {
    const rec = await RecurringInvoice.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company }, req.body, { new: true }
    );
    if (!rec) return res.status(404).json({ success: false, message: 'Récurrence introuvable' });
    res.json({ success: true, data: rec });
  } catch (err) { sendError(res, err); }
};

exports.deleteRecurrence = async (req, res) => {
  try {
    await RecurringInvoice.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    res.json({ success: true, message: 'Récurrence supprimée' });
  } catch (err) { sendError(res, err); }
};

exports.genererDues = async (req, res) => {
  try {
    const now = new Date();
    const dues = await RecurringInvoice.find({ company: req.user.company, actif: true, prochainEnvoi: { $lte: now } });
    const generated = [];

    for (const rec of dues) {
      const montantHT = rec.lignes.reduce((s, l) => s + l.montantHT, 0);
      const { montantTVA, montantTTC, tauxTVA } = calculerTVA(montantHT);
      const count = await Invoice.countDocuments({ company: req.user.company });
      const year = new Date().getFullYear();
      const numero = `FAC-${year}-${String(count + 1).padStart(4, '0')}`;

      const inv = await Invoice.create({
        company: rec.company,
        numero,
        client: { nom: rec.clientNom, email: rec.clientEmail || '' },
        lignes: rec.lignes,
        montantHT, tauxTVA, montantTVA, montantTTC,
        notes: rec.notes,
        statut: 'brouillon',
        createdBy: rec.createdBy
      });
      generated.push(inv);

      const mois = freqToMonths[rec.frequence] || 1;
      const next = new Date(rec.prochainEnvoi);
      next.setMonth(next.getMonth() + mois);
      await RecurringInvoice.findByIdAndUpdate(rec._id, { prochainEnvoi: next, $inc: { facturesGenerees: 1 } });

      const company = await Company.findById(rec.company);
      if (company?.slackWebhookUrl) {
        await sendSlack(company.slackWebhookUrl, `📄 Facture récurrente générée : ${numero} — ${rec.clientNom} — ${montantTTC.toFixed(2)} €`);
      }
    }

    res.json({ success: true, data: { generated: generated.length, factures: generated } });
  } catch (err) { sendError(res, err); }
};
