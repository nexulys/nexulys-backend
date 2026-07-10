const CentreAnalytique = require('../models/CentreAnalytique');
const { sendError } = require('../utils/errorResponse');

exports.getCentres = async (req, res) => {
  try {
    const centres = await CentreAnalytique.find({ company: req.user.company }).sort({ createdAt: -1 });
    res.json({ success: true, data: centres });
  } catch (err) { sendError(res, err); }
};

exports.createCentre = async (req, res) => {
  try {
    const centre = await CentreAnalytique.create({ ...req.body, company: req.user.company });
    res.status(201).json({ success: true, data: centre });
  } catch (err) { sendError(res, err); }
};

exports.updateCentre = async (req, res) => {
  try {
    const centre = await CentreAnalytique.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      req.body,
      { new: true }
    );
    if (!centre) return res.status(404).json({ success: false, message: 'Centre analytique introuvable' });
    res.json({ success: true, data: centre });
  } catch (err) { sendError(res, err); }
};

exports.deleteCentre = async (req, res) => {
  try {
    await CentreAnalytique.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    res.json({ success: true, message: 'Centre analytique supprimé' });
  } catch (err) { sendError(res, err); }
};
