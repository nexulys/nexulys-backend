const Employee = require('../models/Employee');
const Contract = require('../models/Contract');
const Leave = require('../models/Leave');
const Payslip = require('../models/Payslip');
const Virement = require('../models/Virement');
const AvanceSalaire = require('../models/AvanceSalaire');
const { genererFichePaie } = require('../utils/payslipGenerator');
const { notifyLeaveRequest, notifyAdvanceRequested } = require('../utils/notifications');
const { logAction } = require('../utils/auditLogger');

const MOIS_LABELS = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

exports.createEmployee = async (req, res) => {
  try {
    const employee = await Employee.create({ ...req.body, company: req.user.company });
    logAction(req, { action: 'CREATE_EMPLOYEE', entity: 'Employee', entityId: employee._id, details: employee.nom });
    res.status(201).json({ success: true, data: employee });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({ company: req.user.company }).sort({ nom: 1 });
    res.json({ success: true, data: employees, count: employees.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getEmployee = async (req, res) => {
  try {
    const emp = await Employee.findOne({ _id: req.params.id, company: req.user.company });
    if (!emp) return res.status(404).json({ success: false, message: 'Employé introuvable' });
    res.json({ success: true, data: emp });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateEmployee = async (req, res) => {
  try {
    const emp = await Employee.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company }, req.body, { new: true }
    );
    if (!emp) return res.status(404).json({ success: false, message: 'Employé introuvable' });
    res.json({ success: true, data: emp });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const emp = await Employee.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      { statut: 'inactif' },
      { new: true }
    );
    if (!emp) return res.status(404).json({ success: false, message: 'Employé introuvable' });
    logAction(req, { action: 'DEACTIVATE_EMPLOYEE', entity: 'Employee', entityId: req.params.id });
    res.json({ success: true, message: 'Employé désactivé' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createContract = async (req, res) => {
  try {
    const contract = await Contract.create({ ...req.body, company: req.user.company, createdBy: req.user.id });
    res.status(201).json({ success: true, data: contract });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getContracts = async (req, res) => {
  try {
    const contracts = await Contract.find({ company: req.user.company }).populate('employee');
    res.json({ success: true, data: contracts });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.requestLeave = async (req, res) => {
  try {
    const leave = await Leave.create({ ...req.body, company: req.user.company, statut: 'en_attente' });
    // Récupérer le nom de l'employé si disponible
    let employeeNom = leave.employeeNom || 'Employé';
    if (!employeeNom || employeeNom === 'Employé') {
      try {
        const emp = await Employee.findById(leave.employee);
        if (emp) employeeNom = `${emp.prenom} ${emp.nom}`.trim();
      } catch (_) {}
    }
    notifyLeaveRequest(req.user.company, {
      employeeNom,
      dateDebut: leave.dateDebut,
      dateFin: leave.dateFin,
      type: leave.type
    });
    res.status(201).json({ success: true, data: leave });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getLeaves = async (req, res) => {
  try {
    const { statut, employee } = req.query;
    const filter = { company: req.user.company };
    if (statut) filter.statut = statut;
    if (employee) filter.employee = employee;
    const leaves = await Leave.find(filter).populate('employee').sort({ createdAt: -1 });
    res.json({ success: true, data: leaves });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateLeaveStatus = async (req, res) => {
  try {
    const { statut, commentaireRH } = req.body;
    if (!['approuve', 'rejete'].includes(statut))
      return res.status(400).json({ success: false, message: 'Statut invalide' });
    const leave = await Leave.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      { statut, commentaireRH, approvedBy: req.user.id, approvedAt: new Date() },
      { new: true }
    ).populate('employee');
    logAction(req, { action: 'UPDATE_LEAVE_STATUS', entity: 'Leave', entityId: req.params.id, details: req.body.statut });
    res.json({ success: true, data: leave });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.generatePayslip = async (req, res) => {
  try {
    const { employeeId, mois, annee, heuresSup = 0, primes = 0 } = req.body;
    const employee = await Employee.findOne({ _id: employeeId, company: req.user.company });
    if (!employee) return res.status(404).json({ success: false, message: 'Employé introuvable' });
    const ficheData = genererFichePaie(employee.salaireBase, heuresSup, null, primes);
    const payslip = await Payslip.create({
      ...ficheData, mois, annee,
      company: req.user.company, employee: employeeId, createdBy: req.user.id
    });
    res.status(201).json({ success: true, data: payslip });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getPayslips = async (req, res) => {
  try {
    const payslips = await Payslip.find({ company: req.user.company, employee: req.params.employeeId })
      .sort({ annee: -1, mois: -1 });
    res.json({ success: true, data: payslips });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getAllPayslips = async (req, res) => {
  try {
    const filter = { company: req.user.company };
    if (req.query.employeeId) filter.employee = req.query.employeeId;
    const payslips = await Payslip.find(filter)
      .populate('employee', 'prenom nom')
      .sort({ annee: -1, mois: -1 })
      .limit(50);
    res.json({ success: true, data: payslips });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.validerFiche = async (req, res) => {
  try {
    const p = await Payslip.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company, statut: 'brouillon' },
      { statut: 'valide' },
      { new: true }
    ).populate('employee', 'prenom nom');
    if (!p) return res.status(404).json({ success: false, message: 'Fiche introuvable ou déjà validée' });
    res.json({ success: true, data: p });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getVirementsReady = async (req, res) => {
  try {
    const { mois, annee } = req.query;
    const filter = { company: req.user.company, statut: 'valide' };
    if (mois) filter.mois = parseInt(mois);
    if (annee) filter.annee = parseInt(annee);
    const payslips = await Payslip.find(filter)
      .populate('employee', 'prenom nom iban email')
      .sort({ annee: -1, mois: -1 });
    res.json({ success: true, data: payslips });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.effectuerVirements = async (req, res) => {
  try {
    const { payslipIds, mois, annee } = req.body;
    if (!payslipIds || !payslipIds.length)
      return res.status(400).json({ success: false, message: 'Aucune fiche sélectionnée' });

    const payslips = await Payslip.find({
      _id: { $in: payslipIds }, company: req.user.company, statut: 'valide'
    }).populate('employee', 'prenom nom iban');

    if (!payslips.length)
      return res.status(400).json({ success: false, message: 'Aucune fiche valide trouvée' });

    const lignes = payslips.map(p => ({
      employee: p.employee?._id,
      payslip: p._id,
      employeeNom: p.employee ? `${p.employee.prenom} ${p.employee.nom}` : '—',
      iban: p.employee?.iban || null,
      montant: p.salaireNet,
      statut: p.employee?.iban ? 'effectue' : 'sans_iban'
    }));

    const montantTotal = lignes.reduce((s, l) => s + (l.montant || 0), 0);
    const hasPartial = lignes.some(l => l.statut === 'sans_iban');

    await Payslip.updateMany(
      { _id: { $in: payslipIds }, company: req.user.company },
      { statut: 'paye' }
    );

    const periodeM = mois || payslips[0]?.mois;
    const periodeA = annee || payslips[0]?.annee;
    const virement = await Virement.create({
      company: req.user.company,
      mois: periodeM, annee: periodeA,
      periode: `${MOIS_LABELS[periodeM] || periodeM} ${periodeA}`,
      lignes, montantTotal,
      nbEmployes: payslips.length,
      statut: hasPartial ? 'partiel' : 'effectue',
      effectueLe: new Date(),
      createdBy: req.user.id
    });

    res.json({
      success: true, data: virement,
      message: `${payslips.length} virement(s) effectué(s) — Total : ${montantTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getVirements = async (req, res) => {
  try {
    const virements = await Virement.find({ company: req.user.company })
      .sort({ effectueLe: -1 }).limit(30);
    res.json({ success: true, data: virements });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Avances sur salaire ──
exports.getAvances = async (req, res) => {
  try {
    const { statut, employee } = req.query;
    const filter = { company: req.user.company };
    if (statut) filter.statut = statut;
    if (employee) filter.employee = employee;
    const avances = await AvanceSalaire.find(filter)
      .populate('employee', 'prenom nom')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: avances, count: avances.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createAvance = async (req, res) => {
  try {
    const { employee, montant, motif, dateAvance, deduireDePaie } = req.body;
    const emp = await Employee.findOne({ _id: employee, company: req.user.company });
    if (!emp) return res.status(404).json({ success: false, message: 'Employé introuvable' });
    const employeeNom = `${emp.prenom} ${emp.nom}`;
    const avance = await AvanceSalaire.create({
      company: req.user.company,
      employee,
      employeeNom,
      montant,
      motif,
      dateAvance: dateAvance || Date.now(),
      deduireDePaie: deduireDePaie !== undefined ? deduireDePaie : true,
      createdBy: req.user.id
    });
    notifyAdvanceRequested(req.user.company, { employeeNom, montant, motif });
    res.status(201).json({ success: true, data: avance });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.approuverAvance = async (req, res) => {
  try {
    const avance = await AvanceSalaire.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      { statut: 'approuvee' },
      { new: true }
    );
    if (!avance) return res.status(404).json({ success: false, message: 'Avance introuvable' });
    res.json({ success: true, data: avance, message: 'Avance approuvée' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.rejeterAvance = async (req, res) => {
  try {
    const avance = await AvanceSalaire.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      { statut: 'rejetee' },
      { new: true }
    );
    if (!avance) return res.status(404).json({ success: false, message: 'Avance introuvable' });
    res.json({ success: true, data: avance, message: 'Avance rejetée' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.rembourserAvance = async (req, res) => {
  try {
    const avance = await AvanceSalaire.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      { statut: 'remboursee', dateRemboursement: new Date() },
      { new: true }
    );
    if (!avance) return res.status(404).json({ success: false, message: 'Avance introuvable' });
    res.json({ success: true, data: avance, message: 'Avance marquée comme remboursée' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteAvance = async (req, res) => {
  try {
    const avance = await AvanceSalaire.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    if (!avance) return res.status(404).json({ success: false, message: 'Avance introuvable' });
    res.json({ success: true, message: 'Avance supprimée' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
