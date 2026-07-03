const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/posPhase2Controller');
const { authenticateToken, requireRole } = require('../middleware/auth');
const auth  = authenticateToken;
const staff = requireRole('admin', 'manager');

// Warehouses
router.get('/warehouses',                  auth, ctrl.getWarehouses);
router.get('/warehouse-stock/:variantId',  auth, ctrl.getWarehouseStock);

// Batches
router.get('/batches/:variantId',          auth, ctrl.getBatches);
router.post('/batches',                    auth, staff, ctrl.createBatch);

// Offers
router.get('/offers',                      auth, ctrl.getOffers);
router.post('/offers',                     auth, staff, ctrl.createOffer);
router.put('/offers/:id',                  auth, staff, ctrl.updateOffer);
router.post('/check-offers',               auth, ctrl.checkOffers);

// Customer pricing
router.get('/customer-pricing/:customerId', auth, ctrl.getCustomerPricing);
router.post('/customer-pricing',            auth, staff, ctrl.saveCustomerPricing);

// Advances
router.get('/advances/:customerId',        auth, ctrl.getAdvances);
router.post('/advances',                   auth, staff, ctrl.createAdvance);

// Credit & Ledger
router.get('/ledger/:customerId',          auth, ctrl.getCustomerLedger);
router.put('/credit-limit/:customerId',    auth, staff, ctrl.updateCreditLimit);

// Exchange invoice
router.post('/exchange-invoice',           auth, staff, ctrl.createExchangeInvoice);

// Cash counter
router.get('/sessions',                    auth, ctrl.listSessions);
router.get('/sessions/current',            auth, ctrl.getCurrentSession);
router.post('/sessions/open',              auth, staff, ctrl.openSession);
router.post('/sessions/:id/close',         auth, staff, ctrl.closeSession);
router.post('/sessions/movement',          auth, staff, ctrl.recordCashMovement);
router.get('/sessions/:id/report',         auth, ctrl.getSessionReport);

// Barcode labels
router.get('/barcode-labels',              auth, ctrl.getBarcodeLabels);

module.exports = router;
