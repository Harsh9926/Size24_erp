const express = require('express');
const router = express.Router();
const cashFlowController = require('../controllers/cashFlowController');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, cashFlowController.createCashFlow);
router.get('/', authenticateToken, cashFlowController.getCashFlows);

module.exports = router;
