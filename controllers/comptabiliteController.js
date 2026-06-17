const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const { calculerTVA } = require('../utils/tvaCalculator');

exports.createInvoice = async (req, res) => {
  try {
    const { client, lignes, dateEcheance, notes } = req.body;
    const montantHT = lignes.reduce((sum, l) => sum + l.montantHT, 0);
    const { montantTVA, montantTTC, tauxTVA } = calculerTVA(montantHT);
    const invoice = await Invoice.create({
      company: req.user.company,
      numero: `FAC-${Date.now()}`,
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
