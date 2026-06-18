const User = require('../models/User');
const bcrypt = require('bcryptjs');

exports.getEquipe = async (req, res) => {
  try {
    const membres = await User.find({ company: req.user.company })
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: membres, count: membres.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.inviterMembre = async (req, res) => {
  try {
    const { email, prenom, nom, role, motDePasse } = req.body;
    if (!email || !prenom || !nom || !motDePasse) {
      return res.status(400).json({ success: false, message: 'email, prenom, nom et motDePasse sont requis' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ success: false, message: 'Cet email est déjà utilisé' });

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
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateMembre = async (req, res) => {
  try {
    const { role, actif } = req.body;
    const update = {};
    if (role !== undefined) update.role = role;
    if (actif !== undefined) update.actif = actif;

    const membre = await User.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      update,
      { new: true }
    ).select('-password -resetPasswordToken -resetPasswordExpires');

    if (!membre) return res.status(404).json({ success: false, message: 'Membre introuvable' });
    res.json({ success: true, data: membre });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.supprimerMembre = async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous supprimer vous-même' });
    }
    const membre = await User.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    if (!membre) return res.status(404).json({ success: false, message: 'Membre introuvable' });
    res.json({ success: true, message: 'Membre supprimé' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
