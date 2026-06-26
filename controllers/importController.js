const multer = require('multer');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Employee = require('../models/Employee');
const logger = require('../utils/logger');

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) cb(null, true);
  else cb(new Error('Seuls les fichiers CSV sont acceptés'));
}});

const CSV_MAX_ROWS = 5000;

const parseCSV = (buffer) => {
  const lines = buffer.toString('utf-8').split('\n').filter(l => l.trim());
  if (lines.length < 2) throw new Error('Le fichier CSV est vide ou ne contient que l\'en-tête');
  if (lines.length - 1 > CSV_MAX_ROWS) throw new Error(`Le fichier CSV dépasse la limite de ${CSV_MAX_ROWS} lignes.`);
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  }).filter(row => Object.values(row).some(v => v));
};

exports.uploadMiddleware = upload.single('file');

exports.importClients = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
    const rows = parseCSV(req.file.buffer);
    // Les clients sont stockés dans les factures/devis — ici on crée des prospects CRM
    const Prospect = require('../models/Prospect');
    const results = { success: 0, errors: [] };
    for (const row of rows) {
      try {
        if (!row.nom) { results.errors.push({ row, error: 'Nom obligatoire' }); continue; }
        await Prospect.create({
          company: req.user.company,
          nom: row.nom,
          email: row.email || '',
          telephone: row.telephone || '',
          entreprise: row.entreprise || row.societe || '',
          statut: 'contact',
          createdBy: req.user.id
        });
        results.success++;
      } catch (err) { results.errors.push({ row, error: err.message }); }
    }
    res.json({ success: true, message: `${results.success} clients importés, ${results.errors.length} erreurs`, data: results });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.importProduits = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
    const rows = parseCSV(req.file.buffer);
    const results = { success: 0, errors: [] };
    for (const row of rows) {
      try {
        if (!row.nom) { results.errors.push({ row, error: 'Nom obligatoire' }); continue; }
        await Product.create({
          company: req.user.company,
          nom: row.nom,
          sku: row.reference || row.sku || '',
          categorie: row.categorie || 'autre',
          prixVente: parseFloat(row.prixunitaire || row.prix || 0),
          quantite: parseInt(row.quantite || 0),
          seuilAlerte: parseInt(row.seuillalerte || row.seuil || 5),
          unite: row.unite || 'unité',
          actif: true
        });
        results.success++;
      } catch (err) { results.errors.push({ row, error: err.message }); }
    }
    res.json({ success: true, message: `${results.success} produits importés, ${results.errors.length} erreurs`, data: results });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.importEmployes = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier fourni' });
    const rows = parseCSV(req.file.buffer);
    const results = { success: 0, errors: [] };
    for (const row of rows) {
      try {
        if (!row.nom || !row.prenom) { results.errors.push({ row, error: 'Nom et prénom obligatoires' }); continue; }
        await Employee.create({
          company: req.user.company,
          nom: row.nom,
          prenom: row.prenom,
          email: row.email || '',
          poste: row.poste || '',
          departement: row.departement || '',
          salaireBase: parseFloat(row.salairebase || row.salaire || 0),
          dateEmbauche: row.dateembauche ? new Date(row.dateembauche) : new Date(),
          statut: 'actif'
        });
        results.success++;
      } catch (err) { results.errors.push({ row, error: err.message }); }
    }
    res.json({ success: true, message: `${results.success} employés importés, ${results.errors.length} erreurs`, data: results });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Export CSV générique
exports.exportCSV = async (req, res) => {
  try {
    const { type } = req.params;
    let data = [], headers = [];

    if (type === 'clients') {
      const Prospect = require('../models/Prospect');
      data = await Prospect.find({ company: req.user.company });
      headers = ['nom','email','telephone','entreprise','statut','valeurEstimee'];
    } else if (type === 'produits') {
      data = await Product.find({ company: req.user.company, actif: true });
      headers = ['nom','sku','categorie','prixVente','quantite','seuilAlerte','unite'];
    } else if (type === 'employes') {
      data = await Employee.find({ company: req.user.company });
      headers = ['nom','prenom','email','poste','departement','salaireBase','statut'];
    } else {
      return res.status(400).json({ success: false, message: 'Type non supporté' });
    }

    const csvHeader = headers.join(',');
    const csvRows = data.map(item => headers.map(h => `"${(item[h] || '').toString().replace(/"/g, '""')}"`).join(','));
    const csv = [csvHeader, ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="export_${type}_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('﻿' + csv); // BOM pour Excel
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
