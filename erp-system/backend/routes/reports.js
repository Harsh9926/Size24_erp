const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/data', authenticateToken, requireRole('admin', 'manager'), reportController.getReportData);
router.get('/csv', authenticateToken, requireRole('admin', 'manager'), reportController.downloadCSV);

module.exports = router;
