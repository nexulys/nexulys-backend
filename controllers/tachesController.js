const Task = require('../models/Task');
const Project = require('../models/Project');
const Automation = require('../models/Automation');
const { sendError } = require('../utils/errorResponse');

exports.createTask = async (req, res) => {
  try {
    const task = await Task.create({ ...req.body, company: req.user.company, createdBy: req.user.id });
    res.status(201).json({ success: true, data: task });
  } catch (err) { sendError(res, err); }
};

exports.getTasks = async (req, res) => {
  try {
    const { statut, assignee, projet, priorite } = req.query;
    const filter = { company: req.user.company };
    if (statut) filter.statut = statut;
    if (assignee) filter.assignee = assignee;
    if (projet) filter.projet = projet;
    if (priorite) filter.priorite = priorite;
    const tasks = await Task.find(filter)
      .populate('assignee', 'nom prenom email')
      .populate('projet', 'nom')
      .sort({ deadline: 1 });
    res.json({ success: true, data: tasks, count: tasks.length });
  } catch (err) { sendError(res, err); }
};

exports.getTask = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, company: req.user.company })
      .populate('assignee', 'nom prenom email')
      .populate('projet');
    if (!task) return res.status(404).json({ success: false, message: 'Tâche introuvable' });
    res.json({ success: true, data: task });
  } catch (err) { sendError(res, err); }
};

exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company }, req.body, { new: true }
    ).populate('assignee', 'nom prenom email');
    if (!task) return res.status(404).json({ success: false, message: 'Tâche introuvable' });
    res.json({ success: true, data: task });
  } catch (err) { sendError(res, err); }
};

exports.deleteTask = async (req, res) => {
  try {
    await Task.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    res.json({ success: true, message: 'Tâche supprimée' });
  } catch (err) { sendError(res, err); }
};

exports.createProject = async (req, res) => {
  try {
    const project = await Project.create({ ...req.body, company: req.user.company, createdBy: req.user.id });
    res.status(201).json({ success: true, data: project });
  } catch (err) { sendError(res, err); }
};

exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ company: req.user.company }).sort({ createdAt: -1 });
    const withStats = await Promise.all(projects.map(async (p) => {
      const tasks = await Task.find({ projet: p._id });
      return {
        ...p.toObject(),
        stats: {
          total: tasks.length,
          termine: tasks.filter(t => t.statut === 'termine').length,
          enCours: tasks.filter(t => t.statut === 'en_cours').length,
          todo: tasks.filter(t => t.statut === 'todo').length
        }
      };
    }));
    res.json({ success: true, data: withStats });
  } catch (err) { sendError(res, err); }
};

exports.createAutomation = async (req, res) => {
  try {
    const automation = await Automation.create({ ...req.body, company: req.user.company, createdBy: req.user.id });
    res.status(201).json({ success: true, data: automation });
  } catch (err) { sendError(res, err); }
};

exports.getAutomations = async (req, res) => {
  try {
    const automations = await Automation.find({ company: req.user.company });
    res.json({ success: true, data: automations, count: automations.length });
  } catch (err) { sendError(res, err); }
};

exports.toggleAutomation = async (req, res) => {
  try {
    const auto = await Automation.findOne({ _id: req.params.id, company: req.user.company });
    if (!auto) return res.status(404).json({ success: false, message: 'Automatisation introuvable' });
    auto.actif = !auto.actif;
    await auto.save();
    res.json({ success: true, data: auto, message: `Automatisation ${auto.actif ? 'activée' : 'désactivée'}` });
  } catch (err) { sendError(res, err); }
};
