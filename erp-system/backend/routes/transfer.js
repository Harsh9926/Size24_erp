const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/transferController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// ── IMPORTANT: named routes MUST come before /:id param routes ─────

// Role-scoped list views
router.get('/admin',    authenticateToken, requireRole('admin'),                       ctrl.getAdminTransfers);
router.get('/manager',  authenticateToken, requireRole('manager'),                     ctrl.getManagerTransfers);
router.get('/mine',     authenticateToken, requireRole('shop_user'),                   ctrl.getMyTransfers);
router.get('/balance',  authenticateToken,                                             ctrl.getBalance);
router.get('/managers', authenticateToken, requireRole('shop_user', 'admin'),          ctrl.getManagers);

// Shop user initiates transfer
router.post('/',              authenticateToken, requireRole('shop_user'), ctrl.createTransfer);

// Manager actions
router.put('/:id/accept',     authenticateToken, requireRole('manager'),   ctrl.acceptTransfer);
router.put('/:id/reject',     authenticateToken, requireRole('manager'),   ctrl.rejectTransfer);

module.exports = router;
