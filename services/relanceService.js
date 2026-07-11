const Invoice = require('../models/Invoice');
const Company = require('../models/Company');
const { sendMail } = require('../utils/mailer');
const { sendSlack } = require('../utils/slack');
const logger = require('../utils/logger');

const jour = 86400000;

// Niveau d'escalade selon le nombre de jours de retard
const niveauRelance = (joursRetard) => {
  if (joursRetard > 20) return 'J30';
  if (joursRetard > 10) return 'J15';
  if (joursRetard > 0) return 'J7';
  return null;
};

const buildHtml = (invoice, company, echeance, joursRetard) => {
  const appName = process.env.APP_NAME || 'Novexa';
  return `
<div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;">
  <div style="background:#6366f1;padding:24px;border-radius:10px 10px 0 0;text-align:center;">
    <h2 style="color:#fff;margin:0;">${company?.nom || appName}</h2>
  </div>
  <div style="background:#fff;padding:32px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    <p style="color:#374151;font-size:15px;">Bonjour,</p>
    <p style="color:#374151;font-size:15px;">Nous vous contactons concernant la facture <strong>${invoice.numero}</strong> d'un montant de <strong>${invoice.montantTTC.toFixed(2)} €</strong>.</p>
    ${echeance ? `<p style="color:#374151;">Date d'échéance : <strong>${echeance.toLocaleDateString('fr-FR')}</strong>${joursRetard > 0 ? ` (${joursRetard} jours de retard)` : ''}</p>` : ''}
    <p style="color:#374151;">Merci de procéder au règlement dans les meilleurs délais.</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">Cordialement,<br/>${company?.nom || appName}</p>
  </div>
</div>`;
};

/**
 * Relance toutes les factures impayées d'une entreprise dont l'échéance est passée.
 * N'envoie qu'une relance par niveau d'escalade (anti-doublon) et marque la facture en retard.
 * @returns {Promise<{relancees:number, marqueesEnRetard:number, details:Array}>}
 */
const relancerImpayeesCompany = async (companyId) => {
  const now = new Date();
  const [company, invoices] = await Promise.all([
    Company.findById(companyId),
    Invoice.find({
      company: companyId,
      statut: { $in: ['envoyee', 'en_retard'] },
      dateEcheance: { $lt: now }
    })
  ]);

  const details = [];
  let relancees = 0;
  let marqueesEnRetard = 0;

  for (const invoice of invoices) {
    const echeance = invoice.dateEcheance ? new Date(invoice.dateEcheance) : null;
    const joursRetard = echeance ? Math.floor((now - echeance) / jour) : 0;
    const type = niveauRelance(joursRetard);
    if (!type) continue;

    // Passe la facture en "en_retard" si ce n'est pas déjà le cas
    const update = {};
    if (invoice.statut !== 'en_retard') { update.statut = 'en_retard'; marqueesEnRetard++; }

    // Anti-doublon : une relance par niveau d'escalade
    const dejaRelance = (invoice.relancesSent || []).some(r => r.type === type);
    const clientEmail = invoice.client && invoice.client.email;

    if (!dejaRelance) {
      try {
        if (clientEmail) {
          await sendMail({
            to: clientEmail,
            subject: `Relance — Facture ${invoice.numero} — ${invoice.montantTTC.toFixed(2)} €`,
            html: buildHtml(invoice, company, echeance, joursRetard)
          });
        }
        update.$push = { relancesSent: { type, sentAt: now } };
        relancees++;
        details.push({ numero: invoice.numero, client: invoice.client?.nom, type, joursRetard, email: clientEmail || null });
      } catch (err) {
        logger.warn('Relance facture échouée', { numero: invoice.numero, error: err.message });
      }
    }

    if (Object.keys(update).length) {
      await Invoice.findByIdAndUpdate(invoice._id, update);
    }
  }

  if (relancees > 0 && company?.slackWebhookUrl) {
    await sendSlack(company.slackWebhookUrl, `📧 ${relancees} relance(s) de paiement envoyée(s) automatiquement.`);
  }

  return { relancees, marqueesEnRetard, details };
};

/** Exécute les relances pour toutes les entreprises actives (planificateur). */
const relancerToutesEntreprises = async () => {
  const companies = await Company.find({ actif: true }).select('_id');
  let totalRelancees = 0;
  for (const c of companies) {
    try {
      const r = await relancerImpayeesCompany(c._id);
      totalRelancees += r.relancees;
    } catch (err) {
      logger.warn('Relances entreprise échouées', { company: String(c._id), error: err.message });
    }
  }
  logger.info(`Relances automatiques : ${totalRelancees} envoyée(s) sur ${companies.length} entreprise(s)`);
  return { entreprises: companies.length, relancees: totalRelancees };
};

module.exports = { relancerImpayeesCompany, relancerToutesEntreprises, niveauRelance };
