const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/entryController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// ── IMPORTANT: Named routes MUST come before /:id param routes ────
// GET /pending would match /:id = "pending" if placed after put('/:id')

// ── Admin-only named routes ───────────────────────────────────────
router.get(  '/pending',      authenticateToken, requireRole('admin', 'manager'), ctrl.getPendingEntries);
router.get(  '/today-status', authenticateToken, requireRole('admin', 'manager'), ctrl.getTodayStatus);
router.post( '/bulk-action',  authenticateToken, requireRole('admin', 'manager'), ctrl.bulkAction);

// ── Shop user / general ───────────────────────────────────────────
router.get( '/',              authenticateToken, ctrl.getEntries);
router.post('/',              authenticateToken, ctrl.createEntry);
router.put( '/:id',          authenticateToken, ctrl.updateEntry);

// ── Admin param routes ────────────────────────────────────────────
router.post(  '/:id/approve',  authenticateToken, requireRole('admin', 'manager'), ctrl.approveEntry);
router.post(  '/:id/reject',   authenticateToken, requireRole('admin', 'manager'), ctrl.rejectEntry);
router.post(  '/:id/unlock',   authenticateToken, requireRole('admin'),          ctrl.unlockEntry);
router.delete('/:id',          authenticateToken, requireRole('admin'),          ctrl.deleteEntry);

module.exports = router;

