const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/productMasterController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const auth    = authenticateToken;
const admin   = requireRole('admin', 'manager');

// All lookups in one request
router.get('/lookups',                auth,        ctrl.getLookups);

// Colors
router.get('/colors',                 auth,        ctrl.getColors);
router.post('/colors',                auth, admin, ctrl.createColor);
router.put('/colors/:id',             auth, admin, ctrl.updateColor);

// Genders
router.get('/genders',                auth,        ctrl.getGenders);
router.post('/genders',               auth, admin, ctrl.createGender);

// Houses
router.get('/houses',                 auth,        ctrl.getHouses);
router.post('/houses',                auth, admin, ctrl.createHouse);
router.put('/houses/:id',             auth, admin, ctrl.updateHouse);

// Sleeve Types
router.get('/sleeve-types',           auth,        ctrl.getSleeveTypes);
router.post('/sleeve-types',          auth, admin, ctrl.createSleeveType);

// Fabric Types
router.get('/fabric-types',           auth,        ctrl.getFabricTypes);
router.post('/fabric-types',          auth, admin, ctrl.createFabricType);
router.put('/fabric-types/:id',       auth, admin, ctrl.updateFabricType);

// Sizes
router.get('/sizes',                  auth,        ctrl.getSizes);
router.post('/sizes',                 auth, admin, ctrl.createSize);
router.put('/sizes/:id',              auth, admin, ctrl.updateSize);

// SKU / Barcode generation
router.get('/generate-sku',           auth, admin, ctrl.generateSKU);
router.get('/generate-barcode',       auth, admin, ctrl.generateBarcode);

module.exports = router;
