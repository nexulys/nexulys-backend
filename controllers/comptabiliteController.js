const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Product = require('../models/Product');
const { calculerTVA } = require('../utils/tvaCalculator');

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
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company }, req.body, { new: true }
    );
    if (!invoice) return res.status(404).json({ success: false, message: 'Facture introuvable' });
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
