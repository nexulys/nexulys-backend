#!/usr/bin/env node
const required = ['MONGODB_URI', 'JWT_SECRET'];
const optional = {
  'OPENAI_API_KEY': '🤖 IA désactivée (mode démo)',
  'SMTP_HOST': '📧 Emails désactivés',
  'STRIPE_SECRET_KEY': '💳 Paiements Stripe désactivés',
  'SENTRY_DSN': '🔍 Monitoring Sentry désactivé'
};

let hasErrors = false;
console.log('\n🔍 Vérification de la configuration Novexa...\n');

required.forEach(key => {
  if (!process.env[key]) {
    console.error(`  ❌ MANQUANT (requis): ${key}`);
    hasErrors = true;
  } else {
    console.log(`  ✅ ${key}`);
  }
});

Object.entries(optional).forEach(([key, warning]) => {
  if (!process.env[key]) {
    console.warn(`  ⚠️  ${key} non configuré — ${warning}`);
  } else {
    console.log(`  ✅ ${key}`);
  }
});

console.log('');
if (hasErrors) {
  console.error('❌ Configuration incomplète. Vérifiez votre fichier .env\n');
  process.exit(1);
} else {
  console.log('✅ Configuration OK — Novexa est prêt à démarrer\n');
}
