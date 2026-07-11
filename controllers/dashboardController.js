const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Employee = require('../models/Employee');
const Leave = require('../models/Leave');
const Ticket = require('../models/Ticket');
const Product = require('../models/Product');
const Payslip = require('../models/Payslip');
const Prospect = require('../models/Prospect');
const { sendError } = require('../utils/errorResponse');

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
  } catch (err) { sendError(res, err); }
};

// Score de santé de l'entreprise (0-100) — synthèse pilotable en un coup d'œil
exports.getHealthScore = async (req, res) => {
  try {
    const company = req.user.company;
    const now = new Date();
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
    const debutMoisPrec = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const finMoisPrec = new Date(now.getFullYear(), now.getMonth(), 0);

    const [payeesMois, payeesPrec, impayees, enRetard, depenses, ticketsUrgents, alertesStock] = await Promise.all([
      Invoice.find({ company, statut: 'payee', updatedAt: { $gte: debutMois } }),
      Invoice.find({ company, statut: 'payee', updatedAt: { $gte: debutMoisPrec, $lte: finMoisPrec } }),
      Invoice.find({ company, statut: { $in: ['envoyee', 'en_retard'] } }),
      Invoice.find({ company, statut: 'en_retard' }),
      Expense.find({ company, createdAt: { $gte: debutMois } }),
      Ticket.countDocuments({ company, statut: 'ouvert', priorite: 'urgente' }),
      Product.countDocuments({ company, actif: true, alerteActive: true })
    ]);

    const caMois = payeesMois.reduce((s, i) => s + (i.montantTTC || 0), 0);
    const caPrec = payeesPrec.reduce((s, i) => s + (i.montantTTC || 0), 0);
    const montantImpaye = impayees.reduce((s, i) => s + (i.montantTTC || 0), 0);
    const totalDepenses = depenses.reduce((s, d) => s + (d.montant || 0), 0);

    const details = [];
    let score = 100;

    // Trésorerie / marge (CA - dépenses du mois)
    const solde = caMois - totalDepenses;
    if (solde < 0) { score -= 25; details.push({ critere: 'Trésorerie du mois', statut: 'négatif', impact: -25 }); }
    else details.push({ critere: 'Trésorerie du mois', statut: 'positif', impact: 0 });

    // Impayés vs CA
    const ratioImpaye = caMois > 0 ? montantImpaye / caMois : (montantImpaye > 0 ? 1 : 0);
    if (ratioImpaye > 0.5) { score -= 25; details.push({ critere: 'Factures impayées', statut: 'élevé', impact: -25 }); }
    else if (ratioImpaye > 0.2) { score -= 12; details.push({ critere: 'Factures impayées', statut: 'modéré', impact: -12 }); }
    else details.push({ critere: 'Factures impayées', statut: 'maîtrisé', impact: 0 });

    // Retards de paiement
    if (enRetard.length >= 3) { score -= 15; details.push({ critere: 'Retards de paiement', statut: `${enRetard.length} factures`, impact: -15 }); }
    else if (enRetard.length > 0) { score -= 7; details.push({ critere: 'Retards de paiement', statut: `${enRetard.length} facture(s)`, impact: -7 }); }
    else details.push({ critere: 'Retards de paiement', statut: 'aucun', impact: 0 });

    // Croissance
    if (caPrec > 0) {
      const variation = (caMois - caPrec) / caPrec;
      if (variation < -0.15) { score -= 15; details.push({ critere: 'Évolution du CA', statut: 'en baisse', impact: -15 }); }
      else if (variation > 0.1) { details.push({ critere: 'Évolution du CA', statut: 'en croissance', impact: 0 }); }
      else details.push({ critere: 'Évolution du CA', statut: 'stable', impact: 0 });
    }

    // Support urgent
    if (ticketsUrgents > 0) { score -= 10; details.push({ critere: 'Tickets urgents', statut: `${ticketsUrgents} ouvert(s)`, impact: -10 }); }

    // Alertes stock
    if (alertesStock > 0) { score -= 5; details.push({ critere: 'Alertes de stock', statut: `${alertesStock} produit(s)`, impact: -5 }); }

    score = Math.max(0, Math.min(100, Math.round(score)));
    const niveau = score >= 80 ? 'Excellent' : score >= 60 ? 'Bon' : score >= 40 ? 'À surveiller' : 'Critique';

    res.json({ success: true, data: { score, niveau, solde, details, generatedAt: now } });
  } catch (err) { sendError(res, err); }
};
