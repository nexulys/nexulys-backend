const jwt = require('jsonwebtoken');
const Company = require('../models/Company');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Employee = require('../models/Employee');
const { sendError } = require('../utils/errorResponse');

exports.login = async (req, res) => {
  const { password } = req.body;
  const secret = process.env.ADMIN_SECRET;
  if (!secret)
    return res.status(503).json({ success: false, message: 'Panel admin non configuré (ADMIN_SECRET manquant)' });
  if (!password || password !== secret)
    return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
  const token = jwt.sign(
    { superAdmin: true, iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({ success: true, token });
};

exports.getOverview = async (req, res) => {
  try {
    const [subs, totalCompanies, totalUsers, totalInvoices, totalEmployees] = await Promise.all([
      Subscription.find({}).populate('company', 'nom email createdAt'),
      Company.countDocuments({}),
      User.countDocuments({}),
      Invoice.countDocuments({}),
      Employee.countDocuments({})
    ]);

    const active = subs.filter(s => ['actif', 'active'].includes(s.statut)).length;
    const trial = subs.filter(s => ['essai', 'trial'].includes(s.statut)).length;
    const suspended = subs.filter(s => ['suspendu'].includes(s.statut)).length;
    const cancelled = subs.filter(s => ['annule', 'cancelled'].includes(s.statut)).length;

    const mrr = subs
      .filter(s => ['actif', 'active'].includes(s.statut))
      .reduce((sum, s) => sum + (s.priceMonthly || 89), 0);
    const arr = mrr * 12;

    const allPayments = [];
    subs.forEach(s => {
      (s.billingHistory || []).forEach(b => {
        allPayments.push({
          companyNom: s.company ? s.company.nom : '—',
          montant: b.montant || 0,
          statut: b.statut || 'inconnu',
          date: b.date || null
        });
      });
    });
    allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalPaye = allPayments
      .filter(p => ['payé', 'succeeded', 'success'].includes(p.statut))
      .reduce((s, p) => s + p.montant, 0);

    const totalEchoue = allPayments
      .filter(p => ['échoué', 'failed', 'echec'].includes(p.statut))
      .length;

    res.json({
      success: true,
      data: {
        mrr,
        arr,
        totalPaye,
        totalCompanies,
        totalUsers,
        totalInvoices,
        totalEmployees,
        subscriptions: { total: subs.length, active, trial, suspended, cancelled },
        recentPayments: allPayments.slice(0, 30),
        paymentsEchoues: totalEchoue
      }
    });
  } catch (err) { sendError(res, err); }
};

exports.getClients = async (req, res) => {
  try {
    const companies = await Company.find({})
      .populate({ path: 'subscription' })
      .sort({ createdAt: -1 });

    const adminUsers = await User.find({ role: 'admin' }, 'nom prenom email company createdAt lastLogin');

    const rows = await Promise.all(companies.map(async c => {
      const admin = adminUsers.find(u => u.company && u.company.toString() === c._id.toString());
      const sub = c.subscription;
      const empCount = await Employee.countDocuments({ company: c._id });
      const invoiceCount = await Invoice.countDocuments({ company: c._id });

      return {
        id: c._id,
        nom: c.nom,
        siret: c.siret || '—',
        adminEmail: admin ? admin.email : (c.email || '—'),
        adminNom: admin ? `${admin.prenom} ${admin.nom}` : '—',
        secteur: c.secteur || '—',
        createdAt: c.createdAt,
        employes: empCount,
        factures: invoiceCount,
        subscription: sub ? {
          statut: sub.statut,
          plan: sub.plan || 'business',
          mrr: ['actif', 'active'].includes(sub.statut) ? (sub.priceMonthly || 89) : 0,
          trialEndsAt: sub.trialEndsAt,
          stripeCustomerId: sub.stripeCustomerId || null,
          billingCount: (sub.billingHistory || []).length
        } : null
      };
    }));

    const mrr = rows.reduce((s, r) => s + (r.subscription ? r.subscription.mrr : 0), 0);
    res.json({ success: true, data: rows, total: rows.length, mrr });
  } catch (err) { sendError(res, err); }
};

exports.getMRRChart = async (req, res) => {
  try {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString('fr', { month: 'short', year: '2-digit' }), nouveauxClients: 0, mrrEstime: 0, paiements: 0 });
    }

    const subs = await Subscription.find({}).sort({ createdAt: 1 });
    subs.forEach(s => {
      const d = new Date(s.createdAt);
      const m = months.find(x => x.year === d.getFullYear() && x.month === d.getMonth());
      if (m) {
        m.nouveauxClients++;
        if (['actif', 'active'].includes(s.statut)) m.mrrEstime += s.priceMonthly || 89;
      }
      (s.billingHistory || []).forEach(b => {
        if (!b.date) return;
        const bd = new Date(b.date);
        const bm = months.find(x => x.year === bd.getFullYear() && x.month === bd.getMonth());
        if (bm && ['payé', 'succeeded'].includes(b.statut)) bm.paiements += b.montant || 0;
      });
    });

    res.json({ success: true, data: months });
  } catch (err) { sendError(res, err); }
};

exports.getPayments = async (req, res) => {
  try {
    const subs = await Subscription.find({}).populate('company', 'nom');
    const payments = [];
    subs.forEach(s => {
      (s.billingHistory || []).forEach(b => {
        payments.push({
          companyNom: s.company ? s.company.nom : '—',
          stripeCustomerId: s.stripeCustomerId || null,
          montant: b.montant || 0,
          statut: b.statut || 'inconnu',
          date: b.date || null,
          subscriptionId: s._id
        });
      });
    });
    payments.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, data: payments, total: payments.length });
  } catch (err) { sendError(res, err); }
};
