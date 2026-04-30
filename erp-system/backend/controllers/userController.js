const db = require('../config/db');
const bcrypt = require('bcrypt');

// List all users with shop info, approval status, and active/inactive status
exports.getUsers = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT u.id, u.name, u.mobile, u.role, u.is_approved, u.status,
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
            'INSERT INTO users (name, mobile, password_hash, role, is_approved) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, mobile, role, is_approved, status',
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
            'UPDATE users SET is_approved = true WHERE id = $1 RETURNING id, name, mobile, role, is_approved, status',
            [id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User approved', user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Reject a pending user (soft delete — sets inactive so record is recoverable)
exports.rejectUser = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            'UPDATE users SET is_approved = false, status = $1 WHERE id = $2 RETURNING id',
            ['inactive', id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        await db.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
             VALUES ('users', $1, '{"status":"active","is_approved":true}', '{"status":"inactive","is_approved":false}', $2)`,
            [id, req.user.id]
        );

        res.json({ message: 'User rejected and deactivated' });
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
            'UPDATE users SET name = $1, mobile = $2, role = $3 WHERE id = $4 RETURNING id, name, mobile, role, is_approved, status',
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

// Deactivate an approved user (soft delete — data is fully preserved)
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'You cannot deactivate your own account' });
        }

        const result = await db.query(
            'UPDATE users SET status = $1 WHERE id = $2 RETURNING id',
            ['inactive', id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        await db.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
             VALUES ('users', $1, '{"status":"active"}', '{"status":"inactive"}', $2)`,
            [id, req.user.id]
        );

        res.json({ message: 'User deactivated (data preserved)' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Toggle user status between active and inactive (admin only)
exports.toggleStatus = async (req, res) => {
    try {
        const { id } = req.params;

        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'You cannot change your own account status' });
        }

        const current = await db.query('SELECT id, name, status FROM users WHERE id = $1', [id]);
        if (current.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const oldStatus = current.rows[0].status;
        const newStatus = oldStatus === 'active' ? 'inactive' : 'active';

        const result = await db.query(
            'UPDATE users SET status = $1 WHERE id = $2 RETURNING id, name, mobile, role, is_approved, status',
            [newStatus, id]
        );

        await db.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
             VALUES ('users', $1, $2, $3, $4)`,
            [id, JSON.stringify({ status: oldStatus }), JSON.stringify({ status: newStatus }), req.user.id]
        );

        res.json({
            message: `User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
            user: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Assign a shop to a user (sets primary user on shop AND adds to shop_users junction table)
exports.assignShop = async (req, res) => {
    try {
        const { userId } = req.params;
        const { shopId } = req.body;

        // Unset this user as primary on any previous shop they were primary on
        await db.query('UPDATE shops SET user_id = NULL WHERE user_id = $1', [userId]);

        // Set as primary user on the new shop
        const result = await db.query(
            'UPDATE shops SET user_id = $1 WHERE id = $2 RETURNING *',
            [userId, shopId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

        // Also record in junction table (ON CONFLICT DO NOTHING handles duplicate)
        await db.query(
            'INSERT INTO shop_users (shop_id, user_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [shopId, userId, req.user.id]
        );

        res.json({ message: 'Shop assigned successfully', shop: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
