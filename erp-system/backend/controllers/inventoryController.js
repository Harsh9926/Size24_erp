const db = require('../config/db');

// ── Helper: next counter value ────────────────────────────────────────
async function nextCounter(client, key) {
    const r = await client.query(
        `UPDATE inv_counters SET value = value + 1 WHERE key = $1 RETURNING value`,
        [key]
    );
    return r.rows[0].value;
}

// ── Helper: update stock + write ledger entry ────────────────────────
async function updateStock(client, variantId, qtyChange, txnType, refType, refId, note, userId) {
    await client.query(
        `INSERT INTO inv_stock (variant_id, qty, updated_at)
         VALUES ($1, GREATEST(0, $2), NOW())
         ON CONFLICT (variant_id)
         DO UPDATE SET qty = GREATEST(0, inv_stock.qty + $2), updated_at = NOW()`,
        [variantId, qtyChange]
    );
    const stockRow = await client.query('SELECT qty FROM inv_stock WHERE variant_id = $1', [variantId]);
    const qtyAfter = parseFloat(stockRow.rows[0]?.qty || 0);
    await client.query(
        `INSERT INTO inv_stock_ledger (variant_id, txn_type, qty_change, qty_after, ref_type, ref_id, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [variantId, txnType, qtyChange, qtyAfter, refType, refId, note, userId]
    );
}
exports.updateStock = updateStock;

/* ══════════════════════════════════════════════════════════════════
   CATEGORIES
══════════════════════════════════════════════════════════════════ */
exports.getCategories = async (req, res) => {
    try {
        const r = await db.query(
            `SELECT c.*, p.name AS parent_name
             FROM inv_categories c
             LEFT JOIN inv_categories p ON p.id = c.parent_id
             ORDER BY c.name`
        );
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createCategory = async (req, res) => {
    const { name, parent_id } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const r = await db.query(
            `INSERT INTO inv_categories (name, parent_id) VALUES ($1,$2) RETURNING *`,
            [name, parent_id || null]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name, parent_id } = req.body;
    try {
        const r = await db.query(
            `UPDATE inv_categories SET name=$1, parent_id=$2 WHERE id=$3 RETURNING *`,
            [name, parent_id || null, id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ══════════════════════════════════════════════════════════════════
   PRODUCTS (Item Master)
══════════════════════════════════════════════════════════════════ */
exports.getProducts = async (req, res) => {
    try {
        const { search, category_id, active } = req.query;
        const conds = ['1=1'];
        const params = [];
        let i = 1;
        if (search)      { conds.push(`p.name ILIKE $${i++}`); params.push(`%${search}%`); }
        if (category_id) { conds.push(`p.category_id = $${i++}`); params.push(category_id); }
        if (active !== undefined) { conds.push(`p.is_active = $${i++}`); params.push(active === 'true'); }

        const r = await db.query(
            `SELECT p.*, c.name AS category_name,
                    COUNT(DISTINCT v.id) AS variant_count,
                    COALESCE(SUM(s.qty),0) AS total_stock
             FROM inv_products p
             LEFT JOIN inv_categories c ON c.id = p.category_id
             LEFT JOIN inv_variants v ON v.product_id = p.id AND v.is_active = true
             LEFT JOIN inv_stock s ON s.variant_id = v.id
             WHERE ${conds.join(' AND ')}
             GROUP BY p.id, c.name
             ORDER BY p.name`,
            params
        );
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getProduct = async (req, res) => {
    try {
        const prod = await db.query(
            `SELECT p.*, c.name AS category_name FROM inv_products p
             LEFT JOIN inv_categories c ON c.id = p.category_id
             WHERE p.id = $1`, [req.params.id]
        );
        if (!prod.rows.length) return res.status(404).json({ error: 'Not found' });

        const variants = await db.query(
            `SELECT v.*, sc.name AS school_name, COALESCE(s.qty,0) AS stock
             FROM inv_variants v
             LEFT JOIN inv_schools sc ON sc.id = v.school_id
             LEFT JOIN inv_stock s ON s.variant_id = v.id
             WHERE v.product_id = $1
             ORDER BY sc.name, v.size`, [req.params.id]
        );
        res.json({ ...prod.rows[0], variants: variants.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createProduct = async (req, res) => {
    const { name, category_id, article_code, description, unit, gst_rate, hsn_code, min_stock,
            sale_price, purchase_price, disc_on_sale, sale_price_with_tax } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const r = await db.query(
            `INSERT INTO inv_products
             (name, category_id, article_code, description, unit, gst_rate, hsn_code, min_stock,
              sale_price, purchase_price, disc_on_sale, sale_price_with_tax, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
            [name, category_id||null, article_code||null, description||null,
             unit||'pcs', gst_rate||0, hsn_code||null, min_stock||0,
             sale_price||null, purchase_price||null, disc_on_sale||0,
             sale_price_with_tax !== false, req.user.id]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateProduct = async (req, res) => {
    const { name, category_id, article_code, description, unit, gst_rate, hsn_code, min_stock, is_active,
            sale_price, purchase_price, disc_on_sale, sale_price_with_tax } = req.body;
    try {
        const r = await db.query(
            `UPDATE inv_products SET name=$1, category_id=$2, article_code=$3, description=$4,
             unit=$5, gst_rate=$6, hsn_code=$7, min_stock=$8, is_active=$9,
             sale_price=$10, purchase_price=$11, disc_on_sale=$12, sale_price_with_tax=$13
             WHERE id=$14 RETURNING *`,
            [name, category_id||null, article_code||null, description||null,
             unit||'pcs', gst_rate||0, hsn_code||null, min_stock||0, is_active!==false,
             sale_price||null, purchase_price||null, disc_on_sale||0,
             sale_price_with_tax !== false, req.params.id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ══════════════════════════════════════════════════════════════════
   VARIANTS
══════════════════════════════════════════════════════════════════ */
exports.createVariant = async (req, res) => {
    const { product_id, school_id, size, color, sku, barcode, purchase_price, sale_price, mrp } = req.body;
    if (!product_id) return res.status(400).json({ error: 'product_id required' });
    try {
        const r = await db.query(
            `INSERT INTO inv_variants (product_id, school_id, size, color, sku, barcode, purchase_price, sale_price, mrp)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [product_id, school_id||null, size||null, color||null,
             sku||null, barcode||null, purchase_price||0, sale_price||0, mrp||0]
        );
        // Initialize stock record
        await db.query(
            `INSERT INTO inv_stock (variant_id, qty) VALUES ($1, 0) ON CONFLICT DO NOTHING`,
            [r.rows[0].id]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) {
        if (e.code === '23505') return res.status(409).json({ error: 'SKU or barcode already exists' });
        res.status(500).json({ error: e.message });
    }
};

exports.bulkCreateVariants = async (req, res) => {
    // Create variants for all combinations of schools × sizes
    const { product_id, school_ids, sizes, color, purchase_price, sale_price, mrp } = req.body;
    if (!product_id || !sizes?.length) return res.status(400).json({ error: 'product_id and sizes required' });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const created = [];
        const schools = school_ids?.length ? school_ids : [null];
        for (const schoolId of schools) {
            for (const size of sizes) {
                // Build SKU: product_id-school_id-size
                const prodRow = await client.query('SELECT article_code FROM inv_products WHERE id=$1', [product_id]);
                const artCode = prodRow.rows[0]?.article_code || product_id;
                const schoolCode = schoolId ? (await client.query('SELECT code FROM inv_schools WHERE id=$1', [schoolId])).rows[0]?.code || schoolId : 'GEN';
                const sku = `${artCode}-${schoolCode}-${size}`.toUpperCase().replace(/\s+/g, '');

                const r = await client.query(
                    `INSERT INTO inv_variants (product_id, school_id, size, color, sku, purchase_price, sale_price, mrp)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                     ON CONFLICT (sku) DO NOTHING RETURNING *`,
                    [product_id, schoolId, size, color||null, sku, purchase_price||0, sale_price||0, mrp||0]
                );
                if (r.rows.length) {
                    await client.query(
                        `INSERT INTO inv_stock (variant_id, qty) VALUES ($1,0) ON CONFLICT DO NOTHING`,
                        [r.rows[0].id]
                    );
                    created.push(r.rows[0]);
                }
            }
        }
        await client.query('COMMIT');
        res.status(201).json({ created: created.length, variants: created });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

exports.updateVariant = async (req, res) => {
    const { sku, barcode, purchase_price, sale_price, mrp, is_active } = req.body;
    try {
        const r = await db.query(
            `UPDATE inv_variants SET sku=$1, barcode=$2, purchase_price=$3, sale_price=$4, mrp=$5, is_active=$6
             WHERE id=$7 RETURNING *`,
            [sku||null, barcode||null, purchase_price||0, sale_price||0, mrp||0, is_active!==false, req.params.id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
    } catch (e) {
        if (e.code === '23505') return res.status(409).json({ error: 'SKU or barcode already exists' });
        res.status(500).json({ error: e.message });
    }
};

/* ══════════════════════════════════════════════════════════════════
   STOCK
══════════════════════════════════════════════════════════════════ */
exports.getStockSummary = async (req, res) => {
    try {
        const { school_id, category_id, low_stock, search } = req.query;
        const conds = ['v.is_active = true'];
        const params = [];
        let i = 1;
        if (school_id)   { conds.push(`v.school_id = $${i++}`); params.push(school_id); }
        if (category_id) { conds.push(`p.category_id = $${i++}`); params.push(category_id); }
        if (search)      { conds.push(`(p.name ILIKE $${i++} OR v.sku ILIKE $${i-1})`); params.push(`%${search}%`); }

        const r = await db.query(
            `SELECT v.id AS variant_id, p.id AS product_id, p.name AS product_name,
                    c.name AS category_name, sc.name AS school_name,
                    v.size, v.color, v.sku, v.barcode,
                    v.purchase_price, v.sale_price, v.mrp,
                    COALESCE(s.qty,0) AS qty, p.min_stock,
                    CASE WHEN COALESCE(s.qty,0) <= p.min_stock THEN true ELSE false END AS low_stock,
                    COALESCE(s.qty,0) * v.purchase_price AS stock_value
             FROM inv_variants v
             JOIN inv_products p ON p.id = v.product_id
             LEFT JOIN inv_categories c ON c.id = p.category_id
             LEFT JOIN inv_schools sc ON sc.id = v.school_id
             LEFT JOIN inv_stock s ON s.variant_id = v.id
             WHERE ${conds.join(' AND ')}
             ${low_stock === 'true' ? 'AND COALESCE(s.qty,0) <= p.min_stock' : ''}
             ORDER BY p.name, sc.name, v.size`,
            params
        );
        const total_value = r.rows.reduce((sum, row) => sum + parseFloat(row.stock_value || 0), 0);
        res.json({ items: r.rows, total_value, count: r.rows.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getStockLedger = async (req, res) => {
    try {
        const { variant_id, from, to } = req.query;
        const conds = ['1=1'];
        const params = [];
        let i = 1;
        if (variant_id) { conds.push(`sl.variant_id = $${i++}`); params.push(variant_id); }
        if (from)       { conds.push(`sl.created_at >= $${i++}`); params.push(from); }
        if (to)         { conds.push(`sl.created_at <= $${i++}`); params.push(to + ' 23:59:59'); }

        const r = await db.query(
            `SELECT sl.*, v.sku, p.name AS product_name, sc.name AS school_name, v.size,
                    u.name AS created_by_name
             FROM inv_stock_ledger sl
             JOIN inv_variants v ON v.id = sl.variant_id
             JOIN inv_products p ON p.id = v.product_id
             LEFT JOIN inv_schools sc ON sc.id = v.school_id
             LEFT JOIN users u ON u.id = sl.created_by
             WHERE ${conds.join(' AND ')}
             ORDER BY sl.created_at DESC LIMIT 500`,
            params
        );
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createStockAdjustment = async (req, res) => {
    const { items, type, reason, adjustment_date } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'items required' });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const num = await nextCounter(client, 'stock_adjustment');
        const adjNum = `ADJ-${String(num).padStart(5,'0')}`;

        const adj = await client.query(
            `INSERT INTO inv_stock_adjustments (adjustment_number, adjustment_date, type, reason, adjusted_by)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [adjNum, adjustment_date || new Date().toISOString().split('T')[0], type||'correction', reason||null, req.user.id]
        );
        const adjId = adj.rows[0].id;

        for (const item of items) {
            const cur = await client.query('SELECT qty FROM inv_stock WHERE variant_id=$1', [item.variant_id]);
            const curQty = parseFloat(cur.rows[0]?.qty || 0);
            const newQty = parseFloat(item.new_qty);
            const change = newQty - curQty;

            await client.query(
                `INSERT INTO inv_stock_adjustment_items (adjustment_id, variant_id, current_qty, new_qty, qty_change)
                 VALUES ($1,$2,$3,$4,$5)`,
                [adjId, item.variant_id, curQty, newQty, change]
            );
            await updateStock(client, item.variant_id, change, 'adjustment', 'adjustment', adjId, reason, req.user.id);
        }
        await client.query('COMMIT');
        res.status(201).json({ adjustment_number: adjNum, id: adjId });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

/* ══════════════════════════════════════════════════════════════════
   BARCODE
══════════════════════════════════════════════════════════════════ */
exports.lookupBarcode = async (req, res) => {
    const { barcode } = req.params;
    try {
        const r = await db.query(
            `SELECT v.*, p.name AS product_name, p.gst_rate, sc.name AS school_name,
                    COALESCE(s.qty,0) AS stock
             FROM inv_variants v
             JOIN inv_products p ON p.id = v.product_id
             LEFT JOIN inv_schools sc ON sc.id = v.school_id
             LEFT JOIN inv_stock s ON s.variant_id = v.id
             WHERE v.barcode = $1 OR v.sku = $1`,
            [barcode]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Product not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ══════════════════════════════════════════════════════════════════
   DASHBOARD STATS
══════════════════════════════════════════════════════════════════ */
exports.getDashboardStats = async (req, res) => {
    try {
        const [stockVal, lowStock, salesMonth, purchaseMonth, outstanding] = await Promise.all([
            db.query(`SELECT COALESCE(SUM(s.qty * v.purchase_price),0) AS val FROM inv_stock s JOIN inv_variants v ON v.id=s.variant_id`),
            db.query(`SELECT COUNT(*) AS cnt FROM inv_stock s JOIN inv_variants v ON v.id=s.variant_id JOIN inv_products p ON p.id=v.product_id WHERE s.qty <= p.min_stock AND v.is_active=true`),
            db.query(`SELECT COALESCE(SUM(total_amount),0) AS val FROM inv_sales_invoices WHERE invoice_date >= date_trunc('month', CURRENT_DATE) AND status != 'cancelled'`),
            db.query(`SELECT COALESCE(SUM(total_amount),0) AS val FROM inv_purchase_bills WHERE bill_date >= date_trunc('month', CURRENT_DATE) AND status != 'cancelled'`),
            db.query(`SELECT COALESCE(SUM(balance),0) AS recv FROM inv_sales_invoices WHERE status IN ('unpaid','partial') AND status != 'cancelled'`),
        ]);

        const purchaseOutstanding = await db.query(
            `SELECT COALESCE(SUM(balance),0) AS payable FROM inv_purchase_bills WHERE status IN ('unpaid','partial') AND status != 'cancelled'`
        );

        res.json({
            inventory_value:        parseFloat(stockVal.rows[0].val),
            low_stock_count:        parseInt(lowStock.rows[0].cnt),
            sales_this_month:       parseFloat(salesMonth.rows[0].val),
            purchase_this_month:    parseFloat(purchaseMonth.rows[0].val),
            outstanding_receivable: parseFloat(outstanding.rows[0].recv),
            outstanding_payable:    parseFloat(purchaseOutstanding.rows[0].payable),
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
