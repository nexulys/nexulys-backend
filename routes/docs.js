const router = require('express').Router();
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Novexa API',
      version: '1.0.0',
      description: 'API de la plateforme SaaS IA Novexa — Comptabilité, RH, Stocks, Tâches et IA. Créé par Nexulys.',
      contact: { name: 'Nexulys', email: 'support@nexulys.com' }
    },
    servers: [{ url: '/api', description: 'Novexa API v1' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      },
      schemas: {
        Error: { type: 'object', properties: { success: { type: 'boolean', example: false }, message: { type: 'string' } } },
        Success: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: { type: 'object' } } },
        RegisterInput: {
          type: 'object', required: ['nom','prenom','email','password','nomEntreprise'],
          properties: {
            nom: { type: 'string', example: 'Dupont' },
            prenom: { type: 'string', example: 'Jean' },
            email: { type: 'string', example: 'jean.dupont@exemple.fr' },
            password: { type: 'string', minLength: 6, example: 'motdepasse123' },
            nomEntreprise: { type: 'string', example: 'Ma Super Entreprise' }
          }
        },
        LoginInput: {
          type: 'object', required: ['email','password'],
          properties: { email: { type: 'string' }, password: { type: 'string' } }
        },
        Invoice: {
          type: 'object',
          properties: {
            numero: { type: 'string' }, client: { type: 'object', properties: { nom: { type: 'string' }, email: { type: 'string' } } },
            montantHT: { type: 'number' }, montantTVA: { type: 'number' }, montantTTC: { type: 'number' },
            statut: { type: 'string', enum: ['brouillon','envoyee','payee','en_retard','annulee'] }
          }
        },
        Employee: {
          type: 'object',
          properties: {
            nom: { type: 'string' }, prenom: { type: 'string' }, email: { type: 'string' },
            poste: { type: 'string' }, salaireBase: { type: 'number' }, dateEmbauche: { type: 'string', format: 'date' },
            statut: { type: 'string', enum: ['actif','inactif','conge','suspendu'] }
          }
        },
        Product: {
          type: 'object',
          properties: {
            nom: { type: 'string' }, sku: { type: 'string' }, quantite: { type: 'number' },
            seuilAlerte: { type: 'number' }, prixAchat: { type: 'number' }, prixVente: { type: 'number' }
          }
        },
        Task: {
          type: 'object',
          properties: {
            titre: { type: 'string' }, description: { type: 'string' },
            priorite: { type: 'string', enum: ['basse','normale','haute','urgente'] },
            statut: { type: 'string', enum: ['todo','en_cours','en_revue','termine','annule'] },
            deadline: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentification et gestion des comptes' },
      { name: 'Comptabilité', description: 'Factures, dépenses, bilan' },
      { name: 'RH', description: 'Employés, contrats, congés, paie' },
      { name: 'Stocks', description: 'Produits, mouvements, fournisseurs' },
      { name: 'Tâches', description: 'Tâches, projets, automatisations' },
      { name: 'IA', description: 'Endpoints d\'intelligence artificielle' },
      { name: 'Abonnement', description: 'Plans et facturation — Novexa Pro 2 500€/mois' }
    ],
    paths: {
      '/auth/register': {
        post: {
          tags: ['Auth'], summary: 'Créer un compte Novexa',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterInput' } } } },
          responses: { 201: { description: 'Compte créé — essai gratuit 14 jours' }, 400: { description: 'Email déjà utilisé ou données invalides' } },
          security: []
        }
      },
      '/auth/login': {
        post: {
          tags: ['Auth'], summary: 'Connexion',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginInput' } } } },
          responses: { 200: { description: 'Token JWT retourné' }, 401: { description: 'Identifiants invalides' } },
          security: []
        }
      },
      '/auth/me': { get: { tags: ['Auth'], summary: 'Profil utilisateur connecté', responses: { 200: { description: 'Données utilisateur' } } } },
      '/comptabilite/factures': {
        get: { tags: ['Comptabilité'], summary: 'Lister les factures', parameters: [{ in: 'query', name: 'statut', schema: { type: 'string' } }, { in: 'query', name: 'page', schema: { type: 'integer' } }], responses: { 200: { description: 'Liste des factures' } } },
        post: { tags: ['Comptabilité'], summary: 'Créer une facture (TVA calculée automatiquement)', responses: { 201: { description: 'Facture créée' } } }
      },
      '/comptabilite/bilan': { get: { tags: ['Comptabilité'], summary: 'Bilan annuel', parameters: [{ in: 'query', name: 'annee', schema: { type: 'integer', example: 2025 } }], responses: { 200: { description: 'Bilan par mois' } } } },
      '/rh/employes': {
        get: { tags: ['RH'], summary: 'Lister les employés', responses: { 200: { description: 'Liste des employés' } } },
        post: { tags: ['RH'], summary: 'Ajouter un employé', responses: { 201: { description: 'Employé créé' } } }
      },
      '/rh/paie/generer': { post: { tags: ['RH'], summary: 'Générer une fiche de paie avec cotisations françaises', responses: { 201: { description: 'Fiche de paie générée' } } } },
      '/stocks/produits': {
        get: { tags: ['Stocks'], summary: 'Lister les produits', parameters: [{ in: 'query', name: 'stockBas', schema: { type: 'boolean' } }], responses: { 200: { description: 'Liste des produits' } } },
        post: { tags: ['Stocks'], summary: 'Créer un produit', responses: { 201: { description: 'Produit créé' } } }
      },
      '/stocks/alertes': { get: { tags: ['Stocks'], summary: 'Alertes stock bas', responses: { 200: { description: 'Produits sous seuil' } } } },
      '/stocks/mouvements': { post: { tags: ['Stocks'], summary: 'Enregistrer un mouvement (entrée/sortie)', responses: { 201: { description: 'Mouvement enregistré' } } } },
      '/taches/': {
        get: { tags: ['Tâches'], summary: 'Lister les tâches', responses: { 200: { description: 'Liste des tâches' } } },
        post: { tags: ['Tâches'], summary: 'Créer une tâche', responses: { 201: { description: 'Tâche créée' } } }
      },
      '/ai/analyse-depenses': { get: { tags: ['IA'], summary: 'Analyse IA des dépenses et suggestions d\'économies', responses: { 200: { description: 'Analyse IA' } } } },
      '/ai/rh-assistant': { post: { tags: ['IA'], summary: 'Assistant RH IA — posez vos questions RH', requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { question: { type: 'string', example: 'Quelle est la durée légale de préavis pour un CDI ?' } } } } } }, responses: { 200: { description: 'Réponse IA' } } } },
      '/ai/dashboard-insights': { get: { tags: ['IA'], summary: 'Insights IA pour le dashboard dirigeant', responses: { 200: { description: '3 insights actionnables' } } } },
      '/abonnement/plans': { get: { tags: ['Abonnement'], summary: 'Voir les plans — Novexa Pro 2 500€/mois', responses: { 200: { description: 'Détails du plan' } }, security: [] } },
      '/abonnement/activer': { post: { tags: ['Abonnement'], summary: 'Activer l\'abonnement Novexa Pro', responses: { 200: { description: 'Abonnement activé' } } } }
    }
  },
  apis: []
};

const specs = swaggerJsdoc(options);

router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(specs, {
  customSiteTitle: 'Novexa API Docs',
  customCss: `
    .swagger-ui .topbar { background: #0a0a0f; }
    .swagger-ui .topbar-wrapper .link img { display: none; }
    .swagger-ui .topbar-wrapper .link::after { content: 'Novexa API by Nexulys'; color: #fff; font-weight: bold; font-size: 18px; }
    body { background: #0a0a0f; }
    .swagger-ui { background: #0a0a0f; color: #e5e7eb; }
  `
}));

module.exports = router;
