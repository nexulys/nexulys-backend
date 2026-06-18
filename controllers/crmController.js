const Prospect = require('../models/Prospect');
const { sendSlack } = require('../utils/slack');
const Company = require('../models/Company');

exports.getProspects = async (req, res) => {
  try {
    const filter = { company: req.user.company };
    if (req.query.statut) filter.statut = req.query.statut;
    const prospects = await Prospect.find(filter).sort({ updatedAt: -1 });
    const pipeline = ['prospect', 'contact', 'negociation', 'gagne', 'perdu'].map(statut => ({
      statut,
      count: prospects.filter(p => p.statut === statut).length,
      valeur: prospects.filter(p => p.statut === statut).reduce((s, p) => s + p.valeurEstimee, 0)
    }));
    res.json({ success: true, data: prospects, pipeline, count: prospects.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createProspect = async (req, res) => {
  try {
    if (!req.body.nom) return res.status(400).json({ success: false, message: 'Nom requis' });
    const prospect = await Prospect.create({ ...req.body, company: req.user.company, createdBy: req.user.id });
    const company = await Company.findById(req.user.company);
    if (company?.slackWebhookUrl) {
      await sendSlack(company.slackWebhookUrl, `🎯 Nouveau prospect CRM : *${prospect.nom}* (${prospect.entreprise || '—'}) — ${prospect.valeurEstimee || 0} €`);
    }
    res.status(201).json({ success: true, data: prospect });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateProspect = async (req, res) => {
  try {
    const prospect = await Prospect.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      req.body,
      { new: true }
    );
    if (!prospect) return res.status(404).json({ success: false, message: 'Prospect introuvable' });
    if (req.body.statut === 'gagne') {
      const company = await Company.findById(req.user.company);
      if (company?.slackWebhookUrl) {
        await sendSlack(company.slackWebhookUrl, `🎉 Deal gagné ! *${prospect.nom}* — ${prospect.valeurEstimee} €`);
      }
    }
    res.json({ success: true, data: prospect });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteProspect = async (req, res) => {
  try {
    const prospect = await Prospect.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    if (!prospect) return res.status(404).json({ success: false, message: 'Prospect introuvable' });
    res.json({ success: true, message: 'Prospect supprimé' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getKPIs = async (req, res) => {
  try {
    const prospects = await Prospect.find({ company: req.user.company });
    const total = prospects.length;
    const gagnes = prospects.filter(p => p.statut === 'gagne');
    const enCours = prospects.filter(p => ['prospect', 'contact', 'negociation'].includes(p.statut));
    const tauxConversion = total > 0 ? Math.round(gagnes.length / total * 100) : 0;
    const valeurPipeline = enCours.reduce((s, p) => s + p.valeurEstimee * p.probabilite / 100, 0);
    res.json({ success: true, data: { total, gagnes: gagnes.length, tauxConversion, valeurPipeline: Math.round(valeurPipeline), enCours: enCours.length } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
