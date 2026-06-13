const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/purchaseController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const auth    = authenticateToken;
const admin   = requireRole('admin', 'manager');

router.get('/bills',           auth, ctrl.getBills);
router.get('/bills/:id',       auth, ctrl.getBill);
router.post('/bills',          auth, admin, ctrl.createBill);
router.post('/payments',       auth, admin, ctrl.recordPayment);
router.post('/returns',        auth, admin, ctrl.createReturn);

module.exports = router;
