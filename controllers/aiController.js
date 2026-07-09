const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Employee = require('../models/Employee');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const Task = require('../models/Task');
const logger = require('../utils/logger');

// Message clair (jamais l'erreur brute du fournisseur) quand l'IA est indisponible
const AI_UNAVAILABLE =
  "🤖 L'assistant IA est momentanément indisponible. Le fournisseur d'IA a refusé la requête " +
  "(clé API restreinte, quota épuisé ou compte suspendu). Vérifiez votre clé API dans les variables " +
  "d'environnement, ou réessayez plus tard.";

// Construit la liste des fournisseurs disponibles, par ordre de priorité (Groq puis OpenAI)
const buildProviders = async () => {
  const { default: OpenAI } = await import('openai');
  const providers = [];
  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: 'Groq',
      client: new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' }),
      model: 'llama-3.1-8b-instant',
      visionModel: 'meta-llama/llama-4-scout-17b-16e-instruct'
    });
  }
  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: 'OpenAI',
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: 'gpt-4o-mini',
      visionModel: 'gpt-4o'
    });
  }
  return providers;
};

// Compat : renvoie le premier fournisseur disponible (utilisé par la vision/OCR)
const getAIClient = async () => {
  const providers = await buildProviders();
  return providers[0] || null;
};

const aiChat = async (systemPrompt, userMessage, maxTokens = 900) => {
  const providers = await buildProviders();
  if (!providers.length) {
    return `[Mode démo — configurez GROQ_API_KEY (gratuit) ou OPENAI_API_KEY pour activer l'IA]\n\nSimulation basée sur: ${userMessage.substring(0, 100)}...`;
  }
  let lastErr;
  for (const p of providers) {
    try {
      const resp = await p.client.chat.completions.create({
        model: p.model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
        max_tokens: maxTokens
      });
      return resp.choices[0].message.content;
    } catch (err) {
      lastErr = err;
      logger.warn(`Fournisseur IA ${p.name} en échec — bascule`, { error: err.message });
    }
  }
  logger.error('Tous les fournisseurs IA ont échoué', { error: lastErr?.message });
  return AI_UNAVAILABLE;
};

const tryParseJSON = (str, fallback) => {
  try {
    const match = str.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : fallback;
  } catch { return fallback; }
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

// ── COMPTABILITÉ IA ────────────────────────────────────────────

exports.detectAnomalies = async (req, res) => {
  try {
    const since = new Date(); since.setMonth(since.getMonth() - 6);
    const [invoices, expenses] = await Promise.all([
      Invoice.find({ company: req.user.company, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(80),
      Expense.find({ company: req.user.company, date: { $gte: since } }).sort({ date: -1 }).limit(80)
    ]);

    // Pre-detect duplicates server-side
    const doublons = [];
    for (let i = 0; i < invoices.length; i++) {
      for (let j = i + 1; j < invoices.length; j++) {
        const jours = Math.abs(new Date(invoices[i].createdAt) - new Date(invoices[j].createdAt)) / 86400000;
        if (jours <= 7 && invoices[i].client === invoices[j].client && Math.abs(invoices[i].montantTTC - invoices[j].montantTTC) < 1) {
          doublons.push(`${invoices[i].numero} et ${invoices[j].numero} (${invoices[i].client}, ${invoices[i].montantTTC}€)`);
        }
      }
    }

    const mFact = invoices.length ? invoices.reduce((s, i) => s + i.montantTTC, 0) / invoices.length : 0;
    const mDep = expenses.length ? expenses.reduce((s, e) => s + e.montant, 0) / expenses.length : 0;

    const contexte = {
      factures: {
        nombre: invoices.length, montantMoyen: Math.round(mFact),
        resume: invoices.slice(0, 15).map(i => ({ n: i.numero, c: i.client, m: i.montantTTC, s: i.statut }))
      },
      depenses: {
        nombre: expenses.length, montantMoyen: Math.round(mDep),
        resume: expenses.slice(0, 15).map(e => ({ t: e.titre, m: e.montant, cat: e.categorie, s: e.statut }))
      },
      doublonsPotentiels: doublons
    };

    const raw = await aiChat(
      'Tu es un expert-comptable et auditeur. Détecte les anomalies, erreurs et irrégularités. Réponds UNIQUEMENT en JSON: {"anomalies":[{"type":"string","severite":"haute"|"moyenne"|"faible","description":"string","recommandation":"string"}],"resume":"string"}',
      `Analyse comptable 6 derniers mois:\n${JSON.stringify(contexte)}`,
      1200
    );

    const parsed = tryParseJSON(raw, { anomalies: doublons.map(d => ({ type: 'doublon', severite: 'haute', description: d, recommandation: 'Vérifier et supprimer le doublon' })), resume: raw });
    res.json({ success: true, data: parsed });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.previsionTresorerie = async (req, res) => {
  try {
    const now = new Date();
    const mois = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      mois.push({ annee: d.getFullYear(), mois: d.getMonth() + 1, label: d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) });
    }

    const historique = await Promise.all(mois.map(async m => {
      const start = new Date(m.annee, m.mois - 1, 1);
      const end = new Date(m.annee, m.mois, 1);
      const [encaissements, charges] = await Promise.all([
        Invoice.aggregate([{ $match: { company: req.user.company, statut: 'payee', createdAt: { $gte: start, $lt: end } } }, { $group: { _id: null, total: { $sum: '$montantTTC' } } }]),
        Expense.aggregate([{ $match: { company: req.user.company, date: { $gte: start, $lt: end } } }, { $group: { _id: null, total: { $sum: '$montant' } } }])
      ]);
      return { mois: m.label, encaissements: encaissements[0]?.total || 0, charges: charges[0]?.total || 0, solde: (encaissements[0]?.total || 0) - (charges[0]?.total || 0) };
    }));

    const raw = await aiChat(
      'Tu es un expert en trésorerie et finance d\'entreprise. Réponds UNIQUEMENT en JSON: {"previsions":[{"mois":"string","encaissements":number,"charges":number,"solde":number,"commentaire":"string"}],"tendance":"string","alerte":"string|null"}',
      `Historique trésorerie 6 mois:\n${JSON.stringify(historique)}\n\nPrévois les 6 prochains mois en extrapolant les tendances.`,
      1200
    );

    const parsed = tryParseJSON(raw, { previsions: [], tendance: raw, alerte: null });
    res.json({ success: true, data: { historique, previsions: parsed.previsions || [], tendance: parsed.tendance, alerte: parsed.alerte } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.analyserFacture = async (req, res) => {
  try {
    const { texte } = req.body;
    if (!texte || texte.trim().length < 10) return res.status(400).json({ success: false, message: 'Texte de facture requis' });

    const raw = await aiChat(
      'Tu es un expert comptable français. Extrais et catégorise les informations d\'une facture. Réponds UNIQUEMENT en JSON: {"fournisseur":"string","date":"string","montantHT":number,"tva":number,"montantTTC":number,"description":"string","categorie":"fournitures"|"transport"|"restauration"|"logiciel"|"marketing"|"loyer"|"salaires"|"autre","compteComptable":"string","anomalies":["string"],"fiabilite":number}',
      `Analyse cette facture et extrait les informations:\n\n${texte}`,
      900
    );

    const parsed = tryParseJSON(raw, { description: raw, categorie: 'autre', anomalies: [], fiabilite: 0 });
    res.json({ success: true, data: parsed });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── RH IA ────────────────────────────────────────────────────

exports.scorerCV = async (req, res) => {
  try {
    const { cvTexte, poste, competencesRequises } = req.body;
    if (!cvTexte || !poste) return res.status(400).json({ success: false, message: 'CV et poste requis' });

    const raw = await aiChat(
      'Tu es un expert RH et chasseur de tête expérimenté. Évalue objectivement le candidat. Réponds UNIQUEMENT en JSON: {"score":number,"niveau":"excellent"|"bon"|"moyen"|"insuffisant","points_forts":["string"],"points_faibles":["string"],"competences":[{"nom":"string","note":number}],"recommandation":"embaucher"|"entretien"|"rejeter","resume":"string","questions_entretien":["string"]}',
      `Poste recherché: ${poste}\nCompétences requises: ${competencesRequises || 'Non spécifiées'}\n\nCV du candidat:\n${cvTexte}`,
      1200
    );

    const parsed = tryParseJSON(raw, { score: 0, niveau: 'moyen', points_forts: [], points_faibles: [], competences: [], recommandation: 'entretien', resume: raw, questions_entretien: [] });
    res.json({ success: true, data: parsed });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.genererOffre = async (req, res) => {
  try {
    const { titre, competences, experience, description, contrat, lieu } = req.body;
    if (!titre) return res.status(400).json({ success: false, message: 'Titre du poste requis' });

    const offre = await aiChat(
      'Tu es un expert RH spécialisé en recrutement et marque employeur. Rédige des offres d\'emploi attractives, claires et optimisées pour attirer les meilleurs profils. Utilise un ton professionnel mais humain. Réponds en texte structuré avec des sections clairement délimitées.',
      `Rédige une offre d'emploi complète et attractive pour:\nPoste: ${titre}\nType de contrat: ${contrat || 'CDI'}\nLieu: ${lieu || 'France'}\nExpérience requise: ${experience || 'À définir'}\nCompétences: ${competences || 'À définir'}\nDescription de l'entreprise: ${description || 'PME française en croissance'}\n\nInclus: accroche, missions, profil recherché, avantages, comment postuler.`,
      1400
    );

    res.json({ success: true, data: { offre, titre, contrat, lieu } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.ocrJustificatif = async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) return res.status(400).json({ success: false, message: 'Image base64 requise' });
    const ai = await getAIClient();
    if (!ai) {
      return res.json({ success: true, data: { titre: 'Achat simulé', montant: 42.50, categorie: 'autre', date: new Date().toISOString().slice(0, 10), fiabilite: 0, note: 'Mode démo — configurez GROQ_API_KEY (gratuit) ou OPENAI_API_KEY' } });
    }
    const resp = await ai.client.chat.completions.create({
      model: ai.visionModel,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Extrais les informations de ce justificatif/ticket de caisse. Réponds UNIQUEMENT en JSON: {"fournisseur":"string","montant":number,"tva":number|null,"montantHT":number|null,"date":"YYYY-MM-DD","description":"string","categorie":"fournitures"|"transport"|"restauration"|"logiciel"|"marketing"|"loyer"|"salaires"|"autre","compteComptable":"string","fiabilite":number}' },
          { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } }
        ]
      }],
      max_tokens: 500
    });
    const raw = resp.choices[0].message.content;
    const parsed = tryParseJSON(raw, { description: raw, categorie: 'autre', fiabilite: 0 });
    res.json({ success: true, data: parsed });
  } catch (err) {
    logger.warn('OCR justificatif — fournisseur IA en échec', { error: err.message });
    res.json({ success: true, data: { titre: '', montant: 0, categorie: 'autre', date: new Date().toISOString().slice(0, 10), fiabilite: 0, note: "Lecture automatique indisponible (fournisseur d'IA restreint). Saisissez les informations manuellement." } });
  }
};

exports.resumerEntretien = async (req, res) => {
  try {
    const { notes, candidat, poste } = req.body;
    if (!notes) return res.status(400).json({ success: false, message: 'Notes d\'entretien requises' });

    const raw = await aiChat(
      'Tu es un expert RH. Analyse les notes d\'entretien et produis un résumé structuré. Réponds UNIQUEMENT en JSON: {"profil":"string","points_forts":["string"],"points_faibles":["string"],"competences_techniques":[{"nom":"string","note":number}],"competences_comportementales":[{"nom":"string","note":number}],"motivation":number,"recommandation":"embaucher"|"deuxieme_entretien"|"rejeter","justification":"string","prochaines_etapes":["string"]}',
      `Candidat: ${candidat || 'Non précisé'}\nPoste: ${poste || 'Non précisé'}\n\nNotes d'entretien:\n${notes}`,
      1200
    );

    const parsed = tryParseJSON(raw, {
      profil: raw, points_forts: [], points_faibles: [],
      competences_techniques: [], competences_comportementales: [],
      motivation: 3, recommandation: 'deuxieme_entretien', justification: '', prochaines_etapes: []
    });
    res.json({ success: true, data: parsed });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
