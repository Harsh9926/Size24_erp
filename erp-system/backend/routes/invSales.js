const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/invSalesController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const auth    = authenticateToken;
const admin   = requireRole('admin', 'manager');

router.get('/invoices',        auth, ctrl.getInvoices);
router.get('/invoices/:id',    auth, ctrl.getInvoice);
router.post('/invoices',       auth, admin, ctrl.createInvoice);
router.post('/payments',       auth, admin, ctrl.recordPayment);
router.post('/returns',        auth, admin, ctrl.createReturn);
router.get('/report',          auth, ctrl.getSalesReport);

module.exports = router;
