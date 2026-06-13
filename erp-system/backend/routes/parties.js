const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/partiesController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const auth    = authenticateToken;
const admin   = requireRole('admin', 'manager');

// Suppliers
router.get('/suppliers',       auth, ctrl.getSuppliers);
router.get('/suppliers/:id',   auth, ctrl.getSupplier);
router.post('/suppliers',      auth, admin, ctrl.createSupplier);
router.put('/suppliers/:id',   auth, admin, ctrl.updateSupplier);

// Customers
router.get('/customers',       auth, ctrl.getCustomers);
router.get('/customers/:id',   auth, ctrl.getCustomer);
router.post('/customers',      auth, admin, ctrl.createCustomer);
router.put('/customers/:id',   auth, admin, ctrl.updateCustomer);

module.exports = router;
