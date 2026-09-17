const crypto = require('crypto');
const User = require('../models/User');
const Company = require('../models/Company');
const Subscription = require('../models/Subscription');
const jwt = require('jsonwebtoken');
const { sendMail } = require('../utils/mailer');
const { sendError } = require('../utils/errorResponse');
const { escapeHtml } = require('../utils/escape');

const generateToken = (user) =>
  jwt.sign(
    { id: user._id, tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

const setTokenCookie = (res, token) => {
  res.cookie('novexa_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
};

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
      html: `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px"><h2 style="color:#6366f1">Bienvenue ${prenom} sur Novexa !</h2><p>Votre compte est créé avec succès. Profitez de <strong>14 jours d'essai gratuit</strong>, sans carte bancaire.</p><p>Connectez-vous maintenant et commencez à gérer votre entreprise intelligemment.</p><hr style="border-color:#eee;margin:24px 0"/><small style="color:#999">Novexa by Nexulys — La plateforme de gestion d'entreprise intelligente</small></div>`
    }).catch(() => {});

    const token = generateToken(user);
    setTokenCookie(res, token);
    res.status(201).json({
      success: true,
      message: 'Compte Novexa créé — essai gratuit 14 jours',
      data: {
        token,
        utilisateur: { id: user._id, nom, prenom, email, role: user.role },
        entreprise: { id: company._id, nom: nomEntreprise },
        abonnement: {
          plan: 'Business',
          prix: '89 € / mois',
          statut: 'essai',
          dureeEssai: '14 jours'
        }
      }
    });
  } catch (err) { sendError(res, err); }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password').populate('company');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Identifiants invalides' });
    if (user.actif === false)
      return res.status(403).json({ success: false, message: 'Compte désactivé. Contactez votre administrateur.' });
    const token = generateToken(user);
    setTokenCookie(res, token);
    res.json({
      success: true,
      data: {
        token,
        utilisateur: { id: user._id, nom: user.nom, prenom: user.prenom, email, role: user.role },
        entreprise: user.company
      }
    });
  } catch (err) { sendError(res, err); }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('company');
    // Propriétaire de la plateforme (email = ADMIN_EMAIL) : débloque l'accès
    // au back-office Novexa depuis le dashboard (le panel reste protégé par
    // ADMIN_SECRET — ce drapeau ne fait qu'afficher le lien).
    const isPlatformAdmin = Boolean(
      process.env.ADMIN_EMAIL && user &&
      user.email && user.email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()
    );
    const data = user ? { ...user.toObject(), isPlatformAdmin } : user;
    res.json({ success: true, data });
  } catch (err) { sendError(res, err); }
};

exports.updateProfile = async (req, res) => {
  try {
    const { nom, prenom, email } = req.body;
    const update = {};
    if (nom !== undefined) update.nom = nom;
    if (prenom !== undefined) update.prenom = prenom;

    if (email !== undefined) {
      const normalise = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalise))
        return res.status(400).json({ success: false, message: 'Email invalide' });
      // L'email du propriétaire de la plateforme confère isPlatformAdmin : il ne doit
      // jamais pouvoir être revendiqué par un utilisateur via son profil.
      if (process.env.ADMIN_EMAIL && normalise === process.env.ADMIN_EMAIL.toLowerCase())
        return res.status(403).json({ success: false, message: 'Cet email ne peut pas être utilisé.' });
      const existant = await User.findOne({ email: normalise, _id: { $ne: req.user.id } });
      if (existant)
        return res.status(400).json({ success: false, message: 'Email déjà utilisé' });
      update.email = normalise;
    }

    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true, runValidators: true });
    res.json({ success: true, data: user });
  } catch (err) { sendError(res, err); }
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
  } catch (err) { sendError(res, err); }
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

    // Envoi non bloquant : attendre le SMTP rendrait la réponse mesurablement plus
    // lente quand l'email existe, ce qui permet d'énumérer les comptes.
    sendMail({
      to: email,
      subject: 'Réinitialisation de votre mot de passe Novexa',
      html: `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px"><h2 style="color:#6366f1">Réinitialisation de mot de passe</h2><p>Vous avez demandé à réinitialiser votre mot de passe Novexa.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Réinitialiser mon mot de passe</a></p><p style="color:#999;font-size:13px">Ce lien expire dans <strong>1 heure</strong>. Si vous n'avez pas fait cette demande, ignorez cet email.</p><hr style="border-color:#eee;margin:24px 0"/><small style="color:#999">Novexa by Nexulys</small></div>`
    }).catch(() => {});

    res.json(genericMsg);
  } catch (err) { sendError(res, err); }
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
  } catch (err) { sendError(res, err); }
};

exports.logout = (req, res) => {
  res.clearCookie('novexa_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.json({ success: true, message: 'Déconnecté.' });
};

// RGPD — Export de toutes les données de l'entreprise (art. 15 et 20)
exports.exportMyData = async (req, res) => {
  try {
    // Réservé aux administrateurs : l'export porte sur TOUTE l'entreprise et contient
    // des données que la plupart des rôles ne doivent pas voir (salaires, IBAN, NIR).
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Seul un administrateur peut exporter les données de l'entreprise. Pour vos propres données, contactez-le."
      });
    }
    const companyId = req.user.company;
    // Export complet : l'ancienne version se limitait à 100 factures et 100 employés
    // en renvoyant à un contact support, ce qui ne satisfait ni le droit d'accès ni
    // la portabilité. On parcourt dynamiquement toutes les collections rattachées à
    // l'entreprise, pour qu'un modèle ajouté plus tard soit exporté sans oubli.
    const { modelesAPurger } = require('../services/rgpdService');

    const [user, company] = await Promise.all([
      User.findById(req.user.id),
      Company.findById(companyId)
    ]);

    const donnees = {};
    for (const modele of modelesAPurger()) {
      const documents = await modele.find({ company: companyId });
      if (documents.length) donnees[modele.modelName] = documents;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="mes_donnees_novexa_${new Date().toISOString().split('T')[0]}.json"`);
    res.json({
      exportDate: new Date().toISOString(),
      demandePar: { id: user?._id, email: user?.email },
      entreprise: company,
      donnees,
      note: 'Export complet des données de votre entreprise, au format JSON réutilisable (RGPD art. 15 et 20).'
    });
  } catch (err) { sendError(res, err); }
};

// RGPD — Demande d'effacement (art. 17). Seul le propriétaire du compte peut la faire :
// elle détruit les données de toute l'entreprise, pas seulement celles du demandeur.
exports.requestAccountDeletion = async (req, res) => {
  try {
    const { motif } = req.body;
    const { demanderSuppression, DELAI_RETRACTATION_JOURS } = require('../services/rgpdService');

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Seul un administrateur de l'entreprise peut demander l'effacement du compte."
      });
    }

    const company = await demanderSuppression({
      companyId: req.user.company,
      userId: req.user.id,
      motif
    });
    if (!company) return res.status(404).json({ success: false, message: 'Entreprise introuvable' });

    sendMail({
      to: process.env.ADMIN_EMAIL || 'admin@novexa.fr',
      subject: `[RGPD] Effacement programmé — ${req.user.email}`,
      html: `<p>L'utilisateur <b>${escapeHtml(req.user.email)}</b> (entreprise ${escapeHtml(req.user.company)}) a demandé l'effacement de son compte.</p>
             <p>Motif : ${escapeHtml(String(motif || 'Non précisé').slice(0, 1000))}</p>
             <p>Purge automatique prévue le ${company.suppressionPrevueLe.toLocaleDateString('fr-FR')}, révocable jusque-là.</p>`
    }).catch(() => {});

    res.json({
      success: true,
      message: `Votre demande d'effacement est enregistrée. Vos données seront définitivement supprimées le ${company.suppressionPrevueLe.toLocaleDateString('fr-FR')}. Vous pouvez annuler cette demande jusqu'à cette date, et exporter vos données d'ici là.`,
      data: {
        suppressionPrevueLe: company.suppressionPrevueLe,
        delaiRetractationJours: DELAI_RETRACTATION_JOURS
      }
    });
  } catch (err) { sendError(res, err); }
};

// RGPD — Révocation de la demande, tant que la purge n'a pas eu lieu
exports.cancelAccountDeletion = async (req, res) => {
  try {
    const { annulerSuppression } = require('../services/rgpdService');
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Seul un administrateur de l'entreprise peut annuler la demande." });
    }
    const company = await annulerSuppression(req.user.company);
    if (!company) return res.status(404).json({ success: false, message: 'Entreprise introuvable' });
    if (company.supprimeeLe) {
      return res.status(410).json({ success: false, message: 'Les données ont déjà été supprimées : la demande ne peut plus être annulée.' });
    }
    res.json({ success: true, message: "Votre demande d'effacement a été annulée. Votre compte reste actif." });
  } catch (err) { sendError(res, err); }
};

// RGPD — État de la demande en cours
exports.deletionStatus = async (req, res) => {
  try {
    const company = await Company.findById(req.user.company)
      .select('suppressionDemandeeLe suppressionPrevueLe supprimeeLe anonymisee');
    if (!company) return res.status(404).json({ success: false, message: 'Entreprise introuvable' });
    res.json({
      success: true,
      data: {
        demandeEnCours: Boolean(company.suppressionDemandeeLe && !company.supprimeeLe),
        demandeeLe: company.suppressionDemandeeLe || null,
        prevueLe: company.suppressionPrevueLe || null,
        effectueeLe: company.supprimeeLe || null
      }
    });
  } catch (err) { sendError(res, err); }
};
