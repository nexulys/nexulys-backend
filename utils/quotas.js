const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Employee = require('../models/Employee');
const { getPlan } = require('../config/plans');

/**
 * Application des limites de plan définies dans config/plans.js.
 * Elles n'étaient jusqu'ici que déclaratives : un client Starter à 39 € pouvait
 * consommer autant qu'un Pro à 199 €.
 */

const ILLIMITE = 'illimité';

/** Limites du plan souscrit par une entreprise (Business par défaut). */
const limitesDe = async (companyId) => {
  const sub = await Subscription.findOne({ company: companyId }).select('plan');
  return getPlan(sub?.plan).limites || {};
};

/**
 * Vérifie qu'une ressource peut encore être créée.
 * Retourne `null` si c'est permis, sinon un objet décrivant le refus.
 */
const verifierQuota = async (companyId, ressource) => {
  if (!companyId) return null;
  const limites = await limitesDe(companyId);
  const max = limites[ressource];
  if (max === undefined || max === ILLIMITE) return null;

  const compteurs = {
    utilisateurs: () => User.countDocuments({ company: companyId }),
    employes: () => Employee.countDocuments({ company: companyId }),
  };
  if (!compteurs[ressource]) return null;

  const actuel = await compteurs[ressource]();
  if (actuel < max) return null;

  return {
    ressource,
    actuel,
    max,
    message: max === 0
      ? `Votre plan n'inclut pas la gestion des ${ressource}. Changez de plan pour y accéder.`
      : `Limite atteinte : votre plan autorise ${max} ${ressource}. Changez de plan pour en ajouter.`
  };
};

/** Renvoie 402 si le quota est atteint. `true` = la requête a été refusée. */
const refuserSiQuotaAtteint = async (req, res, ressource) => {
  const depassement = await verifierQuota(req.user?.company, ressource);
  if (!depassement) return false;
  res.status(402).json({
    success: false,
    message: depassement.message,
    code: 'QUOTA_PLAN_ATTEINT',
    quota: { ressource: depassement.ressource, actuel: depassement.actuel, max: depassement.max }
  });
  return true;
};

module.exports = { verifierQuota, refuserSiQuotaAtteint, limitesDe };
