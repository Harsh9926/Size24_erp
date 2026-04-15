const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.post('/', authenticateToken, requireRole('admin'), shopController.createShop);
router.get('/', authenticateToken, shopController.getShops);
router.get('/:id', authenticateToken, shopController.getShopById);

module.exports = router;
