const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/activity — admin only, paginated activity log
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const limit  = Math.min(parseInt(req.query.limit)  || 100, 500);
        const offset = parseInt(req.query.offset) || 0;
        const action = req.query.action || null;
        const userId = req.query.user_id ? parseInt(req.query.user_id) : null;

        const conditions = [];
        const params     = [];
        if (action)  { params.push(action);  conditions.push(`action = $${params.length}`); }
        if (userId)  { params.push(userId);  conditions.push(`user_id = $${params.length}`); }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        params.push(limit, offset);
        const { rows } = await db.query(
            `SELECT id, user_id, user_name, user_role, action, resource,
                    details, ip_address, user_agent, created_at
             FROM activity_logs
             ${where}
             ORDER BY created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        const countRes = await db.query(
            `SELECT COUNT(*) FROM activity_logs ${where}`,
            params.slice(0, -2)
        );

        res.json({ logs: rows, total: parseInt(countRes.rows[0].count) });
    } catch (err) {
        console.error('[activity]', err.message);
        res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
});

// GET /api/activity/stats — quick summary for security dashboard
router.get('/stats', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const [loginToday, failedLogins, activeUsers] = await Promise.all([
            db.query(`SELECT COUNT(*) FROM activity_logs WHERE action='LOGIN' AND created_at > NOW() - INTERVAL '24 hours'`),
            db.query(`SELECT COUNT(*) FROM activity_logs WHERE action='LOGIN_FAILED' AND created_at > NOW() - INTERVAL '24 hours'`),
            db.query(`SELECT COUNT(DISTINCT user_id) FROM activity_logs WHERE created_at > NOW() - INTERVAL '1 hour'`),
        ]);
        res.json({
            loginsToday:   parseInt(loginToday.rows[0].count),
            failedLogins:  parseInt(failedLogins.rows[0].count),
            activeLastHour: parseInt(activeUsers.rows[0].count),
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router;
