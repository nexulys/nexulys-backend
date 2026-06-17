const crypto = require('crypto');
const ExpertAccess = require('../models/ExpertAccess');
const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Employee = require('../models/Employee');
const Company = require('../models/Company');

exports.createAccess = async (req, res) => {
  try {
    const { label, dureeJours = 90 } = req.body;
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + dureeJours * 24 * 60 * 60 * 1000);
    const access = await ExpertAccess.create({
      company: req.user.company, token, label: label || 'Expert-comptable', expiresAt
    });
    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
    res.status(201).json({ success: true, data: { ...access.toObject(), url: `${appUrl}/comptable.html?token=${token}` } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.listAccess = async (req, res) => {
  try {
    const list = await ExpertAccess.find({ company: req.user.company, actif: true }).sort({ createdAt: -1 });
    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
    const data = list.map(a => ({ ...a.toObject(), url: `${appUrl}/comptable.html?token=${a.token}` }));
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.revokeAccess = async (req, res) => {
  try {
    await ExpertAccess.findOneAndUpdate({ _id: req.params.id, company: req.user.company }, { actif: false });
    res.json({ success: true, message: 'Accès révoqué' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.viewAccess = async (req, res) => {
  try {
    const access = await ExpertAccess.findOne({ token: req.params.token, actif: true });
    if (!access) return res.status(404).json({ success: false, message: 'Lien invalide ou expiré' });
    if (access.expiresAt < new Date()) return res.status(403).json({ success: false, message: 'Lien expiré' });

    const company = await Company.findById(access.company);
    const now = new Date();
    const annee = now.getFullYear();
    const start = new Date(annee, 0, 1); const end = new Date(annee + 1, 0, 1);

    const [invoicesPayees, invoicesAll, expenses, nbEmployes] = await Promise.all([
      Invoice.find({ company: access.company, statut: 'payee', createdAt: { $gte: start, $lt: end } }),
      Invoice.find({ company: access.company }).sort({ createdAt: -1 }).limit(20),
      Expense.find({ company: access.company, date: { $gte: start, $lt: end } }).sort({ date: -1 }),
      Employee.countDocuments({ company: access.company, statut: 'actif' })
    ]);

    const caHT = invoicesPayees.reduce((s, i) => s + i.montantHT, 0);
    const totalCharges = expenses.reduce((s, e) => s + e.montant, 0);
    const resultatNet = caHT - totalCharges;

    await ExpertAccess.findByIdAndUpdate(access._id, { $inc: { views: 1 }, lastViewedAt: new Date() });

    res.json({
      success: true,
      data: {
        company: { nom: company.nom, siret: company.siret, adresse: company.adresse },
        annee,
        kpis: { caHT, totalCharges, resultatNet, nbEmployes, nbFactures: invoicesPayees.length },
        recentInvoices: invoicesAll,
        recentExpenses: expenses.slice(0, 15),
        label: access.label,
        expiresAt: access.expiresAt
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
