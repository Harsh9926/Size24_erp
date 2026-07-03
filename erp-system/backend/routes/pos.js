const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/posController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const auth  = authenticateToken;
const staff = requireRole('admin', 'manager');

// Product search & barcode
router.get('/search-products',   auth, ctrl.searchProducts);
router.get('/barcode/:code',     auth, ctrl.lookupBarcode);

// Customer
router.get('/search-customers',  auth, ctrl.searchCustomers);
router.post('/customers',        auth, staff, ctrl.createCustomer);
router.get('/customers/:id',     auth, ctrl.getCustomerProfile);

// Invoice
router.post('/invoice',          auth, staff, ctrl.createPOSInvoice);
router.get('/invoice/:ref',      auth, ctrl.getInvoiceForReturn);

// Return
router.post('/return',           auth, staff, ctrl.processPOSReturn);

// Dashboard
router.get('/dashboard',         auth, ctrl.getDashboard);

// Delivery challan
router.post('/challan',          auth, staff, ctrl.createChallan);

module.exports = router;
