const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/bomController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const auth    = authenticateToken;
const admin   = requireRole('admin', 'manager');

// ── Static paths before parameterized ────────────────────────────────

// Material requirement calculation
router.post('/calculate-requirements',      auth,        ctrl.calculateRequirements);

// Size Matrix per product (static prefix — before /:id)
router.get('/size-matrix/:product_id',      auth,        ctrl.getSizeMatrix);
router.post('/size-matrix/:product_id',     auth, admin, ctrl.upsertSizeMatrix);
router.delete('/size-matrix/row',           auth, admin, ctrl.deleteSizeMatrixRow);

// BOM Headers + Items (parameterized last)
router.get('/',                             auth,        ctrl.getBOMs);
router.post('/',                            auth, admin, ctrl.createBOM);
router.get('/:id',                          auth,        ctrl.getBOM);
router.put('/:id',                          auth, admin, ctrl.updateBOM);
router.delete('/:id',                       auth, admin, ctrl.deleteBOM);

module.exports = router;
