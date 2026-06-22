const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Employee = require('../models/Employee');
const Leave = require('../models/Leave');
const Ticket = require('../models/Ticket');
const Product = require('../models/Product');
const Payslip = require('../models/Payslip');
const Prospect = require('../models/Prospect');

exports.getExecutiveKPIs = async (req, res) => {
  try {
    const company = req.user.company;
    const now = new Date();
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
    const debutMoisPrec = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const finMoisPrec = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      // CA mois en cours (factures payées)
      invoicesPayeesMois,
      // CA mois précédent
      invoicesPayeesMoisPrec,
      // Factures impayées (envoyée + en_retard)
      invoicesImpayees,
      // Factures en retard
      invoicesEnRetard,
      // Nb employés actifs
      nbEmployes,
      // Congés en attente d'approbation
      congesEnAttente,
      // Tickets ouverts
      ticketsOuverts,
      // Tickets urgents
      ticketsUrgents,
      // Alertes stock
      alertesStock,
      // Masse salariale mois en cours
      payslipsMois,
      // Dépenses mois en cours
      depensesMois,
      // Nb prospects actifs
      prospectsActifs
    ] = await Promise.all([
      Invoice.find({ company, statut: 'payee', updatedAt: { $gte: debutMois } }),
      Invoice.find({ company, statut: 'payee', updatedAt: { $gte: debutMoisPrec, $lte: finMoisPrec } }),
      Invoice.find({ company, statut: { $in: ['envoyee', 'en_retard'] } }),
      Invoice.find({ company, statut: 'en_retard' }),
      Employee.countDocuments({ company, statut: 'actif' }),
      Leave.countDocuments({ company, statut: 'en_attente' }),
      Ticket.countDocuments({ company, statut: { $in: ['ouvert', 'en_cours'] } }),
      Ticket.countDocuments({ company, statut: 'ouvert', priorite: 'urgente' }),
      Product.countDocuments({ company, actif: true, alerteActive: true }),
      Payslip.find({ company, mois: now.getMonth() + 1, annee: now.getFullYear() }),
      Expense.find({ company, createdAt: { $gte: debutMois } }),
      Prospect.countDocuments({ company, statut: { $in: ['prospect', 'contact', 'negociation'] } })
    ]);

    const caMois = invoicesPayeesMois.reduce((s, i) => s + (i.montantTTC || 0), 0);
    const caMoisPrec = invoicesPayeesMoisPrec.reduce((s, i) => s + (i.montantTTC || 0), 0);
    const caVariation = caMoisPrec > 0 ? ((caMois - caMoisPrec) / caMoisPrec * 100).toFixed(1) : null;
    const montantImpaye = invoicesImpayees.reduce((s, i) => s + (i.montantTTC || 0), 0);
    const montantRetard = invoicesEnRetard.reduce((s, i) => s + (i.montantTTC || 0), 0);
    const masseSalariale = payslipsMois.reduce((s, p) => s + (p.netAPayer || 0), 0);
    const totalDepenses = depensesMois.reduce((s, d) => s + (d.montant || 0), 0);

    res.json({
      success: true,
      data: {
        ca: { mois: caMois, moisPrec: caMoisPrec, variation: caVariation },
        factures: {
          impayees: { count: invoicesImpayees.length, montant: montantImpaye },
          enRetard: { count: invoicesEnRetard.length, montant: montantRetard }
        },
        rh: {
          nbEmployes,
          congesEnAttente,
          masseSalariale
        },
        depenses: { mois: totalDepenses },
        support: { ouverts: ticketsOuverts, urgents: ticketsUrgents },
        stock: { alertes: alertesStock },
        crm: { prospectsActifs },
        generatedAt: now
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
