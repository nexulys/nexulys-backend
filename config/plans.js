/**
 * Source unique de vérité des offres Novexa.
 * Référencée par : abonnement (plans + activation), Stripe, emails, admin (MRR), frontend.
 */
const PLANS = [
  {
    id: 'starter',
    nom: 'Starter',
    prix: 39,
    devise: 'EUR',
    facturation: 'mensuel',
    cible: 'Indépendants & micro-entreprises',
    fonctionnalites: [
      'Facturation & devis illimités',
      'Suivi des dépenses',
      'TVA automatique',
      'Tableau de bord & trésorerie',
      'Export comptable (FEC)',
      '1 utilisateur'
    ],
    limites: { utilisateurs: 1, employes: 0 }
  },
  {
    id: 'business',
    nom: 'Business',
    prix: 89,
    devise: 'EUR',
    facturation: 'mensuel',
    populaire: true,
    cible: 'PME en croissance',
    fonctionnalites: [
      'Tout Starter, plus :',
      'RH & fiches de paie françaises',
      'Gestion des stocks & fournisseurs',
      'CRM & pipeline commercial',
      'Projets, tâches & notes de frais',
      'Relances de paiement automatiques',
      "Jusqu'à 10 utilisateurs"
    ],
    limites: { utilisateurs: 10, employes: 25 }
  },
  {
    id: 'pro',
    nom: 'Pro',
    prix: 199,
    devise: 'EUR',
    facturation: 'mensuel',
    cible: 'Entreprises établies',
    fonctionnalites: [
      'Tout Business, plus :',
      'Assistant IA & copilote proactif',
      'Facturation électronique (Factur-X)',
      'Rôles & permissions avancés',
      'Multi-utilisateurs illimités',
      'API & intégrations',
      'Support prioritaire 24/7'
    ],
    limites: { utilisateurs: 'illimité', employes: 'illimité' }
  }
];

const DEFAULT_PLAN = 'business';
const ESSAI_GRATUIT = '14 jours';

const getPlan = (id) => PLANS.find(p => p.id === id) || PLANS.find(p => p.id === DEFAULT_PLAN);

module.exports = { PLANS, DEFAULT_PLAN, ESSAI_GRATUIT, getPlan };
