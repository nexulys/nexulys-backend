const crypto = require('crypto');
const ContratClient = require('../models/ContratClient');
const Company = require('../models/Company');
const { sendMail } = require('../utils/mailer');
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

// ── Signature électronique du contrat ──

// Envoie le contrat au client pour signature (génère un lien public)
exports.envoyerContratSignature = async (req, res) => {
  try {
    const contrat = await ContratClient.findOne({ _id: req.params.id, company: req.user.company });
    if (!contrat) return res.status(404).json({ success: false, message: 'Contrat introuvable' });
    if (contrat.signe) return res.status(400).json({ success: false, message: 'Contrat déjà signé' });

    const token = crypto.randomBytes(24).toString('hex');
    contrat.signatureToken = token;
    await contrat.save();

    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    const url = `${appUrl}/signer-contrat.html?token=${token}`;
    const company = await Company.findById(req.user.company);

    if (contrat.client?.email) {
      await sendMail({
        to: contrat.client.email,
        subject: `Contrat « ${contrat.titre} » — à signer`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
          <h2 style="color:#6366f1">Contrat à signer</h2>
          <p>Bonjour ${contrat.client.nom},</p>
          <p>${company?.nom || 'Votre prestataire'} vous invite à signer le contrat <strong>« ${contrat.titre} »</strong>${contrat.valeur ? ` d'une valeur de <strong>${contrat.valeur.toFixed(2)} €</strong>` : ''}.</p>
          <p><a href="${url}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Consulter et signer le contrat</a></p>
          <p style="color:#999;font-size:12px">Signature électronique horodatée — Novexa by Nexulys</p>
        </div>`
      });
    }
    res.json({ success: true, data: { url }, message: contrat.client?.email ? 'Contrat envoyé pour signature' : 'Lien de signature généré' });
  } catch (err) { sendError(res, err); }
};

// Consultation publique du contrat via token (page de signature)
exports.viewContratPublic = async (req, res) => {
  try {
    const contrat = await ContratClient.findOne({ signatureToken: req.params.token })
      .select('reference titre type client valeur periodicite dateDebut dateFin notes signe signedAt signataire');
    if (!contrat) return res.status(404).json({ success: false, message: 'Contrat introuvable' });
    res.json({ success: true, data: contrat });
  } catch (err) { sendError(res, err); }
};

// Signature publique du contrat
exports.signerContrat = async (req, res) => {
  try {
    const contrat = await ContratClient.findOne({ signatureToken: req.params.token });
    if (!contrat) return res.status(404).json({ success: false, message: 'Contrat introuvable' });
    if (contrat.signe) return res.status(400).json({ success: false, message: 'Contrat déjà signé' });
    const signataire = (req.body.signataire || contrat.client?.nom || '').toString().trim();
    if (!signataire) return res.status(400).json({ success: false, message: 'Nom du signataire requis' });
    contrat.signe = true;
    contrat.signataire = signataire;
    contrat.signedAt = new Date();
    contrat.signatureIP = req.ip;
    contrat.statut = 'actif';
    await contrat.save();
    res.json({ success: true, message: 'Contrat signé avec succès' });
  } catch (err) { sendError(res, err); }
};
