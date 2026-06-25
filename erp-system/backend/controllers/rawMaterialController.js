const db = require('../config/db');

/* ═══════════════════ WAREHOUSES ════════════════════════════════════ */
exports.getWarehouses = async (req, res) => {
    try {
        const r = await db.query(`SELECT * FROM rm_warehouses WHERE is_active=true ORDER BY name`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createWarehouse = async (req, res) => {
    const { name, location } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const r = await db.query(
            `INSERT INTO rm_warehouses (name, location) VALUES ($1,$2) RETURNING *`,
            [name, location || null]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateWarehouse = async (req, res) => {
    const { id } = req.params;
    const { name, location, is_active } = req.body;
    try {
        const r = await db.query(
            `UPDATE rm_warehouses SET name=$1, location=$2, is_active=$3 WHERE id=$4 RETURNING *`,
            [name, location, is_active ?? true, id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ═══════════════════ MATERIAL TYPES ═══════════════════════════════ */
exports.getMaterialTypes = async (req, res) => {
    try {
        const r = await db.query(`SELECT * FROM rm_material_types WHERE is_active=true ORDER BY name`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createMaterialType = async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const r = await db.query(
            `INSERT INTO rm_material_types (name, description) VALUES ($1,$2) RETURNING *`,
            [name, description || null]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ═══════════════════ RAW MATERIALS ════════════════════════════════ */
exports.getMaterials = async (req, res) => {
    try {
        const { search, type_id, low_stock } = req.query;
        const conds  = ['m.is_active = true'];
        const params = [];
        let i = 1;

        if (search)   { conds.push(`m.name ILIKE $${i++}`); params.push(`%${search}%`); }
        if (type_id)  { conds.push(`m.type_id = $${i++}`); params.push(type_id); }
        if (low_stock === 'true') { conds.push(`m.current_stock <= m.reorder_level`); }

        const r = await db.query(`
            SELECT m.*,
                   mt.name  AS type_name,
                   s.name   AS supplier_name,
                   w.name   AS warehouse_name
            FROM   rm_materials m
            LEFT JOIN rm_material_types mt ON mt.id = m.type_id
            LEFT JOIN inv_suppliers      s  ON s.id  = m.supplier_id
            LEFT JOIN rm_warehouses      w  ON w.id  = m.warehouse_id
            WHERE  ${conds.join(' AND ')}
            ORDER  BY m.name
        `, params);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getMaterial = async (req, res) => {
    try {
        const r = await db.query(`
            SELECT m.*,
                   mt.name AS type_name,
                   s.name  AS supplier_name,
                   w.name  AS warehouse_name
            FROM   rm_materials m
            LEFT JOIN rm_material_types mt ON mt.id = m.type_id
            LEFT JOIN inv_suppliers      s  ON s.id  = m.supplier_id
            LEFT JOIN rm_warehouses      w  ON w.id  = m.warehouse_id
            WHERE  m.id = $1
        `, [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createMaterial = async (req, res) => {
    const {
        name, type_id, supplier_id, unit, purchase_price, current_cost,
        current_stock, reorder_level, barcode, lot_number, warehouse_id,
        gst_rate, hsn_code, notes,
    } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const r = await db.query(`
            INSERT INTO rm_materials
                (name, type_id, supplier_id, unit, purchase_price, current_cost,
                 current_stock, reorder_level, barcode, lot_number, warehouse_id,
                 gst_rate, hsn_code, notes, created_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
            RETURNING *
        `, [
            name, type_id || null, supplier_id || null,
            unit || 'meter',
            purchase_price || 0, current_cost || 0,
            current_stock || 0, reorder_level || 0,
            barcode || null, lot_number || null,
            warehouse_id || null, gst_rate || 0,
            hsn_code || null, notes || null,
            req.user.id,
        ]);
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateMaterial = async (req, res) => {
    const { id } = req.params;
    const {
        name, type_id, supplier_id, unit, purchase_price, current_cost,
        current_stock, reorder_level, barcode, lot_number, warehouse_id,
        gst_rate, hsn_code, notes, is_active,
    } = req.body;
    try {
        const r = await db.query(`
            UPDATE rm_materials SET
                name=$1, type_id=$2, supplier_id=$3, unit=$4,
                purchase_price=$5, current_cost=$6, current_stock=$7,
                reorder_level=$8, barcode=$9, lot_number=$10,
                warehouse_id=$11, gst_rate=$12, hsn_code=$13,
                notes=$14, is_active=$15
            WHERE id=$16 RETURNING *
        `, [
            name, type_id || null, supplier_id || null, unit || 'meter',
            purchase_price || 0, current_cost || 0, current_stock || 0,
            reorder_level || 0, barcode || null, lot_number || null,
            warehouse_id || null, gst_rate || 0, hsn_code || null,
            notes || null, is_active ?? true, id,
        ]);
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ═══════════════════ PURCHASE HISTORY ═════════════════════════════ */
exports.getPurchaseHistory = async (req, res) => {
    try {
        const { material_id } = req.params;
        const r = await db.query(`
            SELECT p.*, s.name AS supplier_name, u.name AS created_by_name
            FROM   rm_purchases p
            LEFT JOIN inv_suppliers s ON s.id = p.supplier_id
            LEFT JOIN users         u ON u.id = p.created_by
            WHERE  p.material_id = $1
            ORDER  BY p.purchase_date DESC
        `, [material_id]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.addPurchase = async (req, res) => {
    const { material_id } = req.params;
    const { supplier_id, purchase_date, qty, unit_price, invoice_number, notes } = req.body;
    if (!qty || !unit_price || !purchase_date) {
        return res.status(400).json({ error: 'qty, unit_price, purchase_date required' });
    }
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const r = await client.query(`
            INSERT INTO rm_purchases
                (material_id, supplier_id, purchase_date, qty, unit_price, invoice_number, notes, created_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
        `, [material_id, supplier_id || null, purchase_date, qty, unit_price, invoice_number || null, notes || null, req.user.id]);

        // Update material: current stock, purchase price, weighted avg cost
        await client.query(`
            UPDATE rm_materials
            SET current_stock   = current_stock + $1,
                purchase_price  = $2,
                current_cost    = CASE
                    WHEN current_stock + $1 > 0
                    THEN ROUND((current_cost * current_stock + $2 * $1) / (current_stock + $1), 4)
                    ELSE $2
                END
            WHERE id = $3
        `, [qty, unit_price, material_id]);

        await client.query('COMMIT');
        res.status(201).json(r.rows[0]);
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

/* ═══════════════════ FABRIC LOTS ══════════════════════════════════ */
exports.getFabricLots = async (req, res) => {
    try {
        const { material_id } = req.query;
        const conds  = ['1=1'];
        const params = [];
        let i = 1;
        if (material_id) { conds.push(`fl.material_id = $${i++}`); params.push(material_id); }

        const r = await db.query(`
            SELECT fl.*,
                   m.name  AS material_name,
                   m.unit  AS material_unit,
                   s.name  AS supplier_name,
                   w.name  AS warehouse_name
            FROM   rm_fabric_lots fl
            LEFT JOIN rm_materials  m ON m.id = fl.material_id
            LEFT JOIN inv_suppliers s ON s.id = fl.supplier_id
            LEFT JOIN rm_warehouses w ON w.id = fl.warehouse_id
            WHERE  ${conds.join(' AND ')}
            ORDER  BY fl.purchase_date DESC, fl.lot_number
        `, params);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getFabricLot = async (req, res) => {
    try {
        const lot = await db.query(`
            SELECT fl.*,
                   m.name AS material_name,
                   m.unit AS material_unit
            FROM rm_fabric_lots fl
            LEFT JOIN rm_materials m ON m.id = fl.material_id
            WHERE fl.id = $1
        `, [req.params.id]);
        if (!lot.rows.length) return res.status(404).json({ error: 'Not found' });

        const usage = await db.query(`
            SELECT u.*, usr.name AS created_by_name
            FROM rm_fabric_lot_usage u
            LEFT JOIN users usr ON usr.id = u.created_by
            WHERE u.lot_id = $1
            ORDER BY u.used_date DESC
        `, [req.params.id]);

        res.json({ lot: lot.rows[0], usage: usage.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createFabricLot = async (req, res) => {
    const {
        material_id, lot_number, total_qty, total_cost,
        purchase_date, supplier_id, warehouse_id, invoice_number, notes,
    } = req.body;
    if (!material_id || !lot_number || !total_qty || !total_cost || !purchase_date) {
        return res.status(400).json({ error: 'material_id, lot_number, total_qty, total_cost, purchase_date required' });
    }
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const r = await client.query(`
            INSERT INTO rm_fabric_lots
                (material_id, lot_number, total_qty, total_cost, purchase_date,
                 supplier_id, warehouse_id, invoice_number, notes, created_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
        `, [
            material_id, lot_number, total_qty, total_cost, purchase_date,
            supplier_id || null, warehouse_id || null, invoice_number || null,
            notes || null, req.user.id,
        ]);

        // Update material stock
        const costPerUnit = parseFloat(total_cost) / parseFloat(total_qty);
        await client.query(`
            UPDATE rm_materials
            SET current_stock  = current_stock + $1,
                purchase_price = $2,
                current_cost   = CASE
                    WHEN current_stock + $1 > 0
                    THEN ROUND((current_cost * current_stock + $2 * $1) / (current_stock + $1), 4)
                    ELSE $2
                END
            WHERE id = $3
        `, [total_qty, costPerUnit, material_id]);

        await client.query('COMMIT');
        res.status(201).json(r.rows[0]);
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

exports.recordLotUsage = async (req, res) => {
    const { id: lot_id } = req.params;
    const { used_qty, used_date, ref_type, ref_id, note } = req.body;
    if (!used_qty) return res.status(400).json({ error: 'used_qty required' });

    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        // Check available
        const lotRow = await client.query(
            `SELECT available_qty, material_id FROM rm_fabric_lots WHERE id=$1 FOR UPDATE`,
            [lot_id]
        );
        if (!lotRow.rows.length) throw new Error('Lot not found');
        if (parseFloat(lotRow.rows[0].available_qty) < parseFloat(used_qty)) {
            throw new Error(`Only ${lotRow.rows[0].available_qty} available in this lot`);
        }

        await client.query(`
            INSERT INTO rm_fabric_lot_usage (lot_id, used_qty, used_date, ref_type, ref_id, note, created_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [lot_id, used_qty, used_date || new Date().toISOString().split('T')[0], ref_type || null, ref_id || null, note || null, req.user.id]);

        await client.query(`UPDATE rm_fabric_lots SET used_qty = used_qty + $1 WHERE id=$2`, [used_qty, lot_id]);
        await client.query(`UPDATE rm_materials SET current_stock = current_stock - $1 WHERE id=$2`, [used_qty, lotRow.rows[0].material_id]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: e.message });
    } finally { client.release(); }
};

/* ═══════════════════ DASHBOARD STATS ══════════════════════════════ */
exports.getDashboardStats = async (req, res) => {
    try {
        const [totals, lowStock, recentPurchases] = await Promise.all([
            db.query(`
                SELECT COUNT(*) AS total_materials,
                       SUM(current_stock * current_cost) AS total_stock_value,
                       COUNT(*) FILTER (WHERE current_stock <= reorder_level AND reorder_level > 0) AS low_stock_count
                FROM rm_materials WHERE is_active=true
            `),
            db.query(`
                SELECT m.id, m.name, m.current_stock, m.reorder_level, m.unit, mt.name AS type_name
                FROM rm_materials m
                LEFT JOIN rm_material_types mt ON mt.id = m.type_id
                WHERE m.is_active=true AND m.current_stock <= m.reorder_level AND m.reorder_level > 0
                ORDER BY (m.reorder_level - m.current_stock) DESC LIMIT 10
            `),
            db.query(`
                SELECT p.*, m.name AS material_name, s.name AS supplier_name
                FROM rm_purchases p
                LEFT JOIN rm_materials m ON m.id = p.material_id
                LEFT JOIN inv_suppliers s ON s.id = p.supplier_id
                ORDER BY p.purchase_date DESC LIMIT 10
            `),
        ]);
        res.json({
            stats:           totals.rows[0],
            low_stock:       lowStock.rows,
            recent_purchases: recentPurchases.rows,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
