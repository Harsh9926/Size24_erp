const express = require('express');
const router = express.Router();
const notif = require('../controllers/notificationController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const dailyReports = require('../services/dailyReports');

router.get('/', authenticateToken, notif.getNotifications);
router.put('/:id/read', authenticateToken, notif.markRead);
router.put('/read-all', authenticateToken, notif.markAllRead);

// POST /api/notifications/daily-reports/:type — admin-only manual trigger of
// the cron WhatsApp reports (type = reminder | sales), for testing.
router.post('/daily-reports/:type', authenticateToken, requireRole('admin'), async (req, res) => {
    const run = { reminder: dailyReports.sendDailyReminder, sales: dailyReports.sendSalesSummary }[req.params.type];
    if (!run) return res.status(400).json({ error: 'type must be reminder or sales' });
    try {
        res.json(await run());
    } catch (err) {
        console.error(`[daily-reports:${req.params.type}]`, err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
