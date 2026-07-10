const Budget = require('../models/Budget');
const { sendError } = require('../utils/errorResponse');

exports.getBudget = async (req, res) => {
  try {
    const annee = parseInt(req.query.annee) || new Date().getFullYear();
    const budgets = await Budget.find({ company: req.user.company, annee });
    res.json({ success: true, data: budgets });
  } catch (err) { sendError(res, err); }
};

exports.createBudget = async (req, res) => {
  try {
    const budget = await Budget.create({ ...req.body, company: req.user.company });
    res.status(201).json({ success: true, data: budget });
  } catch (err) { sendError(res, err); }
};

exports.updateBudget = async (req, res) => {
  try {
    const { montantPrevu, montantReel, notes } = req.body;
    const update = {};
    if (montantPrevu !== undefined) update.montantPrevu = montantPrevu;
    if (montantReel !== undefined) update.montantReel = montantReel;
    if (notes !== undefined) update.notes = notes;
    const budget = await Budget.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      update,
      { new: true }
    );
    if (!budget) return res.status(404).json({ success: false, message: 'Ligne budget introuvable' });
    res.json({ success: true, data: budget });
  } catch (err) { sendError(res, err); }
};

exports.deleteBudget = async (req, res) => {
  try {
    await Budget.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    res.json({ success: true, message: 'Ligne budget supprimée' });
  } catch (err) { sendError(res, err); }
};
