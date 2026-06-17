const User = require('../models/User');
const Company = require('../models/Company');
const Subscription = require('../models/Subscription');
const jwt = require('jsonwebtoken');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET || 'novexa_secret', { expiresIn: '30d' });

exports.register = async (req, res) => {
  try {
    const { nom, prenom, email, password, nomEntreprise, siret } = req.body;
    if (await User.findOne({ email }))
      return res.status(400).json({ success: false, message: 'Email déjà utilisé' });

    const company = await Company.create({ nom: nomEntreprise, siret });
    const subscription = await Subscription.create({ company: company._id });
    company.subscription = subscription._id;
    await company.save();

    const user = await User.create({ nom, prenom, email, password, company: company._id, role: 'admin' });
    company.owner = user._id;
    await company.save();

    res.status(201).json({
      success: true,
      message: 'Compte Novexa créé — essai gratuit 14 jours',
      data: {
        token: generateToken(user._id),
        utilisateur: { id: user._id, nom, prenom, email, role: user.role },
        entreprise: { id: company._id, nom: nomEntreprise },
        abonnement: {
          plan: 'Novexa Pro',
          prix: '2 500 € / mois',
          statut: 'essai',
          dureeEssai: '14 jours'
        }
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password').populate('company');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Identifiants invalides' });
    res.json({
      success: true,
      data: {
        token: generateToken(user._id),
        utilisateur: { id: user._id, nom: user.nom, prenom: user.prenom, email, role: user.role },
        entreprise: user.company
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.me = async (req, res) => {
  const user = await User.findById(req.user.id).populate('company');
  res.json({ success: true, data: user });
};

exports.updateProfile = async (req, res) => {
  try {
    const { nom, prenom, email } = req.body;
    const user = await User.findByIdAndUpdate(req.user.id, { nom, prenom, email }, { new: true });
    res.json({ success: true, data: user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.onboarding = async (req, res) => {
  try {
    const { nom, siret, adresse, ville, codePostal, telephone, email, secteur } = req.body;
    const company = await Company.findOneAndUpdate(
      { owner: req.user.id },
      { nom, siret, adresse, ville, codePostal, telephone, email, secteur },
      { new: true, upsert: true }
    );
    res.json({ success: true, message: 'Entreprise mise à jour', data: company });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.inviteUser = async (req, res) => {
  try {
    const { nom, prenom, email, password, role } = req.body;
    if (await User.findOne({ email }))
      return res.status(400).json({ success: false, message: 'Email déjà utilisé' });
    const user = await User.create({ nom, prenom, email, password, role: role || 'employee', company: req.user.company });
    res.status(201).json({ success: true, message: 'Utilisateur invité', data: { id: user._id, nom, prenom, email, role: user.role } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
