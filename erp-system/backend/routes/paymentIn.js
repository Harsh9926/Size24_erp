const express = require('express');
const router  = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { checkAction } = require('../middleware/checkPermission');
const ctrl = require('../controllers/paymentInController');

// Shop user: get list of admins to select when submitting Payment In
// (shop_user exempted — this is a lookup for their own submission flow, not
// a manager_funds-module operation for them)
router.get('/admins', authenticateToken, requireRole('shop_user', 'admin', 'manager'),
           checkAction('manager_funds.view', { exemptRoles: ['shop_user'] }), ctrl.getAdmins);

// Shop user: submit a Payment In entry — own-submission workflow, untouched
router.post('/', authenticateToken, requireRole('shop_user'), ctrl.createPaymentIn);

// Admin only: view the full Admin Bank Ledger (part of the manager_funds module per App.jsx)
router.get('/', authenticateToken, requireRole('admin'), checkAction('manager_funds.view'), ctrl.getLedger);

module.exports = router;
