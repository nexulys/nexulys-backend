const CatalogueItem = require('../models/CatalogueItem');

exports.getItems = async (req, res) => {
  try {
    const items = await CatalogueItem.find({ company: req.user.company, actif: true }).sort({ nom: 1 });
    res.json({ success: true, data: items, count: items.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createItem = async (req, res) => {
  try {
    if (!req.body.nom || req.body.prixUnitaire === undefined) return res.status(400).json({ success: false, message: 'Nom et prix requis' });
    const item = await CatalogueItem.create({ ...req.body, company: req.user.company });
    res.status(201).json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateItem = async (req, res) => {
  try {
    const item = await CatalogueItem.findOneAndUpdate({ _id: req.params.id, company: req.user.company }, req.body, { new: true });
    if (!item) return res.status(404).json({ success: false, message: 'Article introuvable' });
    res.json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteItem = async (req, res) => {
  try {
    const item = await CatalogueItem.findOneAndUpdate({ _id: req.params.id, company: req.user.company }, { actif: false }, { new: true });
    if (!item) return res.status(404).json({ success: false, message: 'Article introuvable' });
    res.json({ success: true, message: 'Article supprimé' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
