require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Company = require('../models/Company');
const Subscription = require('../models/Subscription');
const Employee = require('../models/Employee');
const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Task = require('../models/Task');
const Project = require('../models/Project');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/novexa');
  console.log('🌱 Connexion MongoDB OK');

  // Clear
  await Promise.all([User, Company, Subscription, Employee, Invoice, Expense, Product, Supplier, Task, Project].map(M => M.deleteMany({})));
  console.log('🗑️  Base nettoyée');

  // Company
  const company = await Company.create({ nom: 'TechCorp Paris', siret: '12345678900012', ville: 'Paris', secteur: 'Technologie' });

  // Subscription
  const sub = await Subscription.create({ company: company._id, statut: 'actif' });
  company.subscription = sub._id;

  // Admin user
  const password = await bcrypt.hash('novexa2025', 10);
  const admin = await User.create({ nom: 'Martin', prenom: 'Sophie', email: 'admin@techcorp.fr', password, role: 'admin', company: company._id });
  company.owner = admin._id;
  await company.save();

  // More users
  await User.create([
    { nom: 'Dubois', prenom: 'Marc', email: 'comptable@techcorp.fr', password, role: 'comptable', company: company._id },
    { nom: 'Bernard', prenom: 'Claire', email: 'rh@techcorp.fr', password, role: 'rh', company: company._id }
  ]);

  // Employees
  const employees = await Employee.create([
    { company: company._id, nom: 'Lefebvre', prenom: 'Alice', email: 'alice@techcorp.fr', poste: 'Développeuse Senior', departement: 'Tech', salaireBase: 4500, dateEmbauche: new Date('2022-03-15'), statut: 'actif' },
    { company: company._id, nom: 'Moreau', prenom: 'Thomas', email: 'thomas@techcorp.fr', poste: 'Designer UX', departement: 'Produit', salaireBase: 3800, dateEmbauche: new Date('2023-01-10'), statut: 'actif' },
    { company: company._id, nom: 'Petit', prenom: 'Emma', email: 'emma@techcorp.fr', poste: 'Chef de Projet', departement: 'Produit', salaireBase: 4200, dateEmbauche: new Date('2021-09-01'), statut: 'actif' },
    { company: company._id, nom: 'Robert', prenom: 'Lucas', email: 'lucas@techcorp.fr', poste: 'Commercial', departement: 'Ventes', salaireBase: 3200, dateEmbauche: new Date('2023-06-20'), statut: 'conge' }
  ]);

  // Invoices
  await Invoice.create([
    { company: company._id, numero: 'FAC-2025-001', client: { nom: 'Acme Corp', email: 'contact@acme.fr' }, lignes: [{ description: 'Développement web', quantite: 10, prixUnitaire: 800, montantHT: 8000 }], montantHT: 8000, tauxTVA: 20, montantTVA: 1600, montantTTC: 9600, statut: 'payee', createdBy: admin._id },
    { company: company._id, numero: 'FAC-2025-002', client: { nom: 'StartupXYZ', email: 'cto@startup.fr' }, lignes: [{ description: 'Consulting IA', quantite: 5, prixUnitaire: 1200, montantHT: 6000 }], montantHT: 6000, tauxTVA: 20, montantTVA: 1200, montantTTC: 7200, statut: 'envoyee', dateEcheance: new Date(Date.now() + 7*86400000), createdBy: admin._id },
    { company: company._id, numero: 'FAC-2025-003', client: { nom: 'Global Finance', email: 'daf@global.fr' }, lignes: [{ description: 'Audit système', quantite: 3, prixUnitaire: 2000, montantHT: 6000 }], montantHT: 6000, tauxTVA: 20, montantTVA: 1200, montantTTC: 7200, statut: 'en_retard', dateEcheance: new Date(Date.now() - 15*86400000), createdBy: admin._id }
  ]);

  // Expenses
  await Expense.create([
    { company: company._id, titre: 'Loyer bureaux Paris', montant: 3500, categorie: 'loyer', date: new Date(), statut: 'approuvee', createdBy: admin._id },
    { company: company._id, titre: 'Abonnements logiciels', montant: 850, categorie: 'logiciel', date: new Date(), statut: 'approuvee', createdBy: admin._id },
    { company: company._id, titre: 'Déjeuner client', montant: 120, categorie: 'restauration', date: new Date(), statut: 'en_attente', createdBy: admin._id }
  ]);

  // Suppliers
  const supplier = await Supplier.create({ company: company._id, nom: 'TechSupply Pro', email: 'commandes@techsupply.fr', telephone: '01 23 45 67 89', delaiLivraison: 5 });

  // Products
  await Product.create([
    { company: company._id, nom: 'MacBook Pro M3', sku: 'MAC-M3-001', quantite: 8, seuilAlerte: 3, prixAchat: 1800, prixVente: 2200, categorie: 'Informatique', fournisseur: supplier._id },
    { company: company._id, nom: 'Moniteur 4K 27"', sku: 'MON-4K-027', quantite: 2, seuilAlerte: 5, prixAchat: 450, prixVente: 599, categorie: 'Périphériques', fournisseur: supplier._id },
    { company: company._id, nom: 'Clavier mécanique', sku: 'KEY-MEC-001', quantite: 15, seuilAlerte: 4, prixAchat: 80, prixVente: 129, categorie: 'Périphériques', fournisseur: supplier._id },
    { company: company._id, nom: 'Câble USB-C', sku: 'CBL-USBC-1M', quantite: 0, seuilAlerte: 10, prixAchat: 8, prixVente: 15, categorie: 'Accessoires', fournisseur: supplier._id }
  ]);

  // Project
  const project = await Project.create({ company: company._id, nom: 'Refonte Site Web', description: 'Refonte complète du site corporate', statut: 'en_cours', createdBy: admin._id });

  // Tasks
  await Task.create([
    { company: company._id, titre: 'Maquettes UI/UX', description: 'Créer les maquettes Figma', priorite: 'haute', statut: 'termine', projet: project._id, assignee: admin._id, createdBy: admin._id },
    { company: company._id, titre: 'Développement frontend', priorite: 'urgente', statut: 'en_cours', projet: project._id, assignee: admin._id, deadline: new Date(Date.now() + 14*86400000), createdBy: admin._id },
    { company: company._id, titre: 'Intégration API', priorite: 'haute', statut: 'todo', projet: project._id, createdBy: admin._id, deadline: new Date(Date.now() + 21*86400000) },
    { company: company._id, titre: 'Tests utilisateurs', priorite: 'normale', statut: 'todo', projet: project._id, createdBy: admin._id, deadline: new Date(Date.now() + 30*86400000) }
  ]);

  console.log('✅ Seed terminé !');
  console.log('');
  console.log('📧 Compte admin: admin@techcorp.fr');
  console.log('🔑 Mot de passe: novexa2025');
  console.log('');
  await mongoose.disconnect();
}

seed().catch(err => { console.error('❌ Erreur seed:', err); process.exit(1); });
