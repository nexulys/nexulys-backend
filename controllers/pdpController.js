const Invoice = require('../models/Invoice');
const Company = require('../models/Company');
const pdpService = require('../services/pdpService');
const { sendError } = require('../utils/errorResponse');

// Renseigne l'état de la configuration PDP (jamais la clé) — pour l'UI/diagnostic.
exports.getInfos = async (req, res) => {
  try {
    res.json({ success: true, data: pdpService.infos() });
  } catch (err) { sendError(res, err); }
};

// Transmet une facture via la PDP configurée et persiste le résultat du cycle de vie.
exports.transmettreFacture = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, company: req.user.company });
    if (!invoice) return res.status(404).json({ success: false, message: 'Facture introuvable' });
    const company = await Company.findById(req.user.company);

    const r = await pdpService.emettreFacture(invoice, company || {});
    if (!r.configured) {
      return res.status(503).json({ success: false, message: r.message, data: r });
    }
    if (!r.transmitted) {
      return res.status(502).json({ success: false, message: r.error || 'Transmission refusée par la PDP', data: r });
    }

    invoice.pdp = invoice.pdp || {};
    invoice.pdp.provider = r.provider;
    invoice.pdp.transmissionId = r.transmissionId;
    invoice.pdp.statut = r.statut;
    invoice.pdp.statutLabel = r.statutLabel;
    invoice.pdp.lastSyncAt = new Date();
    invoice.pdp.history = invoice.pdp.history || [];
    invoice.pdp.history.push({ statut: r.statut, label: r.statutLabel, at: new Date() });
    if (invoice.statut === 'brouillon') invoice.statut = 'envoyee';
    await invoice.save();

    res.json({ success: true, message: `Facture transmise via ${r.provider}`, data: invoice.pdp });
  } catch (err) { sendError(res, err); }
};

// Rafraîchit le statut du cycle de vie d'une facture déjà transmise.
exports.rafraichirStatut = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, company: req.user.company });
    if (!invoice) return res.status(404).json({ success: false, message: 'Facture introuvable' });
    if (!invoice.pdp || !invoice.pdp.transmissionId) {
      return res.status(400).json({ success: false, message: 'Cette facture n\'a pas encore été transmise à une PDP.' });
    }

    const r = await pdpService.statutFacture(invoice.pdp.transmissionId);
    if (r.error) return res.status(502).json({ success: false, message: r.error, data: invoice.pdp });

    if (r.statut && r.statut !== invoice.pdp.statut) {
      invoice.pdp.history = invoice.pdp.history || [];
      invoice.pdp.history.push({ statut: r.statut, label: r.statutLabel, at: new Date() });
    }
    invoice.pdp.statut = r.statut;
    invoice.pdp.statutLabel = r.statutLabel;
    invoice.pdp.lastSyncAt = new Date();
    if (r.statut === 'encaissee' && invoice.statut !== 'payee') invoice.statut = 'payee';
    await invoice.save();

    res.json({ success: true, data: invoice.pdp });
  } catch (err) { sendError(res, err); }
};

// Liste les factures fournisseurs entrantes reçues via la PDP.
exports.recevoirFactures = async (req, res) => {
  try {
    const r = await pdpService.recevoirFactures();
    if (!r.configured) {
      return res.status(503).json({ success: false, message: 'Aucune PDP configurée.', data: { factures: [] } });
    }
    if (r.error) return res.status(502).json({ success: false, message: r.error, data: { factures: [] } });
    res.json({ success: true, data: { provider: r.provider, factures: r.factures } });
  } catch (err) { sendError(res, err); }
};
