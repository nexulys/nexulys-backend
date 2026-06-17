const crypto = require('crypto');
const User = require('../models/User');
const Company = require('../models/Company');
const Subscription = require('../models/Subscription');
const jwt = require('jsonwebtoken');
const { sendMail } = require('../utils/mailer');

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

    sendMail({
      to: email,
      subject: 'Bienvenue sur Novexa !',
      html: `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px"><h2 style="color:#6366f1">Bienvenue ${prenom} sur Novexa !</h2><p>Votre compte Novexa Pro est créé avec succès. Profitez de <strong>14 jours d'essai gratuit</strong>.</p><p>Connectez-vous maintenant et commencez à gérer votre entreprise intelligemment.</p><hr style="border-color:#eee;margin:24px 0"/><small style="color:#999">Novexa by Nexulys — La plateforme de gestion d'entreprise intelligente</small></div>`
    }).catch(() => {});

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

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const genericMsg = { success: true, message: 'Si cet email existe, un lien de réinitialisation vous a été envoyé.' };
    const user = await User.findOne({ email });
    if (!user) return res.json(genericMsg);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordToken = hashed;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const baseUrl = process.env.APP_URL || 'http://localhost:5000';
    const resetUrl = `${baseUrl}/login.html?reset=${rawToken}`;

    await sendMail({
      to: email,
      subject: 'Réinitialisation de votre mot de passe Novexa',
      html: `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px"><h2 style="color:#6366f1">Réinitialisation de mot de passe</h2><p>Vous avez demandé à réinitialiser votre mot de passe Novexa.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Réinitialiser mon mot de passe</a></p><p style="color:#999;font-size:13px">Ce lien expire dans <strong>1 heure</strong>. Si vous n'avez pas fait cette demande, ignorez cet email.</p><hr style="border-color:#eee;margin:24px 0"/><small style="color:#999">Novexa by Nexulys</small></div>`
    });

    res.json(genericMsg);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ success: false, message: 'Token et mot de passe requis.' });
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: new Date() }
    }).select('+resetPasswordToken +resetPasswordExpires');
    if (!user) return res.status(400).json({ success: false, message: 'Lien invalide ou expiré.' });
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ success: true, message: 'Mot de passe réinitialisé avec succès.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
