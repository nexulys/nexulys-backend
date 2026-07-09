// Configuration par défaut : tests unitaires (logique métier pure, sans base de données).
// Rapides et exécutables partout, y compris en CI sans accès réseau.
module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  testMatch: ['**/tests/unit/**/*.test.js'],
  clearMocks: true,
  verbose: true
};
