const Agenda = require('../models/Agenda');
const { sendError } = require('../utils/errorResponse');

exports.getEvenements = async (req, res) => {
  try {
    const { debut, fin } = req.query;
    const filter = { company: req.user.company };
    if (debut || fin) {
      filter.dateDebut = {};
      if (debut) filter.dateDebut.$gte = new Date(debut);
      if (fin) filter.dateDebut.$lte = new Date(fin);
    }
    const evenements = await Agenda.find(filter).sort({ dateDebut: 1 });
    res.json({ success: true, data: evenements, count: evenements.length });
  } catch (err) { sendError(res, err); }
};

exports.createEvenement = async (req, res) => {
  try {
    const evenement = await Agenda.create({
      ...req.body,
      company: req.user.company,
      createdBy: req.user.id
    });
    res.status(201).json({ success: true, data: evenement });
  } catch (err) { sendError(res, err); }
};

exports.updateEvenement = async (req, res) => {
  try {
    const evenement = await Agenda.findOneAndUpdate(
      { _id: req.params.id, company: req.user.company },
      req.body,
      { new: true }
    );
    if (!evenement) return res.status(404).json({ success: false, message: 'Événement introuvable' });
    res.json({ success: true, data: evenement });
  } catch (err) { sendError(res, err); }
};

exports.deleteEvenement = async (req, res) => {
  try {
    const evenement = await Agenda.findOneAndDelete({ _id: req.params.id, company: req.user.company });
    if (!evenement) return res.status(404).json({ success: false, message: 'Événement introuvable' });
    res.json({ success: true, message: 'Événement supprimé' });
  } catch (err) { sendError(res, err); }
};

exports.getEcheancesFiscales = async (req, res) => {
  try {
    const annee = new Date().getFullYear();

    const echeances = [];

    // TVA mensuelle — 15 de chaque mois
    const moisLabels = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    for (let m = 0; m < 12; m++) {
      echeances.push({
        titre: `Déclaration TVA — ${moisLabels[m]}`,
        type: 'fiscal',
        date: new Date(annee, m, 15),
        description: `Dépôt de la déclaration CA3 pour ${moisLabels[m]} ${annee}`,
        couleur: '#f59e0b'
      });
    }

    // IS acomptes : 15 mars, 15 juin, 15 sept, 15 déc
    const acomptesIS = [
      { mois: 2, label: '1er acompte IS' },
      { mois: 5, label: '2e acompte IS' },
      { mois: 8, label: '3e acompte IS' },
      { mois: 11, label: '4e acompte IS' }
    ];
    acomptesIS.forEach(({ mois, label }) => {
      echeances.push({
        titre: `${label} — ${annee}`,
        type: 'fiscal',
        date: new Date(annee, mois, 15),
        description: `Versement d'acompte sur l'Impôt sur les Sociétés`,
        couleur: '#ef4444'
      });
    });

    // DSN — 15 de chaque mois
    for (let m = 0; m < 12; m++) {
      echeances.push({
        titre: `DSN — ${moisLabels[m]}`,
        type: 'fiscal',
        date: new Date(annee, m, 15),
        description: `Déclaration Sociale Nominative pour ${moisLabels[m]} ${annee}`,
        couleur: '#8b5cf6'
      });
    }

    // Liasse fiscale IS — 15 mai (N+1)
    echeances.push({
      titre: `Liasse fiscale IS ${annee - 1}`,
      type: 'fiscal',
      date: new Date(annee, 4, 15),
      description: `Dépôt de la liasse fiscale pour l'exercice ${annee - 1}`,
      couleur: '#ef4444'
    });

    // CVAE — 15 juin et 15 sept
    echeances.push(
      {
        titre: `CVAE — 1er acompte ${annee}`,
        type: 'fiscal',
        date: new Date(annee, 5, 15),
        description: 'Versement 1er acompte CVAE',
        couleur: '#f97316'
      },
      {
        titre: `CVAE — 2e acompte ${annee}`,
        type: 'fiscal',
        date: new Date(annee, 8, 15),
        description: 'Versement 2e acompte CVAE',
        couleur: '#f97316'
      }
    );

    echeances.sort((a, b) => a.date - b.date);

    res.json({ success: true, data: echeances, count: echeances.length, annee });
  } catch (err) { sendError(res, err); }
};
