const router = require('express').Router();
const ctrl   = require('../controllers/anomalyController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/',        authenticateToken, requireRole('admin', 'manager'), ctrl.listAnomalies);
router.get('/summary', authenticateToken, requireRole('admin', 'manager'), ctrl.getSummary);

module.exports = router;
