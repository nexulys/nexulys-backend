const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  nom: { type: String, required: true, trim: true },
  prenom: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  // select: false — sans cela le hash bcrypt est renvoyé par toute lecture non projetée
  // (GET /api/auth/me, PUT /api/auth/me…), exposant les mots de passe au cassage hors ligne.
  password: { type: String, required: true, minlength: 6, select: false },
  role: {
    type: String,
    enum: ['admin', 'comptable', 'rh', 'manager', 'employee', 'employe', 'lecture'],
    default: 'employee'
  },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  actif: { type: Boolean, default: true },
  // Incrémenté à chaque changement de mot de passe : invalide les JWT déjà émis,
  // qui sinon restent valables 7 jours après un vol de compte.
  tokenVersion: { type: Number, default: 0 },
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.tokenVersion = (this.tokenVersion || 0) + 1;
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
