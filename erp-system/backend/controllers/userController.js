const db = require('../config/db');
const bcrypt = require('bcrypt');

// List all users with shop info and approval status
exports.getUsers = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT u.id, u.name, u.mobile, u.role, u.is_approved,
              s.id as shop_id, s.shop_name
       FROM users u
       LEFT JOIN shops s ON s.user_id = u.id
       ORDER BY u.is_approved ASC, u.id ASC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Create a user (admin only)
exports.createUser = async (req, res) => {
    try {
        const { name, mobile, password, role } = req.body;
        if (!mobile || !password || !role) return res.status(400).json({ error: 'mobile, password and role are required' });

        const existing = await db.query('SELECT id FROM users WHERE mobile = $1', [mobile]);
        if (existing.rows.length > 0) return res.status(409).json({ error: 'Mobile already registered' });

        const hash = await bcrypt.hash(password, 10);

        // Admin-panel-created manager/shop_user accounts are auto-approved (admin's intent).
        // Any new admin account must still be approved by Radhika before they can login.
        const isApproved = role !== 'admin';

        const result = await db.query(
            'INSERT INTO users (name, mobile, password_hash, role, is_approved) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, mobile, role, is_approved',
            [name || null, mobile, hash, role, isApproved]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Approve a user
exports.approveUser = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            'UPDATE users SET is_approved = true WHERE id = $1 RETURNING id, name, mobile, role, is_approved',
            [id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User approved', user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Reject / delete a user
exports.rejectUser = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ message: 'User rejected and removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Edit user (name, mobile, role)
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, mobile, role } = req.body;
        if (!name || !mobile || !role)
            return res.status(400).json({ error: 'name, mobile and role are required' });

        const existing = await db.query(
            'SELECT id FROM users WHERE mobile = $1 AND id != $2', [mobile, id]
        );
        if (existing.rows.length > 0)
            return res.status(409).json({ error: 'Mobile already used by another user' });

        const result = await db.query(
            'UPDATE users SET name = $1, mobile = $2, role = $3 WHERE id = $4 RETURNING id, name, mobile, role, is_approved',
            [name, mobile, role, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User updated', user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Reset password
exports.resetPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        if (!password || password.length < 4)
            return res.status(400).json({ error: 'Password must be at least 4 characters' });

        const hash = await bcrypt.hash(password, 10);
        const result = await db.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, name, mobile',
            [hash, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'Password reset successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Delete an approved user
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Assign a shop to a user
exports.assignShop = async (req, res) => {
    try {
        const { userId } = req.params;
        const { shopId } = req.body;
        await db.query('UPDATE shops SET user_id = NULL WHERE user_id = $1', [userId]);
        const result = await db.query(
            'UPDATE shops SET user_id = $1 WHERE id = $2 RETURNING *',
            [userId, shopId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
        res.json({ message: 'Shop assigned successfully', shop: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
