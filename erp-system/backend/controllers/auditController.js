const db = require('../config/db');

exports.getAuditLogs = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT a.*, u.name as edited_by_name, u.mobile as edited_by_mobile
       FROM audit_logs a
       LEFT JOIN users u ON a.edited_by = u.id
       ORDER BY a.timestamp DESC
       LIMIT 100`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
