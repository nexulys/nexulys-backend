const mongoose = require('mongoose');
const Company = require('../models/Company');
const Subscription = require('../models/Subscription');
const logger = require('../utils/logger');

/**
 * Effacement RGPD (art. 17).
 *
 * L'ancienne implémentation se contentait d'envoyer un e-mail promettant un
 * traitement sous 30 jours : rien n'était effacé. Ce service exécute réellement la
 * purge, après un délai de rétractation.
 *
 * Deux catégories de données sont traitées différemment :
 *
 *  - Les données du client (employés, factures, CRM, documents…) sont SUPPRIMÉES.
 *    Novexa n'en est que sous-traitant : à la fin de la prestation, elles doivent
 *    être effacées (art. 28.3.g). Au client d'exporter ce qu'il doit conserver au
 *    titre de ses propres obligations — l'export RGPD reste accessible jusqu'à la
 *    purge, y compris pendant le délai de rétractation.
 *
 *  - Les données de facturation de Novexa (abonnement, historique des paiements)
 *    sont CONSERVÉES sous forme pseudonymisée : elles relèvent de la comptabilité
 *    propre de Novexa, soumise à une conservation de dix ans (code de commerce,
 *    art. L123-22), ce qui constitue une obligation légale au sens de l'art. 17.3.b.
 */

const DELAI_RETRACTATION_JOURS = 30;

/** Modèles à purger : tous ceux rattachés à une entreprise, sauf exceptions. */
const CONSERVES = new Set(['Company', 'Subscription']);

const modelesAPurger = () =>
  mongoose.modelNames()
    .filter((nom) => !CONSERVES.has(nom))
    .map((nom) => mongoose.model(nom))
    // Découverte dynamique plutôt qu'une liste figée : un modèle ajouté plus tard
    // est purgé automatiquement, au lieu de survivre silencieusement à l'effacement.
    .filter((modele) => Boolean(modele.schema.path('company')));

/** Programme l'effacement, avec un délai pendant lequel la demande reste révocable. */
const demanderSuppression = async ({ companyId, userId, motif }) => {
  const prevueLe = new Date(Date.now() + DELAI_RETRACTATION_JOURS * 24 * 60 * 60 * 1000);
  const company = await Company.findByIdAndUpdate(
    companyId,
    {
      suppressionDemandeeLe: new Date(),
      suppressionPrevueLe: prevueLe,
      suppressionDemandeePar: userId,
      suppressionMotif: String(motif || '').slice(0, 1000)
    },
    { new: true }
  );
  if (company) {
    logger.warn('Effacement RGPD programmé', { company: companyId, prevueLe, demandePar: userId });
  }
  return company;
};

/** Annule une demande tant que la purge n'a pas eu lieu. */
const annulerSuppression = async (companyId) => {
  const company = await Company.findById(companyId);
  if (!company) return null;
  if (company.supprimeeLe) return company; // déjà purgée : plus rien à annuler

  company.suppressionDemandeeLe = undefined;
  company.suppressionPrevueLe = undefined;
  company.suppressionDemandeePar = undefined;
  company.suppressionMotif = undefined;
  await company.save();
  logger.info('Effacement RGPD annulé', { company: companyId });
  return company;
};

/**
 * Purge effective. Idempotent : une entreprise déjà purgée est ignorée.
 * `forcer` court-circuite le délai de rétractation (demande explicite du client).
 */
const purgerEntreprise = async (companyId, { forcer = false } = {}) => {
  const company = await Company.findById(companyId);
  if (!company) throw new Error('Entreprise introuvable');
  if (company.supprimeeLe) return { deja: true, company };
  if (!company.suppressionDemandeeLe) throw new Error('Aucune demande de suppression enregistrée');
  if (!forcer && company.suppressionPrevueLe && company.suppressionPrevueLe > new Date()) {
    throw new Error('Délai de rétractation non écoulé');
  }

  const detail = {};
  for (const modele of modelesAPurger()) {
    const { deletedCount } = await modele.deleteMany({ company: companyId });
    if (deletedCount) detail[modele.modelName] = deletedCount;
  }

  // Abonnement : on garde les montants et dates (comptabilité Novexa), on retire
  // les identifiants personnels et les références de paiement.
  await Subscription.findOneAndUpdate(
    { company: companyId },
    {
      statut: 'annule',
      cancelledAt: new Date(),
      billingEmail: null,
      paymentMethod: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null
    }
  );

  // L'entreprise elle-même est anonymisée, pas supprimée : les factures d'abonnement
  // émises par Novexa doivent rester rattachables pendant la durée de conservation.
  company.nom = `[Supprimée ${company._id.toString().slice(-6)}]`;
  company.email = undefined;
  company.telephone = undefined;
  company.adresse = undefined;
  company.ville = undefined;
  company.codePostal = undefined;
  company.siteWeb = undefined;
  company.iban = undefined;
  company.urssaf = undefined;
  company.slackWebhookUrl = undefined;
  company.owner = undefined;
  company.actif = false;
  company.anonymisee = true;
  company.supprimeeLe = new Date();
  company.suppressionMotif = undefined;
  await company.save();

  const total = Object.values(detail).reduce((s, n) => s + n, 0);
  // Journalisé sans donnée personnelle : sert de preuve de l'exécution.
  logger.warn('Effacement RGPD exécuté', { company: companyId, documentsSupprimes: total, detail });

  return { deja: false, company, documentsSupprimes: total, detail };
};

/** Traite toutes les demandes dont le délai de rétractation est écoulé. */
const purgerDemandesEchues = async () => {
  const echues = await Company.find({
    suppressionDemandeeLe: { $ne: null },
    suppressionPrevueLe: { $lte: new Date() },
    supprimeeLe: null
  }).select('_id');

  const resultats = { traitees: 0, echecs: 0, documentsSupprimes: 0 };
  for (const { _id } of echues) {
    try {
      const r = await purgerEntreprise(_id);
      resultats.traitees++;
      resultats.documentsSupprimes += r.documentsSupprimes || 0;
    } catch (err) {
      resultats.echecs++;
      logger.error('Échec de purge RGPD', { company: _id, error: err.message });
    }
  }
  return resultats;
};

module.exports = {
  demanderSuppression,
  annulerSuppression,
  purgerEntreprise,
  purgerDemandesEchues,
  modelesAPurger,
  DELAI_RETRACTATION_JOURS
};
