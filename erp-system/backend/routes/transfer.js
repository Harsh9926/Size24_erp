const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/transferController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { checkAction } = require('../middleware/checkPermission');

// ── IMPORTANT: named routes MUST come before /:id param routes ─────

// NOTE: POST '/' and GET '/mine' and GET '/managers' (for shop_user) are the
// shop_user's own cash-handoff-to-manager submission workflow — same pattern
// as Entries Phase 1. ROLE_DEFAULTS.shop_user.manager_funds is NO_ACCESS
// (that RBAC surface was never designed for shop_user), so these are
// exempted via checkAction(..., { exemptRoles: ['shop_user'] }) rather than
// gated — shop_user's existing business logic (own-transfer scoping in
// transferController.js) is untouched.
// GET '/balance' is intentionally left unguarded — it's a personal read
// (own wallet balance) available to any authenticated role, not a
// manager_funds-module operation.

// Role-scoped list views
router.get('/admin',    authenticateToken, requireRole('admin', 'manager'), checkAction('manager_funds.view'), ctrl.getAdminTransfers);
router.get('/manager',  authenticateToken, requireRole('manager'),                     checkAction('manager_funds.view'), ctrl.getManagerTransfers);
router.get('/mine',     authenticateToken, requireRole('shop_user'),                   checkAction('manager_funds.view', { exemptRoles: ['shop_user'] }), ctrl.getMyTransfers);
router.get('/balance',  authenticateToken,                                             ctrl.getBalance);
router.get('/managers', authenticateToken, requireRole('shop_user', 'admin'),          checkAction('manager_funds.view', { exemptRoles: ['shop_user'] }), ctrl.getManagers);

// Shop user initiates transfer
router.post('/',              authenticateToken, requireRole('shop_user'), checkAction('manager_funds.transfer', { exemptRoles: ['shop_user'] }), ctrl.createTransfer);

// Manager actions
router.put('/:id/accept',     authenticateToken, requireRole('manager'),   checkAction('manager_funds.approve_transfer'), ctrl.acceptTransfer);
router.put('/:id/reject',     authenticateToken, requireRole('manager'),   checkAction('manager_funds.approve_transfer'), ctrl.rejectTransfer);

// Admin delete
router.delete('/:id',         authenticateToken, requireRole('admin'),     ctrl.deleteTransfer);

module.exports = router;

