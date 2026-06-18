const mongoose = require('mongoose');

const immobilisationSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  nom: { type: String, required: true, trim: true },
  categorie: {
    type: String,
    enum: ['materiel', 'vehicule', 'logiciel', 'mobilier', 'immeuble', 'autre'],
    required: true
  },
  fournisseur: { type: String },
  dateAcquisition: { type: Date, required: true },
  valeurAcquisition: { type: Number, required: true, min: 0 },
  dureeAmortissement: { type: Number, required: true, min: 1 },
  methode: {
    type: String,
    enum: ['lineaire', 'degressif'],
    default: 'lineaire'
  },
  valeurResiduelle: { type: Number, default: 0, min: 0 },
  statut: {
    type: String,
    enum: ['actif', 'cede', 'rebute'],
    default: 'actif'
  },
  dateCession: { type: Date },
  valeurCession: { type: Number },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Immobilisation', immobilisationSchema);
