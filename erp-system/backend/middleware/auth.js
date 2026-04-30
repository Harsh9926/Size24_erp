const jwt = require('jsonwebtoken');
const db  = require('../config/db');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token missing' });

    try {
        const user = jwt.verify(token, process.env.JWT_SECRET);

        // Verify the account is still active on every request so deactivation
        // takes effect immediately without waiting for token expiry.
        const result = await db.query('SELECT status FROM users WHERE id = $1', [user.id]);
        if (result.rows.length === 0 || result.rows[0].status !== 'active') {
            return res.status(403).json({ error: 'Account is deactivated. Please contact admin.' });
        }

        req.user = user;
        next();
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        return res.status(500).json({ error: 'Authentication error' });
    }
};

// Accept a single role string OR an array of roles
const requireRole = (...roles) => {
    const allowed = roles.flat();
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'User not authenticated' });
        if (!allowed.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
        next();
    };
};

module.exports = { authenticateToken, requireRole };
