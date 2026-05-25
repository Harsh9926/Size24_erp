const db = require('../config/db');

/**
 * Log a user action to activity_logs.
 * Safe to call fire-and-forget — never throws.
 */
const logActivity = async (userId, userName, userRole, action, resource, details, req) => {
    try {
        const forwarded = req?.headers?.['x-forwarded-for'];
        const ip = forwarded
            ? forwarded.split(',')[0].trim()
            : (req?.socket?.remoteAddress || 'unknown');
        const ua = (req?.headers?.['user-agent'] || '').substring(0, 500);

        await db.query(
            `INSERT INTO activity_logs
                (user_id, user_name, user_role, action, resource, details, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [userId, userName, userRole, action, resource || null, JSON.stringify(details || {}), ip, ua]
        );
    } catch (err) {
        // Never let logging break the main flow
        console.error('[activityLogger]', err.message);
    }
};

module.exports = { logActivity };
