const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Product = require('../models/Product');
const Company = require('../models/Company');
const { calculerTVA } = require('../utils/tvaCalculator');
const { sendMail } = require('../utils/mailer');
const { sendSlack } = require('../utils/slack');

exports.createInvoice = async (req, res) => {
  try {
    const { client, lignes, dateEcheance, notes } = req.body;
    const montantHT = lignes.reduce((sum, l) => sum + l.montantHT, 0);
    const { montantTVA, montantTTC, tauxTVA } = calculerTVA(montantHT);
    const count = await Invoice.countDocuments({ company: req.user.company });
    const year = new Date().getFullYear();
    const numero = `FAC-${year}-${String(count + 1).padStart(4, '0')}`;
    const invoice = await Invoice.create({
      company: req.user.company,
      numero,
      client, lignes, montantHT, tauxTVA, montantTVA, montantTTC,
      dateEcheance, notes, createdBy: req.user.id
    });
    res.status(201).json({ success: true, data: invoice });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getInvoices = async (req, res) => {
  try {
    const { statut, page = 1, limit = 20 } = req.query;
    const filter = { company: req.user.company };
    if (statut) filter.statut = statut;
    const [invoices, total] = await Promise.all([
      Invoice.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(+limit),
      Invoice.countDocuments(filter)
    ]);
    res.json({ success: true, data: invoices, pagination: { page: +page, limit: +limit, total } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, company: req.user.company });
    if (!invoice) return res.status(404).json({ success: false, message: 'Facture introuvable' });
    res.json({ success: true, data: invoice });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateInvoice = async (req, res) => {
  try {
    const prev = await Invoice.findOne({ _id: req.params.id, company: req.user.company });
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company }, req.body, { new: true }
    );
    if (!invoice) return res.status(404).json({ success: false, message: 'Facture introuvable' });
    if (prev && prev.statut !== 'payee' && invoice.statut === 'payee') {
      const company = await Company.findById(req.user.company);
      if (company?.slackWebhookUrl) {
        await sendSlack(company.slackWebhookUrl, `✅ Facture payée : ${invoice.numero} — ${invoice.client?.nom} — ${invoice.montantTTC.toFixed(2)} €`);
      }
    }
    res.json({ success: true, data: invoice });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteInvoice = async (req, res) => {
  try {
    await Invoice.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    res.json({ success: true, message: 'Facture supprimée' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createExpense = async (req, res) => {
  try {
    const expense = await Expense.create({ ...req.body, company: req.user.company, createdBy: req.user.id });
    res.status(201).json({ success: true, data: expense });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getExpenses = async (req, res) => {
  try {
    const { categorie, mois } = req.query;
    const filter = { company: req.user.company };
    if (categorie) filter.categorie = categorie;
    if (mois) {
      const start = new Date(mois); const end = new Date(mois);
      end.setMonth(end.getMonth() + 1);
      filter.date = { $gte: start, $lt: end };
    }
    const expenses = await Expense.find(filter).sort({ date: -1 });
    const totalMontant = expenses.reduce((s, e) => s + e.montant, 0);
    res.json({ success: true, data: expenses, totalMontant });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getBilanComptable = async (req, res) => {
  try {
    const { annee } = req.query;
    const y = +annee || new Date().getFullYear();
    const start = new Date(y, 0, 1);
    const end = new Date(y + 1, 0, 1);

    const [invoicesPayees, invoicesCreances, expenses, products] = await Promise.all([
      Invoice.find({ company: req.user.company, statut: 'payee', createdAt: { $gte: start, $lt: end } }),
      Invoice.find({ company: req.user.company, statut: { $in: ['envoyee', 'en_retard'] } }),
      Expense.find({ company: req.user.company, date: { $gte: start, $lt: end } }),
      Product.find({ company: req.user.company, actif: true })
    ]);

    const stockValeur = products.reduce((s, p) => s + (p.quantite * (p.prixAchat || 0)), 0);
    const creancesClients = invoicesCreances.reduce((s, i) => s + i.montantTTC, 0);
    const tresorerie = invoicesPayees.reduce((s, i) => s + i.montantTTC, 0);
    const totalActif = stockValeur + creancesClients + tresorerie;

    const totalCharges = expenses.reduce((s, e) => s + e.montant, 0);
    const caHT = invoicesPayees.reduce((s, i) => s + i.montantHT, 0);
    const resultatExercice = caHT - totalCharges;
    const tvaCollectee = invoicesPayees.reduce((s, i) => s + i.montantTVA, 0);
    const dettesEstimees = Math.max(0, totalActif - resultatExercice - tvaCollectee);

    const r = v => Math.round(v * 100) / 100;
    res.json({
      success: true,
      data: {
        annee: y,
        actif: {
          stocks: r(stockValeur),
          creancesClients: r(creancesClients),
          tresorerie: r(tresorerie),
          total: r(totalActif)
        },
        passif: {
          resultatExercice: r(resultatExercice),
          tvaCollectee: r(tvaCollectee),
          dettesEstimees: r(dettesEstimees),
          total: r(totalActif)
        }
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getCompteResultat = async (req, res) => {
  try {
    const { annee } = req.query;
    const y = +annee || new Date().getFullYear();
    const start = new Date(y, 0, 1);
    const end = new Date(y + 1, 0, 1);

    const [invoices, expenses] = await Promise.all([
      Invoice.find({ company: req.user.company, statut: 'payee', createdAt: { $gte: start, $lt: end } }),
      Expense.find({ company: req.user.company, date: { $gte: start, $lt: end } })
    ]);

    const caHT = invoices.reduce((s, i) => s + i.montantHT, 0);
    const tvaCollectee = invoices.reduce((s, i) => s + i.montantTVA, 0);

    const chargesParCategorie = {};
    expenses.forEach(e => {
      chargesParCategorie[e.categorie] = (chargesParCategorie[e.categorie] || 0) + e.montant;
    });
    const totalCharges = expenses.reduce((s, e) => s + e.montant, 0);

    const resultatBrut = caHT - totalCharges;
    const is = resultatBrut > 0 ? resultatBrut * 0.25 : 0;
    const resultatNet = resultatBrut - is;

    const labels = {
      fournitures: 'Fournitures & matières',
      transport: 'Transport & déplacements',
      restauration: 'Restauration',
      logiciel: 'Logiciels & abonnements',
      marketing: 'Marketing & publicité',
      loyer: 'Loyer & charges locatives',
      salaires: 'Salaires & charges sociales',
      autre: 'Autres charges'
    };

    const r = v => Math.round(v * 100) / 100;
    res.json({
      success: true,
      data: {
        annee: y,
        produits: { caHT: r(caHT), tvaCollectee: r(tvaCollectee), total: r(caHT) },
        charges: {
          detail: Object.entries(chargesParCategorie).map(([cat, m]) => ({
            categorie: cat, label: labels[cat] || cat, montant: r(m)
          })),
          total: r(totalCharges)
        },
        resultat: {
          brut: r(resultatBrut),
          is: r(is),
          net: r(resultatNet),
          marge: caHT > 0 ? Math.round((resultatNet / caHT) * 10000) / 100 : 0
        }
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getBilan = async (req, res) => {
  try {
    const { annee } = req.query;
    const y = +annee || new Date().getFullYear();
    const start = new Date(y, 0, 1); const end = new Date(y + 1, 0, 1);
    const [invoices, expenses] = await Promise.all([
      Invoice.find({ company: req.user.company, createdAt: { $gte: start, $lt: end }, statut: 'payee' }),
      Expense.find({ company: req.user.company, date: { $gte: start, $lt: end } })
    ]);
    const totalRevenu = invoices.reduce((s, i) => s + i.montantTTC, 0);
    const totalDepenses = expenses.reduce((s, e) => s + e.montant, 0);
    const benefice = totalRevenu - totalDepenses;
    const moisLabels = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const mensuel = Object.fromEntries(moisLabels.map(m => [m, { revenu: 0, depenses: 0 }]));
    invoices.forEach(i => { const k = moisLabels[new Date(i.createdAt).getMonth()]; mensuel[k].revenu += i.montantTTC; });
    expenses.forEach(e => { const k = moisLabels[new Date(e.date).getMonth()]; mensuel[k].depenses += e.montant; });
    res.json({ success: true, data: { annee: y, totalRevenu, totalDepenses, benefice, mensuel } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.relancerFacture = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, company: req.user.company });
    if (!invoice) return res.status(404).json({ success: false, message: 'Facture introuvable' });
    if (invoice.statut === 'payee') return res.status(400).json({ success: false, message: 'Facture déjà payée' });

    const now = new Date();
    const echeance = invoice.dateEcheance ? new Date(invoice.dateEcheance) : null;
    const joursRetard = echeance ? Math.floor((now - echeance) / 86400000) : 0;
    let type = 'J7';
    if (joursRetard > 20) type = 'J30';
    else if (joursRetard > 10) type = 'J15';

    const clientEmail = invoice.client?.email;
    const company = await Company.findById(req.user.company);
    const appName = process.env.APP_NAME || 'Novexa';

    if (clientEmail) {
      const html = `
<div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;">
  <div style="background:#6366f1;padding:24px;border-radius:10px 10px 0 0;text-align:center;">
    <h2 style="color:#fff;margin:0;">${appName}</h2>
  </div>
  <div style="background:#fff;padding:32px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    <p style="color:#374151;font-size:15px;">Bonjour,</p>
    <p style="color:#374151;font-size:15px;">Nous vous contactons concernant la facture <strong>${invoice.numero}</strong> d'un montant de <strong>${invoice.montantTTC.toFixed(2)} €</strong>.</p>
    ${echeance ? `<p style="color:#374151;">Date d'échéance : <strong>${echeance.toLocaleDateString('fr-FR')}</strong>${joursRetard > 0 ? ` (${joursRetard} jours de retard)` : ''}</p>` : ''}
    <p style="color:#374151;">Merci de procéder au règlement dans les meilleurs délais.</p>
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">Cordialement,<br/>${company?.nom || appName}</p>
  </div>
</div>`;
      await sendMail({ to: clientEmail, subject: `Relance — Facture ${invoice.numero} — ${invoice.montantTTC.toFixed(2)} €`, html });
    }

    await Invoice.findByIdAndUpdate(invoice._id, { $push: { relancesSent: { type, sentAt: now } } });

    if (company?.slackWebhookUrl) {
      await sendSlack(company.slackWebhookUrl, `📧 Relance envoyée : ${invoice.numero} — ${invoice.client?.nom} — ${joursRetard} jours de retard`);
    }

    res.json({ success: true, message: clientEmail ? `Relance envoyée à ${clientEmail}` : 'Relance enregistrée (pas d\'email client)', data: { type, joursRetard } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getScoresClients = async (req, res) => {
  try {
    const invoices = await Invoice.find({ company: req.user.company });
    const clients = {};
    invoices.forEach(inv => {
      const nom = inv.client?.nom || 'Inconnu';
      if (!clients[nom]) clients[nom] = { nom, total: 0, payees: 0, enRetard: 0, montantTotal: 0, montantPaye: 0, retards: [] };
      clients[nom].total++;
      clients[nom].montantTotal += inv.montantTTC;
      if (inv.statut === 'payee') { clients[nom].payees++; clients[nom].montantPaye += inv.montantTTC; }
      if (inv.statut === 'en_retard') clients[nom].enRetard++;
      if (inv.statut === 'en_retard' && inv.dateEcheance) {
        clients[nom].retards.push(Math.floor((new Date() - new Date(inv.dateEcheance)) / 86400000));
      }
    });

    const scores = Object.values(clients).map(c => {
      const tauxPaiement = c.total ? (c.payees / c.total) * 100 : 100;
      const retardMoyen = c.retards.length ? c.retards.reduce((a, b) => a + b, 0) / c.retards.length : 0;
      const score = Math.max(0, Math.round(tauxPaiement - (retardMoyen * 0.5) - (c.enRetard * 5)));
      const risque = score >= 70 ? 'faible' : score >= 40 ? 'moyen' : 'eleve';
      return { nom: c.nom, score, risque, tauxPaiement: Math.round(tauxPaiement), retardMoyen: Math.round(retardMoyen), total: c.total, enRetard: c.enRetard, montantTotal: c.montantTotal, montantPaye: c.montantPaye };
    }).sort((a, b) => a.score - b.score);

    res.json({ success: true, data: scores });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.approuverDepense = async (req, res) => {
  try {
    const Expense = require('../models/Expense');
    const exp = await Expense.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      { statut: 'approuvee', approvedBy: req.user.id },
      { new: true }
    );
    if (!exp) return res.status(404).json({ success: false, message: 'Dépense introuvable' });
    const company = await Company.findById(req.user.company);
    if (company?.slackWebhookUrl) {
      await sendSlack(company.slackWebhookUrl, `✅ Dépense approuvée : ${exp.titre} — ${exp.montant.toFixed(2)} €`);
    }
    res.json({ success: true, data: exp });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.rejeterDepense = async (req, res) => {
  try {
    const Expense = require('../models/Expense');
    const exp = await Expense.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      { statut: 'rejetee' },
      { new: true }
    );
    if (!exp) return res.status(404).json({ success: false, message: 'Dépense introuvable' });
    const company = await Company.findById(req.user.company);
    if (company?.slackWebhookUrl) {
      await sendSlack(company.slackWebhookUrl, `❌ Dépense rejetée : ${exp.titre} — ${exp.montant.toFixed(2)} €`);
    }
    res.json({ success: true, data: exp });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateSettings = async (req, res) => {
  try {
    const { slackWebhookUrl, approvalThreshold } = req.body;
    const update = {};
    if (slackWebhookUrl !== undefined) update.slackWebhookUrl = slackWebhookUrl;
    if (approvalThreshold !== undefined) update.approvalThreshold = +approvalThreshold;
    const company = await Company.findByIdAndUpdate(req.user.company, update, { new: true });
    res.json({ success: true, data: company });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getSettings = async (req, res) => {
  try {
    const company = await Company.findById(req.user.company).select('slackWebhookUrl approvalThreshold nom siret adresse email telephone');
    res.json({ success: true, data: company });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Export FEC (Fichier d'Écritures Comptables) ──
exports.exportFEC = async (req, res) => {
  try {
    const annee = parseInt(req.query.annee) || new Date().getFullYear();
    const company = await Company.findById(req.user.company);
    const debut = new Date(annee, 0, 1);
    const fin = new Date(annee, 11, 31, 23, 59, 59);
    const invoices = await Invoice.find({ company: req.user.company, statut: 'payee', createdAt: { $gte: debut, $lte: fin } });
    const expenses = await Expense.find({ company: req.user.company, createdAt: { $gte: debut, $lte: fin } });

    const pad = (n, l = 2) => String(n).padStart(l, '0');
    const fmtDate = d => { const dt = new Date(d); return `${dt.getFullYear()}${pad(dt.getMonth()+1)}${pad(dt.getDate())}`; };
    const fmtMontant = n => Math.abs(n || 0).toFixed(2).replace('.', ',');

    let lines = ['JournalCode\tJournalLib\tEcritureNum\tEcritureDate\tCompteNum\tCompteLib\tCompAuxNum\tCompAuxLib\tPieceRef\tPieceDate\tEcritureLib\tDebit\tCredit\tEcritureLet\tDateLet\tValidDate\tMontantdevise\tIdevise'];
    let num = 1;

    invoices.forEach(inv => {
      const dt = fmtDate(inv.createdAt);
      const ref = inv.numero;
      const clientCode = 'CLI' + ref.slice(-4);
      lines.push(`VT\tVentes\t${String(num).padStart(6,'0')}\t${dt}\t411\tClients\t${clientCode}\t${inv.client?.nom||''}\t${ref}\t${dt}\t${ref}\t${fmtMontant(inv.montantTTC)}\t0,00\t\t\t${dt}\t\t`);
      lines.push(`VT\tVentes\t${String(num).padStart(6,'0')}\t${dt}\t706\tPrestations\t\t\t${ref}\t${dt}\t${ref}\t0,00\t${fmtMontant(inv.montantHT)}\t\t\t${dt}\t\t`);
      if (inv.montantTVA > 0) lines.push(`VT\tVentes\t${String(num).padStart(6,'0')}\t${dt}\t44571\tTVA collectée\t\t\t${ref}\t${dt}\t${ref}\t0,00\t${fmtMontant(inv.montantTVA)}\t\t\t${dt}\t\t`);
      num++;
    });

    expenses.forEach(exp => {
      const dt = fmtDate(exp.date || exp.createdAt);
      const ref = `DEP-${String(num).padStart(4,'0')}`;
      lines.push(`AC\tAchats\t${String(num).padStart(6,'0')}\t${dt}\t606\tCharges\t\t\t${ref}\t${dt}\t${exp.titre||'Dépense'}\t${fmtMontant(exp.montant)}\t0,00\t\t\t${dt}\t\t`);
      lines.push(`AC\tAchats\t${String(num).padStart(6,'0')}\t${dt}\t512\tBanque\t\t\t${ref}\t${dt}\t${exp.titre||'Dépense'}\t0,00\t${fmtMontant(exp.montant)}\t\t\t${dt}\t\t`);
      num++;
    });

    const content = lines.join('\n');
    const filename = `FEC_${(company?.nom || 'Novexa').replace(/\s/g, '_')}_${annee}.txt`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Déclaration TVA CA3 ──
exports.getDeclarationTVA = async (req, res) => {
  try {
    const annee = parseInt(req.query.annee) || new Date().getFullYear();
    const mois = req.query.mois ? parseInt(req.query.mois) : null;
    const debut = mois ? new Date(annee, mois - 1, 1) : new Date(annee, 0, 1);
    const fin = mois ? new Date(annee, mois, 0, 23, 59, 59) : new Date(annee, 11, 31, 23, 59, 59);

    const invoices = await Invoice.find({ company: req.user.company, statut: { $in: ['payee', 'envoyee', 'en_retard'] }, createdAt: { $gte: debut, $lte: fin } });
    const expenses = await Expense.find({ company: req.user.company, createdAt: { $gte: debut, $lte: fin } });

    const caHT = invoices.reduce((s, i) => s + i.montantHT, 0);
    const tvaCollectee = invoices.reduce((s, i) => s + i.montantTVA, 0);
    const tvaDeductible = expenses.reduce((s, e) => s + (e.montant * 0.2 / 1.2), 0);
    const soldeTVA = tvaCollectee - tvaDeductible;

    res.json({
      success: true,
      data: {
        periode: mois ? `${String(mois).padStart(2,'0')}/${annee}` : String(annee),
        caHT: Math.round(caHT * 100) / 100,
        tvaCollectee: Math.round(tvaCollectee * 100) / 100,
        tvaDeductible: Math.round(tvaDeductible * 100) / 100,
        soldeTVA: Math.round(soldeTVA * 100) / 100,
        aRembourser: soldeTVA < 0,
        nbFactures: invoices.length
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Alertes proactives IA ──
exports.getAlertesProactives = async (req, res) => {
  try {
    const now = new Date();
    const alertes = [];

    // Factures en retard
    const enRetard = await Invoice.find({ company: req.user.company, statut: 'en_retard' });
    if (enRetard.length > 0) {
      const montant = enRetard.reduce((s, i) => s + i.montantTTC, 0);
      alertes.push({ type: 'danger', icon: '⚠️', titre: 'Factures en retard de paiement', message: `${enRetard.length} facture(s) impayée(s) pour un total de ${montant.toFixed(0)} €`, action: 'comptabilite' });
    }

    // Factures envoyées depuis plus de 30 jours
    const vieilles = await Invoice.find({ company: req.user.company, statut: 'envoyee', createdAt: { $lt: new Date(now - 30 * 86400000) } });
    if (vieilles.length > 0) alertes.push({ type: 'warning', icon: '📅', titre: 'Factures sans réponse depuis 30+ jours', message: `${vieilles.length} facture(s) envoyées sans paiement depuis plus d'un mois`, action: 'comptabilite' });

    // Stock critique
    const Product = require('../models/Product');
    const stockCritique = await Product.find({ company: req.user.company, actif: true, alerteActive: true, $expr: { $lte: ['$quantite', '$seuilAlerte'] } });
    if (stockCritique.length > 0) alertes.push({ type: 'warning', icon: '📦', titre: 'Stock en alerte', message: `${stockCritique.length} produit(s) sous le seuil d'alerte`, action: 'stocks' });

    // Dépenses en attente d'approbation
    const depensesEnAttente = await Expense.countDocuments({ company: req.user.company, statut: 'en_attente' });
    if (depensesEnAttente > 0) alertes.push({ type: 'info', icon: '💸', titre: 'Dépenses en attente d\'approbation', message: `${depensesEnAttente} dépense(s) attendent votre validation`, action: 'comptabilite' });

    // Notes de frais en attente
    try {
      const NoteFrais = require('../models/NoteFrais');
      const notesEnAttente = await NoteFrais.countDocuments({ company: req.user.company, statut: 'en_attente' });
      if (notesEnAttente > 0) alertes.push({ type: 'info', icon: '🧾', titre: 'Notes de frais en attente', message: `${notesEnAttente} note(s) de frais à traiter`, action: 'rh' });
    } catch {}

    // Devis expirés
    try {
      const Devis = require('../models/Devis');
      const devisExpires = await Devis.countDocuments({ company: req.user.company, statut: 'envoye', dateValidite: { $lt: now } });
      if (devisExpires > 0) alertes.push({ type: 'warning', icon: '📋', titre: 'Devis expirés sans réponse', message: `${devisExpires} devis ont dépassé leur date de validité`, action: 'comptabilite' });
    } catch {}

    res.json({ success: true, data: alertes, count: alertes.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
