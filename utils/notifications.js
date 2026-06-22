const { sendMail } = require('./mailer');
const { sendSlack } = require('./slack');
const Company = require('../models/Company');
const User = require('../models/User');
const logger = require('./logger');

// Envoie email à l'admin de la company + Slack si configuré
const notify = async (companyId, { subject, html, slackText }) => {
  try {
    const company = await Company.findById(companyId).populate('owner', 'email');
    if (!company) return;

    // Email au owner
    if (company.owner?.email) {
      await sendMail({ to: company.owner.email, subject, html });
    }

    // Slack si configuré
    if (company.slackWebhookUrl && slackText) {
      await sendSlack(company.slackWebhookUrl, slackText);
    }
  } catch (err) {
    logger.error('Notification failed', { error: err.message });
  }
};

// Templates d'événements
const notifyLeaveRequest = (companyId, { employeeNom, dateDebut, dateFin, type }) =>
  notify(companyId, {
    subject: `[Novexa] Demande de congé — ${employeeNom}`,
    html: `<p><b>${employeeNom}</b> a soumis une demande de ${type} du <b>${new Date(dateDebut).toLocaleDateString('fr-FR')}</b> au <b>${new Date(dateFin).toLocaleDateString('fr-FR')}</b>.</p><p>Connectez-vous sur Novexa pour approuver ou refuser.</p>`,
    slackText: `📅 Demande de congé : *${employeeNom}* — ${type} du ${new Date(dateDebut).toLocaleDateString('fr-FR')} au ${new Date(dateFin).toLocaleDateString('fr-FR')}`
  });

const notifyExpenseSubmitted = (companyId, { employeeNom, montant, titre }) =>
  notify(companyId, {
    subject: `[Novexa] Note de frais à approuver — ${employeeNom}`,
    html: `<p><b>${employeeNom}</b> a soumis une note de frais : <b>${titre}</b> — <b>${montant.toFixed(2)} €</b>.</p><p>Connectez-vous sur Novexa pour approuver ou rejeter.</p>`,
    slackText: `💳 Note de frais à approuver : *${employeeNom}* — ${titre} — ${montant.toFixed(2)} €`
  });

const notifyTicketOpened = (companyId, { titre, priorite, rapporteurNom }) =>
  notify(companyId, {
    subject: `[Novexa] Nouveau ticket support — ${titre}`,
    html: `<p>Un nouveau ticket a été ouvert par <b>${rapporteurNom}</b> :</p><p><b>${titre}</b> — Priorité : <b>${priorite}</b></p><p>Connectez-vous sur Novexa pour traiter ce ticket.</p>`,
    slackText: `🎫 Nouveau ticket [${priorite}] : *${titre}* — par ${rapporteurNom}`
  });

const notifyStockLow = (companyId, { produitNom, quantite, seuilAlerte }) =>
  notify(companyId, {
    subject: `[Novexa] Alerte stock faible — ${produitNom}`,
    html: `<p>Le produit <b>${produitNom}</b> est en stock bas : <b>${quantite} unités</b> (seuil : ${seuilAlerte}).</p><p>Connectez-vous sur Novexa pour commander.</p>`,
    slackText: `⚠️ Stock bas : *${produitNom}* — ${quantite} unités restantes (seuil : ${seuilAlerte})`
  });

const notifyInvoiceLate = (companyId, { numero, clientNom, montantTTC, dateEcheance }) =>
  notify(companyId, {
    subject: `[Novexa] Facture en retard — ${numero}`,
    html: `<p>La facture <b>${numero}</b> de <b>${clientNom}</b> (${montantTTC.toFixed(2)} €) est en retard depuis le ${new Date(dateEcheance).toLocaleDateString('fr-FR')}.</p>`,
    slackText: `🔴 Facture en retard : *${numero}* — ${clientNom} — ${montantTTC.toFixed(2)} €`
  });

const notifyAdvanceRequested = (companyId, { employeeNom, montant, motif }) =>
  notify(companyId, {
    subject: `[Novexa] Demande d'avance sur salaire — ${employeeNom}`,
    html: `<p><b>${employeeNom}</b> demande une avance sur salaire de <b>${montant.toFixed(2)} €</b>.</p><p>Motif : ${motif}</p>`,
    slackText: `💰 Avance sur salaire demandée : *${employeeNom}* — ${montant.toFixed(2)} €`
  });

module.exports = { notify, notifyLeaveRequest, notifyExpenseSubmitted, notifyTicketOpened, notifyStockLow, notifyInvoiceLate, notifyAdvanceRequested };
