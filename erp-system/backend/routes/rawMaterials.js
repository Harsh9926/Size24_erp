const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/rawMaterialController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const auth    = authenticateToken;
const admin   = requireRole('admin', 'manager');

// ── Static paths first (before parameterized routes) ─────────────────

// Dashboard / stats
router.get('/dashboard',              auth,        ctrl.getDashboardStats);

// Warehouses
router.get('/warehouses',             auth,        ctrl.getWarehouses);
router.post('/warehouses',            auth, admin, ctrl.createWarehouse);
router.put('/warehouses/:id',         auth, admin, ctrl.updateWarehouse);

// Material Types
router.get('/types',                  auth,        ctrl.getMaterialTypes);
router.post('/types',                 auth, admin, ctrl.createMaterialType);

// Fabric Lots (static prefix — must be before /:id)
router.get('/fabric-lots/list',       auth,        ctrl.getFabricLots);
router.post('/fabric-lots',           auth, admin, ctrl.createFabricLot);
router.get('/fabric-lots/:id',        auth,        ctrl.getFabricLot);
router.post('/fabric-lots/:id/usage', auth, admin, ctrl.recordLotUsage);

// Materials master (parameterized — must be last)
router.get('/',                       auth,        ctrl.getMaterials);
router.post('/',                      auth, admin, ctrl.createMaterial);
router.get('/:id',                    auth,        ctrl.getMaterial);
router.put('/:id',                    auth, admin, ctrl.updateMaterial);

// Purchase history per material
router.get('/:material_id/purchases', auth,        ctrl.getPurchaseHistory);
router.post('/:material_id/purchases',auth, admin, ctrl.addPurchase);

module.exports = router;
