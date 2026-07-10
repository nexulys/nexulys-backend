const logger = require('./logger');

/**
 * Réponse d'erreur centralisée pour les contrôleurs.
 * Convertit les erreurs connues en codes HTTP appropriés :
 *  - ValidationError Mongoose      -> 400 (données invalides + détail des champs)
 *  - CastError (ObjectId invalide) -> 400
 *  - Doublon d'index unique (11000)-> 409
 *  - Reste                          -> 500 (message masqué en production)
 */
const sendError = (res, err) => {
  if (err && err.name === 'ValidationError') {
    const errors = Object.values(err.errors || {}).map(e => ({ champ: e.path, message: e.message }));
    return res.status(400).json({ success: false, message: 'Données invalides', errors });
  }
  if (err && err.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Identifiant invalide : ${err.value}` });
  }
  if (err && err.code === 11000) {
    const champ = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'valeur';
    return res.status(409).json({ success: false, message: `Cette ${champ} existe déjà.` });
  }
  logger.error('Erreur contrôleur', { error: err && err.message });
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Erreur interne.' : (err && err.message)
  });
};

module.exports = { sendError };
