const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/managerTransferController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { checkAction } = require('../middleware/checkPermission');

// ── IMPORTANT: named routes BEFORE /:id param routes ──────────────

// NOTE: /sync-store-wallets and /sync-manager-wallets are admin-only
// reconciliation/housekeeping operations, not a user-initiated transfer or
// approval — they don't map cleanly to any of the 3 declared manager_funds
// actions (view/transfer/approve_transfer). Left unguarded by checkAction in
// this phase rather than stretching a mapping onto them; admin already
// bypasses via the resolver's admin-WRITE-shortcut regardless. Flagged as a
// gap in the Phase 2 report, not silently ignored.

// Manager endpoints
router.get('/mine',                authenticateToken, requireRole('manager'),        checkAction('manager_funds.view'),     ctrl.getMyTransfers);
router.get('/admins',              authenticateToken, requireRole('manager'),        checkAction('manager_funds.view'),     ctrl.getAdmins);
router.post('/',                   authenticateToken, requireRole('manager'),        checkAction('manager_funds.transfer'), ctrl.upload.single('receipt'), ctrl.createTransfer);

// Admin endpoints
router.get('/managers',            authenticateToken, requireRole('admin'),          checkAction('manager_funds.view'),            ctrl.getManagersList);
router.get('/store-wallets',       authenticateToken, requireRole('admin'),          checkAction('manager_funds.view'),            ctrl.getStoreWallets);
router.post('/sync-store-wallets',   authenticateToken, requireRole('admin'),          ctrl.syncStoreWallets);
router.post('/sync-manager-wallets', authenticateToken, requireRole('admin'),          ctrl.syncManagerWallets);
router.get('/all',                 authenticateToken, requireRole('admin'),          checkAction('manager_funds.view'),            ctrl.getAllTransfers);
router.get('/summary/:managerId',  authenticateToken, requireRole('admin'),          checkAction('manager_funds.view'),            ctrl.getManagerSummary);
router.post('/admin-to-manager',   authenticateToken, requireRole('admin'),          checkAction('manager_funds.transfer'),        ctrl.adminSendToManager);
router.put('/:id/approve',         authenticateToken, requireRole('admin'),          checkAction('manager_funds.approve_transfer'), ctrl.approveTransfer);
router.put('/:id/reject',          authenticateToken, requireRole('admin'),          checkAction('manager_funds.approve_transfer'), ctrl.rejectTransfer);
router.delete('/:id',              authenticateToken, requireRole('admin'),          ctrl.deleteTransfer);

module.exports = router;

