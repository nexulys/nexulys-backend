const BonCommande = require('../models/BonCommande');

function calcMontants(lignes) {
  const montantHT = lignes.reduce((sum, l) => sum + (l.montantHT || l.quantite * l.prixUnitaire), 0);
  const montantTVA = lignes.reduce((sum, l) => {
    const ht = l.montantHT || l.quantite * l.prixUnitaire;
    return sum + (ht * (l.tva || 20) / 100);
  }, 0);
  return { montantHT, montantTVA, montantTTC: montantHT + montantTVA };
}

exports.getBonsCommande = async (req, res) => {
  try {
    const { statut } = req.query;
    const filter = { company: req.user.company };
    if (statut) filter.statut = statut;
    const bons = await BonCommande.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: bons, count: bons.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createBonCommande = async (req, res) => {
  try {
    const { fournisseur, lignes, statut, dateCommande, dateLivraisonPrevue, notes } = req.body;

    const year = new Date().getFullYear();
    const count = await BonCommande.countDocuments({ company: req.user.company });
    const numero = `BC-${year}-${String(count + 1).padStart(4, '0')}`;

    const { montantHT, montantTVA, montantTTC } = calcMontants(lignes);

    const bon = await BonCommande.create({
      company: req.user.company,
      numero,
      fournisseur,
      lignes,
      montantHT,
      montantTVA,
      montantTTC,
      statut: statut || 'brouillon',
      dateCommande: dateCommande || Date.now(),
      dateLivraisonPrevue,
      notes,
      createdBy: req.user.id
    });
    res.status(201).json({ success: true, data: bon });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateBonCommande = async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.lignes) {
      const { montantHT, montantTVA, montantTTC } = calcMontants(update.lignes);
      update.montantHT = montantHT;
      update.montantTVA = montantTVA;
      update.montantTTC = montantTTC;
    }
    const bon = await BonCommande.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      update,
      { new: true }
    );
    if (!bon) return res.status(404).json({ success: false, message: 'Bon de commande introuvable' });
    res.json({ success: true, data: bon });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteBonCommande = async (req, res) => {
  try {
    const bon = await BonCommande.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    if (!bon) return res.status(404).json({ success: false, message: 'Bon de commande introuvable' });
    res.json({ success: true, message: 'Bon de commande supprimé' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.recevoirCommande = async (req, res) => {
  try {
    const bon = await BonCommande.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      { statut: 'recu', dateReception: new Date() },
      { new: true }
    );
    if (!bon) return res.status(404).json({ success: false, message: 'Bon de commande introuvable' });
    res.json({ success: true, data: bon, message: 'Commande marquée comme reçue' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
