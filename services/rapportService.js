const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Company = require('../models/Company');
const User = require('../models/User');
const { sendMail } = require('../utils/mailer');
const logger = require('../utils/logger');

const fmt = (n) => (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const buildHtml = (moisLabel, data) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:32px;border-radius:12px;">
  <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;border-radius:10px;margin-bottom:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Votre rapport Novexa</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">${moisLabel}</p>
  </div>
  <div style="display:grid;gap:16px;">
    <div style="background:#fff;padding:20px;border-radius:10px;border-left:4px solid #6366f1;">
      <div style="font-size:12px;color:#888;margin-bottom:4px;">CHIFFRE D'AFFAIRES HT</div>
      <div style="font-size:28px;font-weight:800;color:#111;">${fmt(data.caHT)}</div>
    </div>
    <div style="background:#fff;padding:20px;border-radius:10px;border-left:4px solid #f87171;">
      <div style="font-size:12px;color:#888;margin-bottom:4px;">TOTAL CHARGES</div>
      <div style="font-size:28px;font-weight:800;color:#111;">${fmt(data.totalCharges)}</div>
    </div>
    <div style="background:#fff;padding:20px;border-radius:10px;border-left:4px solid ${data.resultat >= 0 ? '#34d399' : '#f87171'};">
      <div style="font-size:12px;color:#888;margin-bottom:4px;">RÉSULTAT NET</div>
      <div style="font-size:28px;font-weight:800;color:${data.resultat >= 0 ? '#059669' : '#dc2626'};">${data.resultat >= 0 ? '+' : ''}${fmt(data.resultat)}</div>
    </div>
    <div style="background:#fff;padding:20px;border-radius:10px;border-left:4px solid #fbbf24;">
      <div style="font-size:12px;color:#888;margin-bottom:4px;">À ENCAISSER (IMPAYÉS)</div>
      <div style="font-size:22px;font-weight:800;color:#111;">${fmt(data.montantImpaye)} <span style="font-size:13px;color:#888;">· ${data.nbImpayees} facture(s)</span></div>
    </div>
    <div style="background:#fff;padding:20px;border-radius:10px;">
      <div style="font-size:12px;color:#888;margin-bottom:8px;">ACTIVITÉ</div>
      <div style="font-size:14px;color:#333;">${data.nbEncaissees} factures encaissées sur ${data.nbEmises} émises</div>
    </div>
  </div>
  <p style="text-align:center;font-size:12px;color:#aaa;margin-top:24px;">Rapport généré automatiquement par Novexa by Nexulys — vous pouvez le désactiver depuis vos paramètres.</p>
</div>`;

/** Calcule et envoie le rapport d'une entreprise pour un mois donné. */
const envoyerRapportCompany = async (companyId, destEmail, refDate) => {
  const ref = refDate ? new Date(refDate) : new Date();
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  const moisLabel = start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const [payees, emises, expenses, impayees] = await Promise.all([
    Invoice.find({ company: companyId, statut: 'payee', createdAt: { $gte: start, $lt: end } }),
    Invoice.find({ company: companyId, createdAt: { $gte: start, $lt: end } }),
    Expense.find({ company: companyId, date: { $gte: start, $lt: end } }),
    Invoice.find({ company: companyId, statut: { $in: ['envoyee', 'en_retard'] } })
  ]);

  const caHT = payees.reduce((s, i) => s + (i.montantHT || 0), 0);
  const totalCharges = expenses.reduce((s, e) => s + (e.montant || 0), 0);
  const montantImpaye = impayees.reduce((s, i) => s + (i.montantTTC || 0), 0);

  const data = {
    caHT, totalCharges, resultat: caHT - totalCharges,
    montantImpaye, nbImpayees: impayees.length,
    nbEncaissees: payees.length, nbEmises: emises.length
  };

  await sendMail({ to: destEmail, subject: `Rapport mensuel Novexa — ${moisLabel}`, html: buildHtml(moisLabel, data) });
  return { email: destEmail, ...data };
};

/** Cron : envoie le rapport du mois écoulé à toutes les entreprises actives. */
const envoyerRapportsMensuelsAuto = async () => {
  const now = new Date();
  const moisPrec = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const companies = await Company.find({ actif: true });
  let envoyes = 0;
  for (const c of companies) {
    try {
      let email = c.email;
      if (!email && c.owner) {
        const owner = await User.findById(c.owner).select('email');
        email = owner?.email;
      }
      if (!email) continue;
      await envoyerRapportCompany(c._id, email, moisPrec);
      envoyes++;
    } catch (err) {
      logger.warn('Rapport auto échoué', { company: String(c._id), error: err.message });
    }
  }
  logger.info(`Rapports mensuels automatiques : ${envoyes}/${companies.length} envoyés`);
  return { entreprises: companies.length, envoyes };
};

module.exports = { envoyerRapportCompany, envoyerRapportsMensuelsAuto };
