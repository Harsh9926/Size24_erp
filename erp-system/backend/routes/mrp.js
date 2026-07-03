const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/mrpController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const auth    = authenticateToken;
const admin   = requireRole('admin', 'manager');

router.get('/suggestions',           auth, ctrl.getSuggestions);
router.post('/suggestions/generate', auth, ctrl.generateSuggestions);
router.post('/suggestions/save',     auth, admin, ctrl.saveSuggestions);
router.put('/suggestions/:id',       auth, admin, ctrl.approveSuggestion);
router.get('/stock-analysis',        auth, ctrl.getStockAnalysis);
router.get('/demand-plans',          auth, ctrl.getDemandPlans);

module.exports = router;
