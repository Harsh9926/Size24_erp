const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/serviceController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const auth    = authenticateToken;
const admin   = requireRole('admin', 'manager');

router.get('/dashboard',             auth, ctrl.getDashboard);
router.get('/orders',                auth, ctrl.getOrders);
router.get('/orders/:id',            auth, ctrl.getOrder);
router.post('/orders',               auth, admin, ctrl.createOrder);
router.put('/orders/:id',            auth, admin, ctrl.updateOrder);
router.put('/orders/:id/status',     auth, admin, ctrl.updateOrderStatus);
router.post('/orders/:id/payment',   auth, admin, ctrl.collectPayment);

module.exports = router;
