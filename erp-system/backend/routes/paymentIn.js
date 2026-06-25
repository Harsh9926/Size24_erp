const express = require('express');
const router  = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/paymentInController');

// Shop user: get list of admins to select when submitting Payment In
router.get('/admins', authenticateToken, requireRole('shop_user', 'admin', 'manager'), ctrl.getAdmins);

// Shop user: submit a Payment In entry
router.post('/', authenticateToken, requireRole('shop_user'), ctrl.createPaymentIn);

// Admin only: view the full Admin Bank Ledger
router.get('/', authenticateToken, requireRole('admin'), ctrl.getLedger);

module.exports = router;
