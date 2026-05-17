const express = require('express');
const router  = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

router.post('/login',           authController.login);
router.post('/register',        authController.register);
router.post('/change-password', authenticateToken, authController.changePassword);
router.post('/verify-password', authenticateToken, authController.verifyPassword);

module.exports = router;
