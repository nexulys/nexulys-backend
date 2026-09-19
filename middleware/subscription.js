const Subscription = require('../models/Subscription');

/**
 * Contrôle de l'état d'abonnement.
 *
 * Sans ce garde, l'abonnement n'avait aucun effet : un essai expiré, un abonnement
 * annulé ou impayé conservait l'accès complet à l'API, donc aucune contrainte de
 * paiement réelle.
 *
 * Politique retenue : lecture seule quand l'abonnement est inactif. Le client peut
 * toujours consulter et exporter ses données — les retenir exposerait à un litige
 * et contreviendrait au droit d'accès (RGPD art. 15) — mais ne peut plus rien créer
 * ni modifier tant qu'il n'a pas régularisé.
 */

const METHODES_LECTURE = new Set(['GET', 'HEAD', 'OPTIONS']);

const STATUTS_ACTIFS = new Set(['actif', 'active']);
const STATUTS_ESSAI = new Set(['essai', 'trial']);

/**
 * Détermine si un abonnement ouvre des droits d'écriture.
 * Absence d'abonnement = tolérance : les comptes créés avant l'introduction de ce
 * garde ne doivent pas se retrouver bloqués du jour au lendemain.
 */
const donneAccesEcriture = (sub) => {
  if (!sub) return true;
  if (STATUTS_ACTIFS.has(sub.statut)) return true;
  if (STATUTS_ESSAI.has(sub.statut)) {
    // Un essai ne vaut que jusqu'à son terme.
    return !sub.trialEndsAt || new Date(sub.trialEndsAt) > new Date();
  }
  return false;
};

/** Motif lisible, destiné à l'interface. */
const motifBlocage = (sub) => {
  if (!sub) return 'Aucun abonnement associé à cette entreprise.';
  if (STATUTS_ESSAI.has(sub.statut)) return "Votre période d'essai est terminée.";
  switch (sub.statut) {
    case 'en_attente_paiement': return 'Votre paiement n\'a pas encore été confirmé.';
    case 'suspendu': return 'Votre abonnement est suspendu suite à un paiement échoué.';
    case 'annule':
    case 'cancelled': return 'Votre abonnement a été annulé.';
    default: return 'Votre abonnement n\'est pas actif.';
  }
};

/**
 * Bloque les écritures si l'abonnement n'ouvre plus de droits.
 * Les lectures passent toujours : consultation et export restent possibles.
 */
const verifierAbonnement = async (req, res, next) => {
  try {
    if (METHODES_LECTURE.has(req.method)) return next();
    if (!req.user?.company) return next();

    const sub = await Subscription.findOne({ company: req.user.company });
    if (donneAccesEcriture(sub)) {
      req.subscription = sub;
      return next();
    }

    // 402 Payment Required : le client est authentifié et légitime, seul le paiement manque.
    return res.status(402).json({
      success: false,
      message: `${motifBlocage(sub)} Vos données restent consultables et exportables ; la création et la modification sont suspendues jusqu'à la régularisation.`,
      code: 'ABONNEMENT_INACTIF',
      statut: sub?.statut || null
    });
  } catch (err) { next(err); }
};

module.exports = { verifierAbonnement, donneAccesEcriture, motifBlocage };
