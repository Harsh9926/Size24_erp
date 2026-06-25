const db = require('../config/db');

/* ═══════════════════ BOM HEADERS ═══════════════════════════════════ */
exports.getBOMs = async (req, res) => {
    try {
        const { product_id } = req.query;
        const conds  = ['1=1'];
        const params = [];
        let i = 1;
        if (product_id) { conds.push(`b.product_id = $${i++}`); params.push(product_id); }

        const r = await db.query(`
            SELECT b.*,
                   p.name AS product_name,
                   u.name AS created_by_name,
                   (SELECT COUNT(*) FROM bom_items bi WHERE bi.bom_id = b.id) AS item_count
            FROM   bom_headers b
            LEFT JOIN inv_products p ON p.id = b.product_id
            LEFT JOIN users        u ON u.id = b.created_by
            WHERE  ${conds.join(' AND ')}
            ORDER  BY p.name, b.version
        `, params);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getBOM = async (req, res) => {
    try {
        const bom = await db.query(`
            SELECT b.*, p.name AS product_name
            FROM bom_headers b
            LEFT JOIN inv_products p ON p.id = b.product_id
            WHERE b.id = $1
        `, [req.params.id]);
        if (!bom.rows.length) return res.status(404).json({ error: 'BOM not found' });

        const items = await db.query(`
            SELECT bi.*, m.name AS material_name, m.unit AS material_unit,
                   m.current_cost, mt.name AS type_name
            FROM bom_items bi
            JOIN rm_materials m ON m.id = bi.material_id
            LEFT JOIN rm_material_types mt ON mt.id = m.type_id
            WHERE bi.bom_id = $1
            ORDER BY mt.name, m.name
        `, [req.params.id]);

        res.json({ ...bom.rows[0], items: items.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createBOM = async (req, res) => {
    const { product_id, version, name, items } = req.body;
    if (!product_id) return res.status(400).json({ error: 'product_id required' });

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const header = await client.query(`
            INSERT INTO bom_headers (product_id, version, name, created_by)
            VALUES ($1, $2, $3, $4) RETURNING *
        `, [product_id, version || 'v1', name || null, req.user.id]);

        const bomId = header.rows[0].id;

        if (Array.isArray(items) && items.length > 0) {
            for (const item of items) {
                if (!item.material_id || item.qty_per_unit == null) continue;
                await client.query(`
                    INSERT INTO bom_items (bom_id, material_id, qty_per_unit, unit, notes)
                    VALUES ($1,$2,$3,$4,$5)
                    ON CONFLICT (bom_id, material_id) DO UPDATE
                    SET qty_per_unit=$3, unit=$4, notes=$5
                `, [bomId, item.material_id, item.qty_per_unit, item.unit || null, item.notes || null]);
            }
        }

        await client.query('COMMIT');
        res.status(201).json(header.rows[0]);
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

exports.updateBOM = async (req, res) => {
    const { id } = req.params;
    const { version, name, is_active, items } = req.body;

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const header = await client.query(`
            UPDATE bom_headers SET version=$1, name=$2, is_active=$3
            WHERE id=$4 RETURNING *
        `, [version, name, is_active ?? true, id]);
        if (!header.rows.length) throw new Error('BOM not found');

        if (Array.isArray(items)) {
            await client.query(`DELETE FROM bom_items WHERE bom_id=$1`, [id]);
            for (const item of items) {
                if (!item.material_id || item.qty_per_unit == null) continue;
                await client.query(`
                    INSERT INTO bom_items (bom_id, material_id, qty_per_unit, unit, notes)
                    VALUES ($1,$2,$3,$4,$5)
                `, [id, item.material_id, item.qty_per_unit, item.unit || null, item.notes || null]);
            }
        }

        await client.query('COMMIT');
        res.json(header.rows[0]);
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

exports.deleteBOM = async (req, res) => {
    try {
        await db.query(`DELETE FROM bom_headers WHERE id=$1`, [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ═══════════════════ SIZE MATRIX ═══════════════════════════════════ */
exports.getSizeMatrix = async (req, res) => {
    try {
        const { product_id } = req.params;
        const r = await db.query(`
            SELECT sm.*,
                   m.name AS material_name,
                   m.unit AS material_unit,
                   m.current_cost,
                   mt.name AS type_name
            FROM   bom_size_matrix sm
            JOIN   rm_materials m     ON m.id  = sm.material_id
            LEFT JOIN rm_material_types mt ON mt.id = m.type_id
            WHERE  sm.product_id = $1
            ORDER  BY sm.size_name, mt.name, m.name
        `, [product_id]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.upsertSizeMatrix = async (req, res) => {
    // Body: { rows: [{ size_name, material_id, qty, unit, notes }] }
    const { product_id } = req.params;
    const { rows } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows array required' });

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        for (const row of rows) {
            if (!row.size_name || !row.material_id || row.qty == null) continue;
            await client.query(`
                INSERT INTO bom_size_matrix (product_id, size_name, material_id, qty, unit, notes)
                VALUES ($1,$2,$3,$4,$5,$6)
                ON CONFLICT (product_id, size_name, material_id)
                DO UPDATE SET qty=$4, unit=$5, notes=$6
            `, [product_id, row.size_name, row.material_id, row.qty, row.unit || null, row.notes || null]);
        }
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

exports.deleteSizeMatrixRow = async (req, res) => {
    const { product_id, size_name, material_id } = req.query;
    try {
        await db.query(
            `DELETE FROM bom_size_matrix WHERE product_id=$1 AND size_name=$2 AND material_id=$3`,
            [product_id, size_name, material_id]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ═══════════════════ MATERIAL REQUIREMENT CALCULATION ══════════════ */
// Given a production order: { product_id, quantities: { '28': 10, '30': 15, 'M': 20 } }
// Returns: [{ material_id, material_name, total_qty_required, unit, available_stock, shortage }]
exports.calculateRequirements = async (req, res) => {
    try {
        const { product_id, quantities } = req.body;
        // quantities = { '28': 10, '30': 15 }
        if (!product_id || !quantities) {
            return res.status(400).json({ error: 'product_id and quantities required' });
        }

        // Get active BOM for product
        const bomRes = await db.query(
            `SELECT id FROM bom_headers WHERE product_id=$1 AND is_active=true ORDER BY version DESC LIMIT 1`,
            [product_id]
        );
        if (!bomRes.rows.length) {
            return res.status(404).json({ error: 'No active BOM found for this product' });
        }
        const bomId = bomRes.rows[0].id;

        // Get BOM base items
        const baseItems = await db.query(`
            SELECT bi.material_id, bi.qty_per_unit, bi.unit,
                   m.name AS material_name, m.unit AS material_unit,
                   m.current_stock, m.current_cost
            FROM bom_items bi
            JOIN rm_materials m ON m.id = bi.material_id
            WHERE bi.bom_id = $1
        `, [bomId]);

        // Get size matrix overrides for this product + all relevant sizes
        const sizeNames = Object.keys(quantities);
        const sizeMatrix = await db.query(`
            SELECT material_id, size_name, qty
            FROM bom_size_matrix
            WHERE product_id=$1 AND size_name = ANY($2)
        `, [product_id, sizeNames]);

        // Build override map: material_id -> size_name -> qty
        const overrideMap = {};
        for (const row of sizeMatrix.rows) {
            if (!overrideMap[row.material_id]) overrideMap[row.material_id] = {};
            overrideMap[row.material_id][row.size_name] = parseFloat(row.qty);
        }

        // Calculate total requirement per material
        const reqMap = {};
        for (const item of baseItems.rows) {
            const mid = item.material_id;
            if (!reqMap[mid]) {
                reqMap[mid] = {
                    material_id:    mid,
                    material_name:  item.material_name,
                    unit:           item.unit || item.material_unit,
                    current_cost:   parseFloat(item.current_cost || 0),
                    current_stock:  parseFloat(item.current_stock || 0),
                    total_required: 0,
                };
            }
            for (const [size, orderQty] of Object.entries(quantities)) {
                const qtyPerUnit = (overrideMap[mid] && overrideMap[mid][size] != null)
                    ? overrideMap[mid][size]
                    : parseFloat(item.qty_per_unit);
                reqMap[mid].total_required += qtyPerUnit * parseFloat(orderQty);
            }
        }

        const results = Object.values(reqMap).map(r => ({
            ...r,
            total_required: Math.round(r.total_required * 10000) / 10000,
            shortage:        Math.max(0, r.total_required - r.current_stock),
            total_cost:      Math.round(r.total_required * r.current_cost * 100) / 100,
        }));

        res.json(results);
    } catch (e) { res.status(500).json({ error: e.message }); }
};
