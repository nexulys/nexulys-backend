const Invoice = require('../models/Invoice');
const Payslip = require('../models/Payslip');
const Employee = require('../models/Employee');
const Company = require('../models/Company');
const { generateInvoicePDF, generatePayslipPDF } = require('../utils/pdf');

exports.downloadInvoicePDF = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, company: req.user.company });
    if (!invoice) return res.status(404).json({ success: false, message: 'Facture introuvable' });
    const company = await Company.findById(req.user.company);
    const pdfBuffer = await generateInvoicePDF(invoice, company || {});
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Facture_${invoice.numero}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.downloadPayslipPDF = async (req, res) => {
  try {
    const payslip = await Payslip.findOne({ _id: req.params.id, company: req.user.company });
    if (!payslip) return res.status(404).json({ success: false, message: 'Bulletin introuvable' });
    const [employee, company] = await Promise.all([
      Employee.findById(payslip.employee),
      Company.findById(req.user.company)
    ]);
    const pdfBuffer = await generatePayslipPDF(payslip, employee || {}, company || {});
    const nomFichier = `Fiche_paie_${(employee?.nom||'').replace(/\s/g,'_')}_${payslip.mois}_${payslip.annee}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);
    res.send(pdfBuffer);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
