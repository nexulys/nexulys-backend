const mongoose = require('mongoose');
const { Schema } = mongoose;

const timeEntrySchema = new Schema({
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  projet: { type: Schema.Types.ObjectId, ref: 'Projet', required: true },
  employeNom: { type: String },
  date: { type: Date, default: Date.now },
  heures: { type: Number, required: true, min: 0 },
  description: { type: String },
  facturable: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('TimeEntry', timeEntrySchema);
