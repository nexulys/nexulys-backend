const AvanceSalaire = require('../models/AvanceSalaire');
const Employee = require('../models/Employee');
const { sendError } = require('../utils/errorResponse');

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
  } catch (err) { sendError(res, err); }
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
    res.status(201).json({ success: true, data: avance });
  } catch (err) { sendError(res, err); }
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
  } catch (err) { sendError(res, err); }
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
  } catch (err) { sendError(res, err); }
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
  } catch (err) { sendError(res, err); }
};

exports.deleteAvance = async (req, res) => {
  try {
    const avance = await AvanceSalaire.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    if (!avance) return res.status(404).json({ success: false, message: 'Avance introuvable' });
    res.json({ success: true, message: 'Avance supprimée' });
  } catch (err) { sendError(res, err); }
};
