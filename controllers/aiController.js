const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Employee = require('../models/Employee');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const Task = require('../models/Task');

const aiChat = async (systemPrompt, userMessage) => {
  if (!process.env.OPENAI_API_KEY) {
    return `[Mode démo - configurez OPENAI_API_KEY pour activer l'IA]\n\nAnalyse simulée basée sur: ${userMessage.substring(0, 100)}...`;
  }
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
    max_tokens: 800
  });
  return resp.choices[0].message.content;
};

exports.analyzeExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ company: req.user.company }).sort({ date: -1 }).limit(50);
    const parCategorie = expenses.reduce((acc, e) => {
      acc[e.categorie] = (acc[e.categorie] || 0) + e.montant;
      return acc;
    }, {});
    const totalMontant = expenses.reduce((s, e) => s + e.montant, 0);
    const prompt = `Analyse ces dépenses d'entreprise et suggère des économies concrètes:\nPar catégorie: ${JSON.stringify(parCategorie)}\nTotal: ${totalMontant}€`;
    const analyse = await aiChat('Tu es un expert comptable et conseiller financier pour PME françaises.', prompt);
    res.json({ success: true, data: { analyse, parCategorie, totalMontant } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.hrAssistant = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ success: false, message: 'Question requise' });
    const nbEmployes = await Employee.countDocuments({ company: req.user.company });
    const reponse = await aiChat(
      `Tu es un expert RH et droit du travail français. L'entreprise a ${nbEmployes} employés. Réponds de façon concise et pratique en français.`,
      question
    );
    res.json({ success: true, data: { question, reponse } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.predictReorder = async (req, res) => {
  try {
    const produits = await Product.find({ company: req.user.company, actif: true });
    const mouvements = await StockMovement.find({ company: req.user.company, type: 'sortie' })
      .sort({ createdAt: -1 }).limit(200);

    const consommation = {};
    mouvements.forEach(m => {
      const k = m.product.toString();
      consommation[k] = (consommation[k] || 0) + m.quantite;
    });

    const aReapprovisionner = produits
      .filter(p => p.quantite <= p.seuilAlerte * 2)
      .map(p => ({
        nom: p.nom, sku: p.sku, quantiteActuelle: p.quantite,
        seuilAlerte: p.seuilAlerte, consommationMensuelle: consommation[p._id.toString()] || 0
      }));

    if (!aReapprovisionner.length)
      return res.json({ success: true, data: { predictions: [], message: 'Tous les stocks sont à niveau suffisant' } });

    const predictions = await aiChat(
      'Tu es un expert en gestion des stocks et supply chain pour PME.',
      `Préds les besoins de réapprovisionnement pour 30 jours:\n${JSON.stringify(aReapprovisionner, null, 2)}`
    );
    res.json({ success: true, data: { predictions, produitsAnalyses: aReapprovisionner } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.autoAssignTask = async (req, res) => {
  try {
    const { taskId } = req.body;
    const [tache, employes] = await Promise.all([
      Task.findOne({ _id: taskId, company: req.user.company }),
      Employee.find({ company: req.user.company, statut: 'actif' })
    ]);
    if (!tache) return res.status(404).json({ success: false, message: 'Tâche introuvable' });

    const chargesTravail = await Task.aggregate([
      { $match: { company: req.user.company, statut: { $in: ['todo', 'en_cours'] } } },
      { $group: { _id: '$assignee', nombre: { $sum: 1 } } }
    ]);

    const equipe = employes.map(e => ({
      nom: `${e.prenom} ${e.nom}`, poste: e.poste,
      tachesActives: (chargesTravail.find(c => c._id?.toString() === e._id.toString()) || {}).nombre || 0
    }));

    const suggestion = await aiChat(
      'Tu es un manager expert en allocation de ressources.',
      `Tâche: "${tache.titre}" (priorité: ${tache.priorite})\nÉquipe:\n${JSON.stringify(equipe, null, 2)}\nQui assigner et pourquoi?`
    );
    res.json({ success: true, data: { tache: tache.titre, suggestion, equipe } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.dashboardInsights = async (req, res) => {
  try {
    const [facturesEnAttente, totalDepenses, nbEmployes, alertesStock, tachesEnRetard] = await Promise.all([
      Invoice.countDocuments({ company: req.user.company, statut: 'envoyee' }),
      Expense.aggregate([{ $match: { company: req.user.company } }, { $group: { _id: null, total: { $sum: '$montant' } } }]),
      Employee.countDocuments({ company: req.user.company, statut: 'actif' }),
      Product.countDocuments({ company: req.user.company, actif: true, alerteActive: true }),
      Task.countDocuments({ company: req.user.company, statut: { $nin: ['termine', 'annule'] }, deadline: { $lt: new Date() } })
    ]);

    const metriques = {
      facturesEnAttente,
      totalDepenses: totalDepenses[0]?.total || 0,
      nbEmployes,
      alertesStock,
      tachesEnRetard
    };

    const insights = await aiChat(
      'Tu es un assistant de direction (COO) expert PME. Fournis 3 insights actionnables et prioritaires en français.',
      `Métriques entreprise: Factures en attente: ${metriques.facturesEnAttente}, Dépenses totales: ${metriques.totalDepenses}€, Employés actifs: ${metriques.nbEmployes}, Alertes stock bas: ${metriques.alertesStock}, Tâches en retard: ${metriques.tachesEnRetard}`
    );
    res.json({ success: true, data: { insights, metriques } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
