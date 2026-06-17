const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  projet: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  titre: { type: String, required: true, trim: true },
  description: { type: String },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  priorite: {
    type: String,
    enum: ['basse', 'normale', 'haute', 'urgente'],
    default: 'normale'
  },
  statut: {
    type: String,
    enum: ['todo', 'en_cours', 'en_revue', 'termine', 'annule'],
    default: 'todo'
  },
  deadline: { type: Date },
  tags: [{ type: String }],
  estimationHeures: { type: Number },
  heuresReelles: { type: Number }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
