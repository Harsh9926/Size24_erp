const db = require('../config/db');

exports.createShop = async (req, res) => {
    try {
        const {
            state_id, city_id, shop_name, gst_number, shop_address,
            manager_name, mobile_number, document_type, document_number, user_id
        } = req.body;

        const result = await db.query(
            `INSERT INTO shops (
                state_id, city_id, shop_name, gst_number, shop_address,
                manager_name, mobile_number, document_type, document_number,
                user_id, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [state_id, city_id, shop_name, gst_number, shop_address,
             manager_name, mobile_number, document_type, document_number,
             user_id || null, req.user.id]
        );

        const shop = result.rows[0];

        // Seed junction table if a primary user was provided
        if (user_id) {
            await db.query(
                'INSERT INTO shop_users (shop_id, user_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                [shop.id, user_id, req.user.id]
            );
        }

        res.status(201).json(shop);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getShops = async (req, res) => {
    try {
        let query = `
            SELECT s.*, c.name as city_name, st.name as state_name
            FROM shops s
            LEFT JOIN cities c  ON s.city_id  = c.id
            LEFT JOIN states st ON s.state_id = st.id`;
        let params = [];

        if (req.user.role === 'shop_user') {
            // Return all shops the user is assigned to via junction table
            query += `
            JOIN shop_users su ON su.shop_id = s.id
            WHERE su.user_id = $1`;
            params.push(req.user.id);
        }

        query += ' ORDER BY s.shop_name ASC';
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getShopById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM shops WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

        const shop = result.rows[0];

        if (req.user.role === 'shop_user') {
            // Check junction table — any assigned user can access, not just the primary one
            const access = await db.query(
                'SELECT 1 FROM shop_users WHERE shop_id = $1 AND user_id = $2',
                [id, req.user.id]
            );
            if (access.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        res.json(shop);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/shops/:shopId/users — list all users assigned to a shop
exports.getShopUsers = async (req, res) => {
    try {
        const { shopId } = req.params;
        const result = await db.query(
            `SELECT u.id, u.name, u.mobile, u.role, u.status,
                    su.assigned_at,
                    ab.name as assigned_by_name
             FROM shop_users su
             JOIN users u  ON u.id  = su.user_id
             LEFT JOIN users ab ON ab.id = su.assigned_by
             WHERE su.shop_id = $1
             ORDER BY su.assigned_at ASC`,
            [shopId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/shops/:shopId/users — assign a user to a shop
exports.addUserToShop = async (req, res) => {
    try {
        const { shopId } = req.params;
        const { user_id } = req.body;
        if (!user_id) return res.status(400).json({ error: 'user_id is required' });

        const shop = await db.query('SELECT id FROM shops WHERE id = $1', [shopId]);
        if (shop.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });

        const user = await db.query('SELECT id, status FROM users WHERE id = $1', [user_id]);
        if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        if (user.rows[0].status !== 'active') return res.status(400).json({ error: 'Cannot assign an inactive user' });

        await db.query(
            'INSERT INTO shop_users (shop_id, user_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [shopId, user_id, req.user.id]
        );

        await db.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
             VALUES ('shop_users', $1, NULL, $2, $3)`,
            [shopId, JSON.stringify({ shop_id: shopId, user_id }), req.user.id]
        );

        res.json({ message: 'User assigned to shop' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/shops/:shopId/users/:userId — remove a user from a shop
exports.removeUserFromShop = async (req, res) => {
    try {
        const { shopId, userId } = req.params;

        const result = await db.query(
            'DELETE FROM shop_users WHERE shop_id = $1 AND user_id = $2 RETURNING id',
            [shopId, userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });

        // If this user was also the primary user on the shop, clear that too
        await db.query(
            'UPDATE shops SET user_id = NULL WHERE id = $1 AND user_id = $2',
            [shopId, userId]
        );

        await db.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
             VALUES ('shop_users', $1, $2, NULL, $3)`,
            [shopId, JSON.stringify({ shop_id: shopId, user_id: userId }), req.user.id]
        );

        res.json({ message: 'User removed from shop' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
