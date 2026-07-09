// Tests d'intégration : démarrent une base MongoDB en mémoire (mongodb-memory-server)
// et exercent les vraies routes Express. Nécessitent un accès réseau au premier lancement
// (téléchargement du binaire MongoDB) — donc plutôt en CI/local qu'en sandbox restreint.
module.exports = {
  testEnvironment: 'node',
  testTimeout: 60000,
  testMatch: ['**/tests/integration/**/*.test.js'],
  clearMocks: true,
  verbose: true
};
