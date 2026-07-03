const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/franchiseController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const auth    = authenticateToken;
const admin   = requireRole('admin', 'manager');

router.get('/dashboard',             auth, ctrl.getDashboard);
router.get('/partners',              auth, ctrl.listPartners);
router.get('/partners/:id',          auth, ctrl.getPartner);
router.post('/partners',             auth, admin, ctrl.createPartner);
router.put('/partners/:id',          auth, admin, ctrl.updatePartner);

router.get('/partners/:id/wallet',   auth, ctrl.getWallet);
router.post('/partners/:id/wallet',  auth, admin, ctrl.addWalletEntry);

router.get('/transfers',             auth, ctrl.getTransfers);
router.post('/transfers',            auth, admin, ctrl.createTransfer);
router.put('/transfers/:id/approve', auth, admin, ctrl.approveTransfer);

router.get('/orders',                auth, ctrl.getOrders);
router.post('/orders',               auth, ctrl.createOrder);
router.put('/orders/:id/approve',    auth, admin, ctrl.approveOrder);

router.get('/settlements',           auth, ctrl.getSettlements);
router.post('/settlements',          auth, admin, ctrl.createSettlement);

module.exports = router;
