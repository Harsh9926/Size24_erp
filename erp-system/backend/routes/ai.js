const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/aiController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.post('/chat', authenticateToken, requireRole('admin', 'manager'), ctrl.chat);

module.exports = router;
