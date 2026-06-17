const OpenAI = require('openai');
const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Employee = require('../models/Employee');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const Task = require('../models/Task');

const getOpenAI = () => {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY non configurée');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

const chat = async (systemPrompt, userMessage) => {
  const openai = getOpenAI();
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
    max_tokens: 800
  });
  return res.choices[0].message.content;
};

exports.analyzeExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ company: req.user.company }).sort({ date: -1 }).limit(50);
    const summary = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {});
    const prompt = `Tu es un conseiller financier expert. Analyse ces dépenses d'entreprise et suggère des économies concrètes:\n${JSON.stringify(summary, null, 2)}\nTotal: ${expenses.reduce((s, e) => s + e.amount, 0)}€`;
    const analysis = await chat('Tu es un expert comptable et conseiller financier pour PME.', prompt);
    res.json({ success: true, data: { analysis, expensesByCategory: summary } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.hrAssistant = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ success: false, message: 'Question requise' });
    const employeeCount = await Employee.countDocuments({ company: req.user.company });
    const systemPrompt = `Tu es un expert RH et droit du travail français. L'entreprise a ${employeeCount} employés. Réponds en français de façon concise et pratique.`;
    const answer = await chat(systemPrompt, question);
    res.json({ success: true, data: { question, answer } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.predictReorder = async (req, res) => {
  try {
    const products = await Product.find({ company: req.user.company });
    const movements = await StockMovement.find({ company: req.user.company, type: 'sortie' })
      .sort({ createdAt: -1 }).limit(200);

    const consumption = {};
    movements.forEach(m => {
      const key = m.product.toString();
      consumption[key] = (consumption[key] || 0) + m.quantity;
    });

    const lowProducts = products.filter(p => p.quantity <= p.alertThreshold * 2);
    const data = lowProducts.map(p => ({
      name: p.name, sku: p.sku, currentStock: p.quantity,
      threshold: p.alertThreshold, monthlyConsumption: consumption[p._id.toString()] || 0
    }));

    if (data.length === 0) return res.json({ success: true, data: { predictions: [], message: 'Tous les stocks sont suffisants' } });

    const prompt = `Analyse ces données de stock et prédit les besoins de réapprovisionnement pour les 30 prochains jours:\n${JSON.stringify(data, null, 2)}`;
    const predictions = await chat('Tu es un expert en gestion des stocks et supply chain.', prompt);
    res.json({ success: true, data: { predictions, productsAnalyzed: data } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.autoAssignTasks = async (req, res) => {
  try {
    const { taskId } = req.body;
    const [task, employees] = await Promise.all([
      Task.findOne({ _id: taskId, company: req.user.company }),
      Employee.find({ company: req.user.company })
    ]);
    if (!task) return res.status(404).json({ success: false, message: 'Tâche introuvable' });

    const taskCounts = await Task.aggregate([
      { $match: { company: req.user.company, status: { $in: ['à faire', 'en cours'] } } },
      { $group: { _id: '$assignee', count: { $sum: 1 } } }
    ]);

    const workload = employees.map(e => ({
      id: e._id, name: `${e.firstName} ${e.lastName}`, poste: e.poste,
      activeTasks: (taskCounts.find(t => t._id?.toString() === e._id.toString()) || {}).count || 0
    }));

    const prompt = `Tâche à assigner: "${task.title}" (priorité: ${task.priority})\nÉquipe disponible:\n${JSON.stringify(workload, null, 2)}\nQui est le meilleur candidat et pourquoi? Réponds avec le nom et une explication courte.`;
    const suggestion = await chat('Tu es un manager expert en allocation de ressources humaines.', prompt);
    res.json({ success: true, data: { task: task.title, suggestion, teamWorkload: workload } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.dashboardInsights = async (req, res) => {
  try {
    const [invoiceCount, expenseTotal, employeeCount, lowStockCount, overdueTaskCount] = await Promise.all([
      Invoice.countDocuments({ company: req.user.company, status: 'pending' }),
      Expense.aggregate([{ $match: { company: req.user.company } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Employee.countDocuments({ company: req.user.company }),
      Product.countDocuments({ company: req.user.company, $expr: { $lte: ['$quantity', '$alertThreshold'] } }),
      Task.countDocuments({ company: req.user.company, status: { $ne: 'terminé' }, deadline: { $lt: new Date() } })
    ]);

    const context = `Factures en attente: ${invoiceCount}, Dépenses totales: ${(expenseTotal[0]?.total || 0)}€, Employés: ${employeeCount}, Alertes stock bas: ${lowStockCount}, Tâches en retard: ${overdueTaskCount}`;
    const insights = await chat('Tu es un assistant de direction (COO) expert en gestion d\'entreprise. Fournis des insights actionnables.', `Génère 3 insights prioritaires pour cette entreprise basés sur: ${context}`);
    res.json({ success: true, data: { insights, metrics: { invoiceCount, expenseTotal: expenseTotal[0]?.total || 0, employeeCount, lowStockCount, overdueTaskCount } } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
