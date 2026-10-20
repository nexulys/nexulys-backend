const User = require('../models/User');
const Company = require('../models/Company');
const { sendError } = require('../utils/errorResponse');
const { refuserSiQuotaAtteint } = require('../utils/quotas');

const ROLES_AUTORISES = ['admin', 'comptable', 'rh', 'manager', 'employee', 'employe', 'lecture'];

const estProprietaire = async (userId, companyId) => {
  const company = await Company.findById(companyId).select('owner');
  return Boolean(company?.owner && company.owner.toString() === String(userId));
};

exports.getEquipe = async (req, res) => {
  try {
    const membres = await User.find({ company: req.user.company })
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: membres, count: membres.length });
  } catch (err) { sendError(res, err); }
};

exports.inviterMembre = async (req, res) => {
  try {
    const { email, prenom, nom, role, motDePasse } = req.body;
    if (!email || !prenom || !nom || !motDePasse) {
      return res.status(400).json({ success: false, message: 'email, prenom, nom et motDePasse sont requis' });
    }
    if (role !== undefined && !ROLES_AUTORISES.includes(role)) {
      return res.status(400).json({ success: false, message: 'Rôle invalide' });
    }
    if (String(motDePasse).length < 8) {
      return res.status(400).json({ success: false, message: 'Mot de passe minimum 8 caractères' });
    }

    const existing = await User.findOne({ email: String(email).toLowerCase() });
    if (existing) return res.status(400).json({ success: false, message: 'Cet email est déjà utilisé' });

    if (await refuserSiQuotaAtteint(req, res, 'utilisateurs')) return;

    const membre = await User.create({
      email,
      prenom,
      nom,
      password: motDePasse,
      role: role || 'employe',
      company: req.user.company
    });

    const result = membre.toObject();
    delete result.password;
    res.status(201).json({ success: true, data: result });
  } catch (err) { sendError(res, err); }
};

exports.updateMembre = async (req, res) => {
  try {
    const { role, actif } = req.body;
    const update = {};
    if (role !== undefined) {
      if (!ROLES_AUTORISES.includes(role))
        return res.status(400).json({ success: false, message: 'Rôle invalide' });
      update.role = role;
    }
    if (actif !== undefined) update.actif = Boolean(actif);

    // Le propriétaire de l'entreprise ne peut être ni rétrogradé ni désactivé :
    // sinon un second admin peut prendre le contrôle définitif du compte.
    if (await estProprietaire(req.params.id, req.user.company))
      return res.status(403).json({ success: false, message: "Le propriétaire de l'entreprise ne peut pas être modifié." });

    const membre = await User.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      update,
      { new: true, runValidators: true }
    ).select('-resetPasswordToken -resetPasswordExpires');

    if (!membre) return res.status(404).json({ success: false, message: 'Membre introuvable' });
    res.json({ success: true, data: membre });
  } catch (err) { sendError(res, err); }
};

exports.supprimerMembre = async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous supprimer vous-même' });
    }
    if (await estProprietaire(req.params.id, req.user.company)) {
      return res.status(403).json({ success: false, message: "Le propriétaire de l'entreprise ne peut pas être supprimé." });
    }
    const membre = await User.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    if (!membre) return res.status(404).json({ success: false, message: 'Membre introuvable' });
    res.json({ success: true, message: 'Membre supprimé' });
  } catch (err) { sendError(res, err); }
};
