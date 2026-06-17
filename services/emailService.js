const { sendMail } = require('../utils/mailer');

const emailTemplates = {
  bienvenue: (user, company) => ({
    subject: `Bienvenue sur Novexa, ${user.prenom} !`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;background:#0a0a0f;color:#fff;padding:40px;border-radius:12px">
        <h1 style="background:linear-gradient(to right,#6366f1,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Bienvenue sur Novexa ✨</h1>
        <p>Bonjour <strong>${user.prenom} ${user.nom}</strong>,</p>
        <p>Votre compte <strong>${company.nom}</strong> est prêt. Votre essai gratuit de 14 jours commence maintenant.</p>
        <a href="${process.env.APP_URL || 'http://localhost:5000'}/dashboard.html" style="display:inline-block;background:linear-gradient(to right,#6366f1,#3b82f6);color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px">Accéder à Novexa →</a>
        <p style="margin-top:32px;color:#666;font-size:12px">© 2026 Nexulys — Novexa SaaS Platform</p>
      </div>`
  }),

  alerteStockBas: (product, company) => ({
    subject: `⚠️ Alerte stock bas — ${product.nom}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;background:#0a0a0f;color:#fff;padding:40px;border-radius:12px">
        <h2 style="color:#ef4444">⚠️ Stock bas détecté</h2>
        <p>Le produit <strong>${product.nom}</strong> (SKU: ${product.sku}) est en dessous du seuil d'alerte.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;color:#888">Quantité actuelle</td><td style="color:#ef4444"><strong>${product.quantite} ${product.unite}</strong></td></tr>
          <tr><td style="padding:8px;color:#888">Seuil d'alerte</td><td><strong>${product.seuilAlerte} ${product.unite}</strong></td></tr>
          <tr><td style="padding:8px;color:#888">Urgence</td><td><strong>${product.quantite === 0 ? '🔴 CRITIQUE' : '🟡 Faible'}</strong></td></tr>
        </table>
        <p style="margin-top:32px;color:#666;font-size:12px">Novexa by Nexulys</p>
      </div>`
  }),

  factureEnRetard: (invoice, jours) => ({
    subject: `📄 Facture ${invoice.numero} en retard (${jours} jours)`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;background:#0a0a0f;color:#fff;padding:40px;border-radius:12px">
        <h2 style="color:#f59e0b">📄 Facture en retard</h2>
        <p>La facture <strong>${invoice.numero}</strong> pour <strong>${invoice.client?.nom}</strong> est en retard de <strong>${jours} jours</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;color:#888">Montant TTC</td><td><strong>${invoice.montantTTC?.toFixed(2)} €</strong></td></tr>
          <tr><td style="padding:8px;color:#888">Date d'échéance</td><td><strong>${new Date(invoice.dateEcheance).toLocaleDateString('fr')}</strong></td></tr>
        </table>
        <p style="margin-top:32px;color:#666;font-size:12px">Novexa by Nexulys</p>
      </div>`
  }),

  congeApprouve: (employee, leave) => ({
    subject: `✅ Congé approuvé — ${new Date(leave.dateDebut).toLocaleDateString('fr')}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;background:#0a0a0f;color:#fff;padding:40px;border-radius:12px">
        <h2 style="color:#10b981">✅ Votre congé a été approuvé</h2>
        <p>Bonjour <strong>${employee.prenom} ${employee.nom}</strong>,</p>
        <p>Votre demande de congé a été <strong>approuvée</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;color:#888">Type</td><td><strong>${leave.type}</strong></td></tr>
          <tr><td style="padding:8px;color:#888">Du</td><td><strong>${new Date(leave.dateDebut).toLocaleDateString('fr')}</strong></td></tr>
          <tr><td style="padding:8px;color:#888">Au</td><td><strong>${new Date(leave.dateFin).toLocaleDateString('fr')}</strong></td></tr>
          <tr><td style="padding:8px;color:#888">Durée</td><td><strong>${leave.nombreJours} jours</strong></td></tr>
        </table>
        <p style="margin-top:32px;color:#666;font-size:12px">Novexa by Nexulys</p>
      </div>`
  })
};

exports.sendBienvenue = (user, company) => sendMail({ to: user.email, ...emailTemplates.bienvenue(user, company) });
exports.sendAlerteStock = (product, adminEmail) => sendMail({ to: adminEmail, ...emailTemplates.alerteStockBas(product) });
exports.sendFactureRetard = (invoice, adminEmail) => sendMail({ to: adminEmail, ...emailTemplates.factureEnRetard(invoice, Math.floor((Date.now() - new Date(invoice.dateEcheance)) / 86400000)) });
exports.sendCongeApprouve = (employee, leave) => sendMail({ to: employee.email, ...emailTemplates.congeApprouve(employee, leave) });
