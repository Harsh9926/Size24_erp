const db = require('../config/db');

exports.getNotifications = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
            [req.user.id]
        );
        const unreadCount = result.rows.filter(n => !n.is_read).length;
        res.json({ notifications: result.rows, unreadCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.markRead = async (req, res) => {
    try {
        await db.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.markAllRead = async (req, res) => {
    try {
        await db.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.id]);
        res.json({ message: 'All marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Helper to create notification (used internally)
exports.createNotification = async (userId, type, message) => {
    try {
        await db.query(
            'INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3)',
            [userId, type, message]
        );
    } catch (e) {
        console.error('Notification error:', e.message);
    }
};
