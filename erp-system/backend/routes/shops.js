const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.post('/',                        authenticateToken, requireRole('admin'), shopController.createShop);
router.get('/',                         authenticateToken, shopController.getShops);
router.get('/:id',                      authenticateToken, shopController.getShopById);

// Multi-user assignment (admin only)
router.get('/:shopId/users',            authenticateToken, requireRole('admin'), shopController.getShopUsers);
router.post('/:shopId/users',           authenticateToken, requireRole('admin'), shopController.addUserToShop);
router.delete('/:shopId/users/:userId', authenticateToken, requireRole('admin'), shopController.removeUserFromShop);

module.exports = router;
