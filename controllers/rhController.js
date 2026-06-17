const Employee = require('../models/Employee');
const Contract = require('../models/Contract');
const Leave = require('../models/Leave');
const Payslip = require('../models/Payslip');
const { genererFichePaie } = require('../utils/payslipGenerator');

exports.createEmployee = async (req, res) => {
  try {
    const employee = await Employee.create({ ...req.body, company: req.user.company });
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
    const payslips = await Payslip.find({ company: req.user.company })
      .populate('employee', 'prenom nom')
      .sort({ annee: -1, mois: -1 })
      .limit(50);
    res.json({ success: true, data: payslips });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
