const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/managerTransferController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// ── IMPORTANT: named routes BEFORE /:id param routes ──────────────

// Manager endpoints
router.get('/mine',                authenticateToken, requireRole('manager'),        ctrl.getMyTransfers);
router.post('/',                   authenticateToken, requireRole('manager'),        ctrl.upload.single('receipt'), ctrl.createTransfer);

// Admin endpoints
router.get('/managers',            authenticateToken, requireRole('admin'),          ctrl.getManagersList);
router.get('/all',                 authenticateToken, requireRole('admin'),          ctrl.getAllTransfers);
router.get('/summary/:managerId',  authenticateToken, requireRole('admin'),          ctrl.getManagerSummary);
router.put('/:id/approve',         authenticateToken, requireRole('admin'),          ctrl.approveTransfer);
router.put('/:id/reject',          authenticateToken, requireRole('admin'),          ctrl.rejectTransfer);

module.exports = router;
