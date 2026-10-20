/**
 * Commercialisation — un seul interrupteur.
 *
 * Les mentions légales déclarent qu'aucune vente ne peut être réalisée tant que
 * l'entreprise n'est pas immatriculée. Rien, dans le code, ne garantissait cette
 * déclaration : le parcours de souscription Stripe restait ouvert, et un essai expiré
 * basculait le compte en lecture seule en proposant de payer. Le document juridique et
 * le produit se contredisaient.
 *
 * `VENTE_ACTIVE` lève cette contradiction en un point unique :
 *
 *   false (défaut) — avant immatriculation. Aucune souscription n'est possible, et
 *   aucun compte n'est restreint pour défaut de paiement : on ne peut pas exiger un
 *   règlement qu'on n'a pas le droit d'encaisser.
 *
 *   true — après immatriculation, Stripe activé en production. Le parcours de
 *   souscription s'ouvre et le contrôle d'abonnement reprend son office.
 *
 * Le drapeau doit être passé à `true` le jour de l'immatriculation, en même temps que
 * la mise à jour des mentions légales. Les deux vont ensemble.
 */
const venteActive = () => process.env.VENTE_ACTIVE === 'true';

/** Message unique, affiché partout où une souscription est proposée. */
const MESSAGE_VENTE_FERMEE =
  "Les souscriptions ouvriront à l'immatriculation de la société. " +
  "D'ici là, l'accès reste complet et gratuit.";

module.exports = { venteActive, MESSAGE_VENTE_FERMEE };
