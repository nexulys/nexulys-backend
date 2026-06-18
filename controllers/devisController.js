const crypto = require('crypto');
const Devis = require('../models/Devis');
const Invoice = require('../models/Invoice');
const { sendMail } = require('../utils/mailer');

const DEVISES = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF' };

const calcMontants = (lignes) => {
  const montantHT = lignes.reduce((s, l) => s + (l.montantHT || l.quantite * l.prixUnitaire), 0);
  const montantTVA = lignes.reduce((s, l) => s + (l.montantHT || l.quantite * l.prixUnitaire) * (l.tva || 20) / 100, 0);
  return { montantHT, montantTVA, montantTTC: montantHT + montantTVA };
};

exports.getDevis = async (req, res) => {
  try {
    const filter = { company: req.user.company };
    if (req.query.statut) filter.statut = req.query.statut;
    const devis = await Devis.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: devis, count: devis.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createDevis = async (req, res) => {
  try {
    const { client, lignes, notes, dateValidite, devise } = req.body;
    if (!client?.nom || !lignes?.length) return res.status(400).json({ success: false, message: 'Client et lignes requis' });
    const { montantHT, montantTVA, montantTTC } = calcMontants(lignes);
    const count = await Devis.countDocuments({ company: req.user.company });
    const numero = `DEV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const devis = await Devis.create({
      company: req.user.company,
      numero, client, lignes, montantHT, montantTVA, montantTTC,
      notes, devise: devise || 'EUR',
      dateValidite: dateValidite || new Date(Date.now() + 30 * 86400000),
      createdBy: req.user.id
    });
    res.status(201).json({ success: true, data: devis });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateDevis = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (req.body.lignes) {
      const { montantHT, montantTVA, montantTTC } = calcMontants(req.body.lignes);
      Object.assign(updates, { montantHT, montantTVA, montantTTC });
    }
    const devis = await Devis.findOneAndUpdate({ _id: req.params.id, company: req.user.company }, updates, { new: true });
    if (!devis) return res.status(404).json({ success: false, message: 'Devis introuvable' });
    res.json({ success: true, data: devis });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteDevis = async (req, res) => {
  try {
    const devis = await Devis.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    if (!devis) return res.status(404).json({ success: false, message: 'Devis introuvable' });
    res.json({ success: true, message: 'Devis supprimé' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.envoyerDevis = async (req, res) => {
  try {
    const devis = await Devis.findOne({ _id: req.params.id, company: req.user.company });
    if (!devis) return res.status(404).json({ success: false, message: 'Devis introuvable' });
    const token = crypto.randomBytes(24).toString('hex');
    devis.signatureToken = token;
    devis.statut = 'envoye';
    await devis.save();
    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    const url = `${appUrl}/signer.html?token=${token}`;
    const symbole = DEVISES[devis.devise] || '€';
    await sendMail({
      to: devis.client.email,
      subject: `Devis ${devis.numero} — à signer`,
      html: `<h2>Devis ${devis.numero}</h2><p>Bonjour ${devis.client.nom},</p><p>Vous trouverez ci-joint votre devis d'un montant de <strong>${devis.montantTTC.toFixed(2)} ${symbole} TTC</strong>.</p><p><a href="${url}" style="background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Consulter et signer le devis</a></p><p style="color:#999;font-size:12px;">Lien valide jusqu'au ${new Date(devis.dateValidite).toLocaleDateString('fr-FR')}</p>`
    });
    res.json({ success: true, data: { url }, message: 'Devis envoyé' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.convertirEnFacture = async (req, res) => {
  try {
    const devis = await Devis.findOne({ _id: req.params.id, company: req.user.company });
    if (!devis) return res.status(404).json({ success: false, message: 'Devis introuvable' });
    if (devis.factureId) return res.status(400).json({ success: false, message: 'Déjà converti en facture' });
    const count = await Invoice.countDocuments({ company: req.user.company });
    const numero = `FAC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const invoice = await Invoice.create({
      company: req.user.company,
      numero,
      client: devis.client,
      lignes: devis.lignes.map(l => ({ description: l.description, quantite: l.quantite, prixUnitaire: l.prixUnitaire, montantHT: l.montantHT })),
      montantHT: devis.montantHT,
      tauxTVA: 20,
      montantTVA: devis.montantTVA,
      montantTTC: devis.montantTTC,
      notes: devis.notes,
      statut: 'brouillon',
      createdBy: req.user.id
    });
    devis.factureId = invoice._id;
    devis.statut = 'accepte';
    await devis.save();
    res.json({ success: true, data: invoice, message: 'Facture créée depuis le devis' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Routes publiques ──
exports.viewDevis = async (req, res) => {
  try {
    const devis = await Devis.findOne({ signatureToken: req.params.token });
    if (!devis) return res.status(404).json({ success: false, message: 'Devis introuvable ou expiré' });
    if (devis.dateValidite && new Date(devis.dateValidite) < new Date()) {
      devis.statut = 'expire'; await devis.save();
      return res.status(410).json({ success: false, message: 'Devis expiré' });
    }
    res.json({ success: true, data: devis });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.signerDevis = async (req, res) => {
  try {
    const devis = await Devis.findOne({ signatureToken: req.params.token });
    if (!devis || devis.signedAt) return res.status(400).json({ success: false, message: 'Devis invalide ou déjà signé' });
    if (devis.dateValidite && new Date(devis.dateValidite) < new Date()) return res.status(410).json({ success: false, message: 'Devis expiré' });
    devis.signedAt = new Date();
    devis.signatureIP = req.ip;
    devis.statut = 'accepte';
    await devis.save();
    res.json({ success: true, message: 'Devis signé avec succès' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
