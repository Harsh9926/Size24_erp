const db = require('../config/db');

/* ══════════════════════════════════════════════════════════════════
   SCHOOLS
══════════════════════════════════════════════════════════════════ */
exports.getSchools = async (req, res) => {
    try {
        const r = await db.query(
            `SELECT s.*,
                    COUNT(DISTINCT sp.product_id) AS product_count,
                    COUNT(DISTINCT c.id) AS customer_count
             FROM inv_schools s
             LEFT JOIN inv_school_products sp ON sp.school_id = s.id
             LEFT JOIN inv_customers c ON c.school_id = s.id
             WHERE s.is_active = true
             GROUP BY s.id ORDER BY s.name`
        );
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getSchool = async (req, res) => {
    try {
        const s = await db.query('SELECT * FROM inv_schools WHERE id=$1', [req.params.id]);
        if (!s.rows.length) return res.status(404).json({ error: 'Not found' });

        const products = await db.query(
            `SELECT sp.is_mandatory, p.id, p.name, p.article_code, c.name AS category_name,
                    COUNT(DISTINCT v.id) AS variant_count,
                    COALESCE(SUM(st.qty),0) AS total_stock
             FROM inv_school_products sp
             JOIN inv_products p ON p.id = sp.product_id
             LEFT JOIN inv_categories c ON c.id = p.category_id
             LEFT JOIN inv_variants v ON v.product_id = p.id AND v.school_id = $1
             LEFT JOIN inv_stock st ON st.variant_id = v.id
             WHERE sp.school_id = $1
             GROUP BY sp.is_mandatory, p.id, p.name, p.article_code, c.name
             ORDER BY p.name`, [req.params.id]
        );
        res.json({ ...s.rows[0], products: products.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createSchool = async (req, res) => {
    const { name, code, address, contact } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const r = await db.query(
            `INSERT INTO inv_schools (name, code, address, contact)
             VALUES ($1,$2,$3,$4) RETURNING *`,
            [name, code||null, address||null, contact||null]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateSchool = async (req, res) => {
    const { name, code, address, contact, is_active } = req.body;
    try {
        const r = await db.query(
            `UPDATE inv_schools SET name=$1, code=$2, address=$3, contact=$4, is_active=$5
             WHERE id=$6 RETURNING *`,
            [name, code||null, address||null, contact||null, is_active!==false, req.params.id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ══════════════════════════════════════════════════════════════════
   SCHOOL → PRODUCT MAPPING
══════════════════════════════════════════════════════════════════ */
exports.getSchoolProducts = async (req, res) => {
    try {
        const r = await db.query(
            `SELECT sp.*, p.name AS product_name, p.article_code, c.name AS category_name
             FROM inv_school_products sp
             JOIN inv_products p ON p.id = sp.product_id
             LEFT JOIN inv_categories c ON c.id = p.category_id
             WHERE sp.school_id = $1
             ORDER BY p.name`, [req.params.id]
        );
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.setSchoolProducts = async (req, res) => {
    // Replace all product mappings for a school
    const { product_ids } = req.body; // [{ product_id, is_mandatory }]
    if (!Array.isArray(product_ids)) return res.status(400).json({ error: 'product_ids array required' });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM inv_school_products WHERE school_id=$1', [req.params.id]);
        for (const p of product_ids) {
            await client.query(
                `INSERT INTO inv_school_products (school_id, product_id, is_mandatory)
                 VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
                [req.params.id, p.product_id || p, p.is_mandatory !== false]
            );
        }
        await client.query('COMMIT');
        res.json({ success: true, count: product_ids.length });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

exports.addSchoolProduct = async (req, res) => {
    const { product_id, is_mandatory } = req.body;
    if (!product_id) return res.status(400).json({ error: 'product_id required' });
    try {
        const r = await db.query(
            `INSERT INTO inv_school_products (school_id, product_id, is_mandatory)
             VALUES ($1,$2,$3) ON CONFLICT (school_id, product_id)
             DO UPDATE SET is_mandatory=$3 RETURNING *`,
            [req.params.id, product_id, is_mandatory !== false]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.removeSchoolProduct = async (req, res) => {
    try {
        await db.query(
            `DELETE FROM inv_school_products WHERE school_id=$1 AND product_id=$2`,
            [req.params.id, req.params.productId]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* School-wise stock summary */
exports.getSchoolStock = async (req, res) => {
    try {
        const r = await db.query(
            `SELECT p.name AS product_name, v.size, v.color, v.sku,
                    COALESCE(s.qty,0) AS qty, v.sale_price, v.purchase_price
             FROM inv_variants v
             JOIN inv_products p ON p.id = v.product_id
             LEFT JOIN inv_stock s ON s.variant_id = v.id
             WHERE v.school_id = $1 AND v.is_active = true
             ORDER BY p.name, v.size`, [req.params.id]
        );
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};
