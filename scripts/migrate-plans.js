/**
 * Migration des abonnements existants vers la nouvelle grille tarifaire.
 *
 * Les comptes créés sous l'ancienne offre unique « Novexa Pro » (2 500 €/mois)
 * sont basculés sur le plan **Pro** (199 €/mois) qui reprend l'intégralité des
 * fonctionnalités dont ils disposaient (grand-père).
 *
 * Usage : MONGODB_URI="..." node scripts/migrate-plans.js
 * Idempotent : relançable sans effet secondaire.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
const { getPlan } = require('../config/plans');

// Plan cible pour les anciens utilisateurs « Novexa Pro »
const PLAN_CIBLE = 'pro';

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI manquant.'); process.exit(1); }
  await mongoose.connect(uri);
  console.log('Connecté à MongoDB.');

  const plan = getPlan(PLAN_CIBLE);
  // Cible : anciens plans nommés (pas encore un id 'starter'|'business'|'pro')
  const filtre = { plan: { $nin: ['starter', 'business', 'pro'] } };
  const total = await Subscription.countDocuments(filtre);
  console.log(`${total} abonnement(s) à migrer vers « ${plan.nom} » (${plan.prix} €/mois).`);

  const res = await Subscription.updateMany(filtre, {
    $set: { plan: plan.id, priceMonthly: plan.prix, features: plan.fonctionnalites }
  });

  console.log(`Migration terminée : ${res.modifiedCount} abonnement(s) mis à jour.`);
  await mongoose.disconnect();
  process.exit(0);
})().catch(err => { console.error('Erreur migration :', err.message); process.exit(1); });
