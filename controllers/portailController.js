const crypto = require('crypto');
const ClientPortal = require('../models/ClientPortal');
const Invoice = require('../models/Invoice');
const Company = require('../models/Company');
const { sendError } = require('../utils/errorResponse');

exports.createPortal = async (req, res) => {
  try {
    const { clientNom, clientEmail, dureeJours = 30 } = req.body;
    if (!clientNom) return res.status(400).json({ success: false, message: 'Nom du client requis' });
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + dureeJours * 24 * 60 * 60 * 1000);
    const portal = await ClientPortal.create({ company: req.user.company, clientNom, clientEmail, token, expiresAt });
    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
    res.status(201).json({ success: true, data: { ...portal.toObject(), url: `${appUrl}/portail.html?token=${token}` } });
  } catch (err) { sendError(res, err); }
};

exports.listPortals = async (req, res) => {
  try {
    const list = await ClientPortal.find({ company: req.user.company }).sort({ createdAt: -1 });
    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
    const data = list.map(p => ({ ...p.toObject(), url: `${appUrl}/portail.html?token=${p.token}` }));
    res.json({ success: true, data });
  } catch (err) { sendError(res, err); }
};

exports.viewPortal = async (req, res) => {
  try {
    const portal = await ClientPortal.findOne({ token: req.params.token, actif: true });
    if (!portal) return res.status(404).json({ success: false, message: 'Lien invalide' });
    if (portal.expiresAt < new Date()) return res.status(403).json({ success: false, message: 'Lien expiré' });

    const company = await Company.findById(portal.company);
    const invoices = await Invoice.find({
      company: portal.company,
      'client.nom': { $regex: new RegExp(portal.clientNom, 'i') }
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        company: { nom: company?.nom, email: company?.email, telephone: company?.telephone },
        clientNom: portal.clientNom,
        invoices,
        expiresAt: portal.expiresAt
      }
    });
  } catch (err) { sendError(res, err); }
};

exports.payerFacture = async (req, res) => {
  try {
    const portal = await ClientPortal.findOne({ token: req.params.token, actif: true });
    if (!portal || portal.expiresAt < new Date()) return res.status(403).json({ success: false, message: 'Lien invalide ou expiré' });

    const invoice = await Invoice.findOne({ _id: req.params.invoiceId, company: portal.company, statut: { $ne: 'payee' } });
    if (!invoice) return res.status(404).json({ success: false, message: 'Facture introuvable ou déjà payée' });

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.json({ success: false, message: 'Paiement en ligne non configuré (STRIPE_SECRET_KEY manquant)' });
    }

    const Stripe = require('stripe');
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(invoice.montantTTC * 100),
          product_data: { name: `Facture ${invoice.numero}` }
        },
        quantity: 1
      }],
      success_url: `${appUrl}/portail.html?token=${req.params.token}&paid=1`,
      cancel_url: `${appUrl}/portail.html?token=${req.params.token}`,
      metadata: { invoiceId: invoice._id.toString(), companyId: portal.company.toString() }
    });

    res.json({ success: true, data: { url: session.url } });
  } catch (err) { sendError(res, err); }
};
