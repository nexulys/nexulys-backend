const Avoir = require('../models/Avoir');

exports.getAvoirs = async (req, res) => {
  try {
    const { statut } = req.query;
    const filter = { company: req.user.company };
    if (statut) filter.statut = statut;
    const avoirs = await Avoir.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: avoirs, count: avoirs.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createAvoir = async (req, res) => {
  try {
    const { factureId, factureNumero, client, motif, lignes, statut } = req.body;

    // Auto-compute montants
    const montantHT = lignes.reduce((sum, l) => sum + (l.montantHT || l.quantite * l.prixUnitaire), 0);
    const montantTVA = lignes.reduce((sum, l) => {
      const ht = l.montantHT || l.quantite * l.prixUnitaire;
      return sum + (ht * (l.tva || 20) / 100);
    }, 0);
    const montantTTC = montantHT + montantTVA;

    // Auto-numero AV-YYYY-NNNN
    const year = new Date().getFullYear();
    const count = await Avoir.countDocuments({ company: req.user.company });
    const numero = `AV-${year}-${String(count + 1).padStart(4, '0')}`;

    const avoir = await Avoir.create({
      company: req.user.company,
      numero,
      factureId,
      factureNumero,
      client,
      motif,
      lignes,
      montantHT,
      montantTVA,
      montantTTC,
      statut: statut || 'brouillon',
      createdBy: req.user.id
    });
    res.status(201).json({ success: true, data: avoir });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateAvoir = async (req, res) => {
  try {
    const update = { ...req.body };
    // Recompute montants if lignes changed
    if (update.lignes) {
      update.montantHT = update.lignes.reduce((sum, l) => sum + (l.montantHT || l.quantite * l.prixUnitaire), 0);
      update.montantTVA = update.lignes.reduce((sum, l) => {
        const ht = l.montantHT || l.quantite * l.prixUnitaire;
        return sum + (ht * (l.tva || 20) / 100);
      }, 0);
      update.montantTTC = update.montantHT + update.montantTVA;
    }
    const avoir = await Avoir.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      update,
      { new: true }
    );
    if (!avoir) return res.status(404).json({ success: false, message: 'Avoir introuvable' });
    res.json({ success: true, data: avoir });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteAvoir = async (req, res) => {
  try {
    const avoir = await Avoir.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    if (!avoir) return res.status(404).json({ success: false, message: 'Avoir introuvable' });
    res.json({ success: true, message: 'Avoir supprimé' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
