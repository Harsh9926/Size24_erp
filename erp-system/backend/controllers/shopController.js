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
        manager_name, mobile_number, document_type, document_number, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [state_id, city_id, shop_name, gst_number, shop_address, manager_name, mobile_number, document_type, document_number, user_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getShops = async (req, res) => {
    try {
        // Admin gets all shops
        let query = 'SELECT s.*, c.name as city_name, st.name as state_name FROM shops s LEFT JOIN cities c ON s.city_id = c.id LEFT JOIN states st ON s.state_id = st.id';
        let params = [];

        // If shop_user, return only their shop
        if (req.user.role === 'shop_user') {
            query += ' WHERE s.user_id = $1';
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

        if (req.user.role === 'shop_user' && shop.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(shop);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
