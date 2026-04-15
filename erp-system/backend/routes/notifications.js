const express = require('express');
const router = express.Router();
const notif = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, notif.getNotifications);
router.put('/:id/read', authenticateToken, notif.markRead);
router.put('/read-all', authenticateToken, notif.markAllRead);

module.exports = router;
