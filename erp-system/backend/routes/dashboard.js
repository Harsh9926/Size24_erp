const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/admin', authenticateToken, requireRole('admin'), dashboardController.getAdminDashboard);
router.get('/manager', authenticateToken, requireRole('admin', 'manager'), dashboardController.getManagerDashboard);
router.get('/shop', authenticateToken, requireRole('shop_user'), dashboardController.getShopDashboard);

module.exports = router;
