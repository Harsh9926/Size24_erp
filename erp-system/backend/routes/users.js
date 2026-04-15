const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/', authenticateToken, requireRole('admin'), userController.getUsers);
router.post('/', authenticateToken, requireRole('admin'), userController.createUser);
router.put('/:userId/assign-shop', authenticateToken, requireRole('admin'), userController.assignShop);
router.put('/:id/approve', authenticateToken, requireRole('admin'), userController.approveUser);
router.delete('/:id/reject', authenticateToken, requireRole('admin'), userController.rejectUser);

module.exports = router;
