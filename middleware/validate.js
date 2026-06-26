const { body, validationResult } = require('express-validator');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array().map(e => ({ champ: e.path, message: e.msg })) });
  next();
};

exports.validateRegister = [
  body('nom').trim().notEmpty().withMessage('Le nom est requis'),
  body('prenom').trim().notEmpty().withMessage('Le prénom est requis'),
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('password').isLength({ min: 8 }).withMessage('Mot de passe minimum 8 caractères'),
  body('nomEntreprise').trim().notEmpty().withMessage("Le nom de l'entreprise est requis"),
  handleValidation
];

exports.validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('password').notEmpty().withMessage('Mot de passe requis'),
  handleValidation
];

exports.validateEmployee = [
  body('nom').trim().notEmpty().withMessage('Le nom est requis'),
  body('prenom').trim().notEmpty().withMessage('Le prénom est requis'),
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('poste').trim().notEmpty().withMessage('Le poste est requis'),
  body('salaireBase').isFloat({ min: 0 }).withMessage('Salaire invalide'),
  body('dateEmbauche').isISO8601().withMessage('Date d\'embauche invalide'),
  handleValidation
];

exports.validateInvoice = [
  body('client.nom').trim().notEmpty().withMessage('Le nom du client est requis'),
  body('lignes').isArray({ min: 1 }).withMessage('Au moins une ligne de facturation requise'),
  body('lignes.*.description').trim().notEmpty().withMessage('Description de ligne requise'),
  body('lignes.*.quantite').isFloat({ min: 0.01 }).withMessage('Quantité invalide'),
  body('lignes.*.prixUnitaire').isFloat({ min: 0 }).withMessage('Prix unitaire invalide'),
  body('lignes.*.montantHT').isFloat({ min: 0 }).withMessage('Montant HT invalide'),
  handleValidation
];

exports.validateProduct = [
  body('nom').trim().notEmpty().withMessage('Le nom du produit est requis'),
  body('sku').trim().notEmpty().withMessage('Le SKU est requis'),
  body('quantite').optional().isInt({ min: 0 }).withMessage('Quantité invalide'),
  body('seuilAlerte').optional().isInt({ min: 0 }).withMessage('Seuil d\'alerte invalide'),
  handleValidation
];

exports.validateTask = [
  body('titre').trim().notEmpty().withMessage('Le titre de la tâche est requis'),
  body('priorite').optional().isIn(['basse', 'normale', 'haute', 'urgente']).withMessage('Priorité invalide'),
  body('statut').optional().isIn(['todo', 'en_cours', 'en_revue', 'termine', 'annule']).withMessage('Statut invalide'),
  handleValidation
];
