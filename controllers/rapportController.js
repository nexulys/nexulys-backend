const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Employee = require('../models/Employee');
const Task = require('../models/Task');
const Product = require('../models/Product');
const Company = require('../models/Company');
const { sendMail } = require('../utils/mailer');
const { sendError } = require('../utils/errorResponse');

exports.getRapportMensuel = async (req, res) => {
  try {
    const { mois } = req.query;
    const ref = mois ? new Date(mois + '-01') : new Date();
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    const moisLabel = start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const [invoicesPayees, invoicesTotal, expenses, employes, tachesTerminees, alertesStock] = await Promise.all([
      Invoice.find({ company: req.user.company, statut: 'payee', createdAt: { $gte: start, $lt: end } }),
      Invoice.find({ company: req.user.company, createdAt: { $gte: start, $lt: end } }),
      Expense.find({ company: req.user.company, date: { $gte: start, $lt: end } }),
      Employee.countDocuments({ company: req.user.company, statut: 'actif' }),
      Task.countDocuments({ company: req.user.company, statut: 'termine', updatedAt: { $gte: start, $lt: end } }),
      Product.countDocuments({ company: req.user.company, actif: true, alerteActive: true })
    ]);

    const caHT = invoicesPayees.reduce((s, i) => s + i.montantHT, 0);
    const caTTC = invoicesPayees.reduce((s, i) => s + i.montantTTC, 0);
    const totalCharges = expenses.reduce((s, e) => s + e.montant, 0);
    const resultat = caHT - totalCharges;
    const tauxRecouvrement = invoicesTotal.length ? Math.round((invoicesPayees.length / invoicesTotal.length) * 100) : 0;

    const top5Clients = invoicesPayees.reduce((acc, i) => {
      const nom = i.client?.nom || 'Inconnu';
      acc[nom] = (acc[nom] || 0) + i.montantTTC;
      return acc;
    }, {});
    const topClients = Object.entries(top5Clients).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nom, montant]) => ({ nom, montant }));

    const chargesParCat = expenses.reduce((acc, e) => {
      acc[e.categorie] = (acc[e.categorie] || 0) + e.montant;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        mois: moisLabel,
        periode: { start, end },
        finances: { caHT, caTTC, totalCharges, resultat, tauxRecouvrement },
        factures: { total: invoicesTotal.length, payees: invoicesPayees.length },
        employes,
        tachesTerminees,
        alertesStock,
        topClients,
        chargesParCat
      }
    });
  } catch (err) { sendError(res, err); }
};

exports.envoyerRapportEmail = async (req, res) => {
  try {
    const { email, mois } = req.body;
    const dest = email || req.user.email;
    if (!dest) return res.status(400).json({ success: false, message: 'Email destinataire requis' });

    const ref = mois ? new Date(mois + '-01') : new Date();
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    const moisLabel = start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const [invoicesPayees, invoicesTotal, expenses] = await Promise.all([
      Invoice.find({ company: req.user.company, statut: 'payee', createdAt: { $gte: start, $lt: end } }),
      Invoice.find({ company: req.user.company, createdAt: { $gte: start, $lt: end } }),
      Expense.find({ company: req.user.company, date: { $gte: start, $lt: end } })
    ]);

    const caHT = invoicesPayees.reduce((s, i) => s + i.montantHT, 0);
    const totalCharges = expenses.reduce((s, e) => s + e.montant, 0);
    const resultat = caHT - totalCharges;
    const fmt = n => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

    const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:32px;border-radius:12px;">
  <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;border-radius:10px;margin-bottom:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Rapport mensuel Novexa</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">${moisLabel}</p>
  </div>
  <div style="display:grid;gap:16px;">
    <div style="background:#fff;padding:20px;border-radius:10px;border-left:4px solid #6366f1;">
      <div style="font-size:12px;color:#888;margin-bottom:4px;">CHIFFRE D'AFFAIRES HT</div>
      <div style="font-size:28px;font-weight:800;color:#111;">${fmt(caHT)}</div>
    </div>
    <div style="background:#fff;padding:20px;border-radius:10px;border-left:4px solid #f87171;">
      <div style="font-size:12px;color:#888;margin-bottom:4px;">TOTAL CHARGES</div>
      <div style="font-size:28px;font-weight:800;color:#111;">${fmt(totalCharges)}</div>
    </div>
    <div style="background:#fff;padding:20px;border-radius:10px;border-left:4px solid ${resultat >= 0 ? '#34d399' : '#f87171'};">
      <div style="font-size:12px;color:#888;margin-bottom:4px;">RÉSULTAT NET</div>
      <div style="font-size:28px;font-weight:800;color:${resultat >= 0 ? '#059669' : '#dc2626'};">${resultat >= 0 ? '+' : ''}${fmt(resultat)}</div>
    </div>
    <div style="background:#fff;padding:20px;border-radius:10px;">
      <div style="font-size:12px;color:#888;margin-bottom:8px;">FACTURES</div>
      <div style="font-size:14px;color:#333;">${invoicesPayees.length} factures encaissées sur ${invoicesTotal.length} émises</div>
    </div>
  </div>
  <p style="text-align:center;font-size:12px;color:#aaa;margin-top:24px;">Rapport généré automatiquement par Novexa by Nexulys</p>
</div>`;

    await sendMail({ to: dest, subject: `Rapport mensuel Novexa — ${moisLabel}`, html });
    res.json({ success: true, message: `Rapport envoyé à ${dest}` });
  } catch (err) { sendError(res, err); }
};
