const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const Supplier = require('../models/Supplier');

exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create({ ...req.body, company: req.user.company });
    res.status(201).json({ success: true, data: product });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getProducts = async (req, res) => {
  try {
    const { stockBas } = req.query;
    let filter = { company: req.user.company, actif: true };
    if (stockBas === 'true') filter.alerteActive = true;
    const products = await Product.find(filter).populate('fournisseur', 'nom email telephone');
    res.json({ success: true, data: products, count: products.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, company: req.user.company }).populate('fournisseur');
    if (!product) return res.status(404).json({ success: false, message: 'Produit introuvable' });
    res.json({ success: true, data: product });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, company: req.user.company });
    if (!product) return res.status(404).json({ success: false, message: 'Produit introuvable' });
    Object.assign(product, req.body);
    await product.save(); // déclenche le hook pre('save') → recalcule alerteActive
    res.json({ success: true, data: product });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteProduct = async (req, res) => {
  try {
    await Product.findOneAndUpdate({ _id: req.params.id, company: req.user.company }, { actif: false });
    res.json({ success: true, message: 'Produit désactivé' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addMovement = async (req, res) => {
  try {
    const { productId, type, quantite, motif, reference, fournisseur } = req.body;
    const product = await Product.findOne({ _id: productId, company: req.user.company });
    if (!product) return res.status(404).json({ success: false, message: 'Produit introuvable' });
    if (type === 'sortie' && product.quantite < quantite)
      return res.status(400).json({ success: false, message: 'Stock insuffisant' });

    const quantiteAvant = product.quantite;
    product.quantite += type === 'entree' ? quantite : type === 'sortie' ? -quantite : 0;
    await product.save();

    const movement = await StockMovement.create({
      company: req.user.company, product: productId, type, quantite,
      quantiteAvant, quantiteApres: product.quantite,
      motif, reference, fournisseur, createdBy: req.user.id
    });

    res.status(201).json({
      success: true, data: movement, produit: product,
      alerte: product.alerteActive
        ? { active: true, message: `Stock bas: ${product.nom} (${product.quantite} ${product.unite})` }
        : { active: false }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getMovements = async (req, res) => {
  try {
    const { productId, type } = req.query;
    const filter = { company: req.user.company };
    if (productId) filter.product = productId;
    if (type) filter.type = type;
    const movements = await StockMovement.find(filter).populate('product', 'nom sku').sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: movements });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.createSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.create({ ...req.body, company: req.user.company });
    res.status(201).json({ success: true, data: supplier });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find({ company: req.user.company, actif: true });
    res.json({ success: true, data: suppliers, count: suppliers.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getLowStockAlerts = async (req, res) => {
  try {
    const products = await Product.find({ company: req.user.company, actif: true, alerteActive: true })
      .populate('fournisseur', 'nom email telephone');
    const alertes = products.map(p => ({
      id: p._id, nom: p.nom, sku: p.sku, quantite: p.quantite,
      seuilAlerte: p.seuilAlerte, unite: p.unite,
      urgence: p.quantite === 0 ? 'critique' : 'faible',
      fournisseur: p.fournisseur
    }));
    res.json({ success: true, data: alertes, count: alertes.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
