const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token missing' });
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
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
