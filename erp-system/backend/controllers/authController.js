const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');

exports.login = async (req, res) => {
    try {
        const { mobile, password } = req.body;
        const userResult = await db.query('SELECT * FROM users WHERE mobile = $1', [mobile]);
        if (userResult.rows.length === 0) return res.status(401).json({ error: 'Invalid mobile or password' });

        const user = userResult.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(401).json({ error: 'Invalid mobile or password' });

        // Block login for every unapproved account — no role exceptions.
        // Radhika (primary admin) is always is_approved = true so she is unaffected.
        if (!user.is_approved) {
            return res.status(403).json({ error: 'Your account is pending approval. Please contact Radhika (Admin).' });
        }

        if (user.status === 'inactive') {
            return res.status(403).json({ error: 'Your account has been deactivated. Please contact admin.' });
        }

        // Fetch assigned shop for shop_user
        let shopId = null;
        let shopName = null;
        if (user.role === 'shop_user') {
            const shopResult = await db.query('SELECT id, shop_name FROM shops WHERE user_id = $1', [user.id]);
            if (shopResult.rows.length > 0) {
                shopId = shopResult.rows[0].id;
                shopName = shopResult.rows[0].shop_name;
            }
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, shopId },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, name: user.name, mobile: user.mobile, role: user.role, shopId, shopName }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login' });
    }
};

// ── Change Password (any logged-in user changes their own password) ──
exports.changePassword = async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        const userId = req.user.id;

        if (!current_password || !new_password)
            return res.status(400).json({ error: 'current_password and new_password are required.' });

        if (new_password.length < 6)
            return res.status(400).json({ error: 'New password must be at least 6 characters.' });

        const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0)
            return res.status(404).json({ error: 'User not found.' });

        const user = userResult.rows[0];

        const valid = await bcrypt.compare(current_password, user.password_hash);
        if (!valid)
            return res.status(401).json({ error: 'Current password is incorrect.' });

        const sameAsOld = await bcrypt.compare(new_password, user.password_hash);
        if (sameAsOld)
            return res.status(400).json({ error: 'New password must be different from the current password.' });

        const hash = await bcrypt.hash(new_password, 10);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);

        console.log(`[changePassword] User #${userId} changed their password.`);
        res.json({ message: 'Password updated successfully.' });
    } catch (err) {
        console.error('[changePassword] error:', err.message);
        res.status(500).json({ error: 'Server error.' });
    }
};

exports.register = async (req, res) => {
    try {
        const { name, mobile, password, role } = req.body;
        if (!mobile || !password || !role) return res.status(400).json({ error: 'mobile, password and role are required' });

        const existing = await db.query('SELECT id FROM users WHERE mobile = $1', [mobile]);
        if (existing.rows.length > 0) return res.status(409).json({ error: 'Mobile number already registered' });

        const hash = await bcrypt.hash(password, 10);

        // Self-registrations always require admin approval — no exceptions.
        // Only the admin "Create User" panel creates auto-approved accounts.
        const result = await db.query(
            'INSERT INTO users (name, mobile, password_hash, role, is_approved) VALUES ($1, $2, $3, $4, false) RETURNING id, name, mobile, role, is_approved',
            [name || null, mobile, hash, role]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Registration error' });
    }
};
