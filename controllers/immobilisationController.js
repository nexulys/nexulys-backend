const Immobilisation = require('../models/Immobilisation');

function computeAmortissement(immo) {
  const { valeurAcquisition, valeurResiduelle, dureeAmortissement, dateAcquisition } = immo;
  const annuite = (valeurAcquisition - valeurResiduelle) / dureeAmortissement;
  const now = new Date();
  const acqDate = new Date(dateAcquisition);
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  const anneesEcoulees = Math.max(0, (now - acqDate) / msPerYear);
  const vnc = Math.max(valeurResiduelle, valeurAcquisition - (anneesEcoulees * annuite));
  const tauxAmorti = valeurAcquisition > 0
    ? Math.round(((valeurAcquisition - vnc) / valeurAcquisition) * 10000) / 100
    : 0;
  return {
    annuiteAmortissement: Math.round(annuite * 100) / 100,
    valeurNetteComptable: Math.round(vnc * 100) / 100,
    tauxAmorti
  };
}

exports.getImmobilisations = async (req, res) => {
  try {
    const { statut } = req.query;
    const filter = { company: req.user.company };
    if (statut) filter.statut = statut;
    const immos = await Immobilisation.find(filter).sort({ dateAcquisition: -1 });
    const data = immos.map(immo => ({
      ...immo.toObject(),
      ...computeAmortissement(immo)
    }));
    res.json({ success: true, data, count: data.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createImmobilisation = async (req, res) => {
  try {
    const immo = await Immobilisation.create({
      ...req.body,
      company: req.user.company,
      createdBy: req.user.id
    });
    res.status(201).json({ success: true, data: { ...immo.toObject(), ...computeAmortissement(immo) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateImmobilisation = async (req, res) => {
  try {
    const immo = await Immobilisation.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      req.body,
      { new: true }
    );
    if (!immo) return res.status(404).json({ success: false, message: 'Immobilisation introuvable' });
    res.json({ success: true, data: { ...immo.toObject(), ...computeAmortissement(immo) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteImmobilisation = async (req, res) => {
  try {
    // Soft delete: set statut = 'rebute'
    const immo = await Immobilisation.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      { statut: 'rebute' },
      { new: true }
    );
    if (!immo) return res.status(404).json({ success: false, message: 'Immobilisation introuvable' });
    res.json({ success: true, message: 'Immobilisation mise au rebut' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getAmortissements = async (req, res) => {
  try {
    const immo = await Immobilisation.findOne({ _id: req.params.id, company: req.user.company });
    if (!immo) return res.status(404).json({ success: false, message: 'Immobilisation introuvable' });

    const { valeurAcquisition, valeurResiduelle, dureeAmortissement, dateAcquisition } = immo;
    const annuite = (valeurAcquisition - valeurResiduelle) / dureeAmortissement;
    const acqYear = new Date(dateAcquisition).getFullYear();

    const tableau = [];
    let vncDebut = valeurAcquisition;
    for (let i = 0; i < dureeAmortissement; i++) {
      const annee = acqYear + i;
      const amortissement = Math.min(annuite, Math.max(0, vncDebut - valeurResiduelle));
      const vncFin = Math.max(valeurResiduelle, vncDebut - amortissement);
      tableau.push({
        annee,
        vncDebut: Math.round(vncDebut * 100) / 100,
        amortissement: Math.round(amortissement * 100) / 100,
        vncFin: Math.round(vncFin * 100) / 100,
        cumul: Math.round((valeurAcquisition - vncFin) * 100) / 100
      });
      vncDebut = vncFin;
    }

    res.json({ success: true, data: { immobilisation: immo, tableau } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
