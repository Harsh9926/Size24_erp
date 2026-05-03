const db = require('../config/db');
const bcrypt = require('bcrypt');

// List all users with all shop assignments
exports.getUsers = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT
                u.id, u.name, u.mobile, u.role, u.is_approved, u.status,
                -- First assigned shop for backward-compat filter
                (SELECT su.shop_id
                 FROM shop_users su
                 WHERE su.user_id = u.id
                 ORDER BY su.assigned_at ASC
                 LIMIT 1) AS shop_id,
                (SELECT s.shop_name
                 FROM shop_users su
                 JOIN shops s ON s.id = su.shop_id
                 WHERE su.user_id = u.id
                 ORDER BY su.assigned_at ASC
                 LIMIT 1) AS shop_name,
                -- Full list of assigned shops
                (SELECT COALESCE(json_agg(d), '[]'::json)
                 FROM (
                     SELECT json_build_object('id', s2.id, 'name', s2.shop_name) AS d
                     FROM shop_users su2
                     JOIN shops s2 ON s2.id = su2.shop_id
                     WHERE su2.user_id = u.id
                     ORDER BY su2.assigned_at ASC
                 ) ordered_shops) AS assigned_shops
             FROM users u
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

// Assign a shop to a user — additive, never removes existing assignments
exports.assignShop = async (req, res) => {
    try {
        const { userId } = req.params;
        const { shopId }  = req.body;

        if (!shopId) return res.status(400).json({ error: 'shopId is required' });

        const shopCheck = await db.query('SELECT id, shop_name FROM shops WHERE id = $1', [shopId]);
        if (shopCheck.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

        const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const ins = await db.query(
            `INSERT INTO shop_users (shop_id, user_id, assigned_by)
             VALUES ($1, $2, $3)
             ON CONFLICT (shop_id, user_id) DO NOTHING
             RETURNING id`,
            [shopId, userId, req.user.id]
        );

        const alreadyAssigned = ins.rows.length === 0;
        res.json({
            message: alreadyAssigned ? 'User already assigned to this shop' : 'Shop assigned successfully',
            shop: shopCheck.rows[0],
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get all shops assigned to a specific user
exports.getUserShops = async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await db.query(
            `SELECT s.id, s.shop_name, su.assigned_at, ab.name AS assigned_by_name
             FROM shop_users su
             JOIN shops s       ON s.id  = su.shop_id
             LEFT JOIN users ab ON ab.id = su.assigned_by
             WHERE su.user_id = $1
             ORDER BY su.assigned_at ASC`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Remove a single shop assignment from a user
exports.unassignShop = async (req, res) => {
    try {
        const { userId, shopId } = req.params;
        const result = await db.query(
            'DELETE FROM shop_users WHERE user_id = $1 AND shop_id = $2 RETURNING id',
            [userId, shopId]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Assignment not found' });
        res.json({ message: 'Shop unassigned successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
