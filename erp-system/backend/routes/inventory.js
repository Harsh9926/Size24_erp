const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/inventoryController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const auth    = authenticateToken;
const admin   = requireRole('admin', 'manager');

// Categories
router.get('/categories',          auth, ctrl.getCategories);
router.post('/categories',         auth, admin, ctrl.createCategory);
router.put('/categories/:id',      auth, admin, ctrl.updateCategory);

// Products
router.get('/products',            auth, ctrl.getProducts);
router.get('/products/:id',        auth, ctrl.getProduct);
router.post('/products',           auth, admin, ctrl.createProduct);
router.put('/products/:id',        auth, admin, ctrl.updateProduct);

// Variants
router.post('/variants',           auth, admin, ctrl.createVariant);
router.post('/variants/bulk',      auth, admin, ctrl.bulkCreateVariants);
router.put('/variants/:id',        auth, admin, ctrl.updateVariant);

// Stock
router.get('/stock',               auth, ctrl.getStockSummary);
router.get('/stock/ledger',        auth, ctrl.getStockLedger);
router.post('/stock/adjust',       auth, admin, ctrl.createStockAdjustment);

// Barcode
router.get('/barcode/:barcode',    auth, ctrl.lookupBarcode);

// Dashboard
router.get('/dashboard',           auth, ctrl.getDashboardStats);

module.exports = router;
