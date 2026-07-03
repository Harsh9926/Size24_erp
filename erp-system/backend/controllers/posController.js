const db = require('../config/db');
const { updateStock } = require('./inventoryController');

async function nextCounter(client, key) {
    const r = await client.query(
        `UPDATE inv_counters SET value = value + 1 WHERE key = $1 RETURNING value`, [key]
    );
    return r.rows[0].value;
}

/* ══════════════════════════════════════════════════════════════════
   PRODUCT SEARCH — fast debounced search for POS
══════════════════════════════════════════════════════════════════ */
exports.searchProducts = async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 1) return res.json([]);
    const term = q.trim();
    try {
        const r = await db.query(`
            SELECT
                v.id            AS variant_id,
                p.id            AS product_id,
                p.name          AS product_name,
                v.sku,
                v.barcode,
                v.size,
                v.color,
                COALESCE(v.sale_price, p.sale_price, 0) AS sale_price,
                COALESCE(v.mrp, p.sale_price, 0)        AS mrp,
                COALESCE(p.gst_rate, 0)                 AS gst_rate,
                COALESCE(p.disc_on_sale, 0)             AS disc_on_sale,
                COALESCE(st.qty, 0)                     AS stock,
                sc.name   AS school_name,
                cat.name  AS category_name,
                p.hsn_code,
                p.unit
            FROM inv_variants v
            JOIN inv_products p   ON p.id = v.product_id
            LEFT JOIN inv_stock st ON st.variant_id = v.id
            LEFT JOIN inv_schools sc  ON sc.id = v.school_id
            LEFT JOIN inv_categories cat ON cat.id = p.category_id
            WHERE v.is_active = true AND p.is_active = true
              AND (
                p.name        ILIKE $1
                OR v.sku      ILIKE $1
                OR v.barcode  ILIKE $1
                OR sc.name    ILIKE $1
                OR cat.name   ILIKE $1
                OR v.color    ILIKE $1
                OR v.size     ILIKE $1
                OR p.article_code ILIKE $1
              )
            ORDER BY
                CASE WHEN v.barcode = $2 THEN 0
                     WHEN v.sku    = $2 THEN 1
                     WHEN p.name ILIKE $2 THEN 2
                     ELSE 3 END,
                COALESCE(st.qty, 0) DESC NULLS LAST
            LIMIT 25
        `, [`%${term}%`, term]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ══════════════════════════════════════════════════════════════════
   BARCODE EXACT LOOKUP
══════════════════════════════════════════════════════════════════ */
exports.lookupBarcode = async (req, res) => {
    const { code } = req.params;
    try {
        const r = await db.query(`
            SELECT v.id AS variant_id, p.id AS product_id, p.name AS product_name,
                   v.sku, v.barcode, v.size, v.color,
                   COALESCE(v.sale_price, p.sale_price, 0) AS sale_price,
                   COALESCE(v.mrp, p.sale_price, 0) AS mrp,
                   COALESCE(p.gst_rate, 0) AS gst_rate,
                   COALESCE(p.disc_on_sale, 0) AS disc_on_sale,
                   COALESCE(st.qty, 0) AS stock,
                   sc.name AS school_name, p.hsn_code, p.unit
            FROM inv_variants v
            JOIN inv_products p ON p.id = v.product_id
            LEFT JOIN inv_stock st ON st.variant_id = v.id
            LEFT JOIN inv_schools sc ON sc.id = v.school_id
            WHERE (v.barcode = $1 OR v.sku = $1) AND v.is_active = true
            LIMIT 1
        `, [code]);
        if (!r.rows.length) return res.status(404).json({ error: 'Product not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ══════════════════════════════════════════════════════════════════
   CUSTOMER SEARCH
══════════════════════════════════════════════════════════════════ */
exports.searchCustomers = async (req, res) => {
    const { q } = req.query;
    try {
        const term = (q || '').trim();
        const r = await db.query(`
            SELECT c.id, c.name, c.mobile, c.gst_number, c.address, c.school_id,
                   c.opening_balance, c.current_balance,
                   COALESCE(c.loyalty_points, 0) AS loyalty_points,
                   sc.name AS school_name
            FROM inv_customers c
            LEFT JOIN inv_schools sc ON sc.id = c.school_id
            WHERE c.is_active = true
              AND ($1 = '' OR c.name ILIKE $2 OR c.mobile ILIKE $2)
            ORDER BY c.name
            LIMIT 20
        `, [term, `%${term}%`]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ══════════════════════════════════════════════════════════════════
   QUICK CREATE CUSTOMER
══════════════════════════════════════════════════════════════════ */
exports.createCustomer = async (req, res) => {
    const { name, mobile, address, school_id, gst_number, email } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const r = await db.query(
            `INSERT INTO inv_customers (name, mobile, address, school_id, gst_number, email)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [name, mobile||null, address||null, school_id||null, gst_number||null, email||null]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ══════════════════════════════════════════════════════════════════
   CUSTOMER PROFILE — balance, loyalty, purchase history
══════════════════════════════════════════════════════════════════ */
exports.getCustomerProfile = async (req, res) => {
    const { id } = req.params;
    try {
        const c = await db.query(`
            SELECT c.*, COALESCE(c.loyalty_points, 0) AS loyalty_points, sc.name AS school_name
            FROM inv_customers c
            LEFT JOIN inv_schools sc ON sc.id = c.school_id
            WHERE c.id = $1
        `, [id]);
        if (!c.rows.length) return res.status(404).json({ error: 'Customer not found' });

        const history = await db.query(`
            SELECT id, invoice_number, invoice_date, total_amount, paid_amount, balance, status
            FROM inv_sales_invoices
            WHERE customer_id = $1
            ORDER BY invoice_date DESC, id DESC
            LIMIT 10
        `, [id]);

        const loyaltyLog = await db.query(`
            SELECT type, points, balance_after, note, created_at
            FROM pos_loyalty_transactions
            WHERE customer_id = $1
            ORDER BY created_at DESC
            LIMIT 5
        `, [id]);

        res.json({
            ...c.rows[0],
            recent_invoices: history.rows,
            loyalty_history: loyaltyLog.rows,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ══════════════════════════════════════════════════════════════════
   CREATE POS INVOICE — invoice + payment(s) in one atomic transaction
══════════════════════════════════════════════════════════════════ */
exports.createPOSInvoice = async (req, res) => {
    const {
        customer_id,
        invoice_date,
        due_date,
        items,
        discount = 0,
        notes,
        payments = [],   // [{ mode:'cash'|'upi'|'card'|'bank'|'wallet', amount, reference }]
        redeem_points = 0,
    } = req.body;

    if (!items?.length) return res.status(400).json({ error: 'items required' });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // ── Totals calculation ────────────────────────────────────
        let subtotal = 0, gstAmount = 0;
        for (const item of items) {
            const base = parseFloat(item.qty) * parseFloat(item.unit_price)
                       - parseFloat(item.discount || 0);
            subtotal  += parseFloat(item.qty) * parseFloat(item.unit_price);
            gstAmount += base * (parseFloat(item.gst_rate || 0) / 100);
        }
        const discDoc    = parseFloat(discount);
        const pointsVal  = parseFloat(redeem_points);          // 1 point = ₹1
        const total      = subtotal - discDoc + gstAmount - pointsVal;
        const totalPaid  = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);

        let invStatus = 'unpaid';
        if (totalPaid >= total - 0.01)      invStatus = 'paid';
        else if (totalPaid > 0)             invStatus = 'partial';
        if (!customer_id && totalPaid < total) invStatus = 'unpaid';

        // Derive primary payment mode for quick display
        const primaryMode = payments.length === 1
            ? payments[0].mode
            : payments.length > 1 ? 'split' : null;

        // ── Create invoice ────────────────────────────────────────
        const num    = await nextCounter(client, 'sales_invoice');
        const invNum = `INV-${String(num).padStart(5, '0')}`;

        const inv = await client.query(
            `INSERT INTO inv_sales_invoices
                (customer_id, invoice_number, invoice_date, due_date,
                 subtotal, discount, gst_amount, total_amount,
                 paid_amount, balance, notes, status, payment_mode, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
            [customer_id || null, invNum, invoice_date, due_date || null,
             subtotal, discDoc + pointsVal, gstAmount, total,
             totalPaid, total - totalPaid,
             notes || null, invStatus, primaryMode, req.user.id]
        );
        const invId = inv.rows[0].id;

        // ── Line items + stock deduction ──────────────────────────
        for (const item of items) {
            const base    = parseFloat(item.qty) * parseFloat(item.unit_price)
                          - parseFloat(item.discount || 0);
            const gstAmt  = base * (parseFloat(item.gst_rate || 0) / 100);
            await client.query(
                `INSERT INTO inv_sales_invoice_items
                    (invoice_id, variant_id, qty, unit_price, discount, gst_rate, gst_amount, total_price)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [invId, item.variant_id, item.qty, item.unit_price,
                 item.discount || 0, item.gst_rate || 0, gstAmt, base + gstAmt]
            );
            await updateStock(client, item.variant_id, -parseFloat(item.qty),
                'sale', 'invoice', invId, `Sale ${invNum}`, req.user.id);
        }

        // ── Record split payments ─────────────────────────────────
        for (const pay of payments) {
            const amt = parseFloat(pay.amount || 0);
            if (amt <= 0) continue;
            await client.query(
                `INSERT INTO inv_sales_payments
                    (invoice_id, customer_id, amount, payment_date, payment_mode, reference, created_by)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [invId, customer_id || null, amt, invoice_date,
                 pay.mode || 'cash', pay.reference || null, req.user.id]
            );
        }

        // ── Customer balance + loyalty ────────────────────────────
        if (customer_id) {
            const netDue = total - totalPaid;
            if (netDue > 0.01) {
                await client.query(
                    `UPDATE inv_customers SET current_balance = current_balance + $1 WHERE id = $2`,
                    [netDue, customer_id]
                );
            }

            // Redeem points
            if (pointsVal > 0 && parseInt(redeem_points) > 0) {
                const pts = parseInt(redeem_points);
                const balR = await client.query(
                    `SELECT COALESCE(loyalty_points, 0) AS pts FROM inv_customers WHERE id = $1`, [customer_id]
                );
                const newBal = Math.max(0, (balR.rows[0]?.pts || 0) - pts);
                await client.query(
                    `UPDATE inv_customers SET loyalty_points = $1 WHERE id = $2`, [newBal, customer_id]
                );
                await client.query(
                    `INSERT INTO pos_loyalty_transactions
                        (customer_id, invoice_id, type, points, balance_after, note, created_by)
                     VALUES ($1,$2,'redeem',$3,$4,'Redeemed on invoice',$5)`,
                    [customer_id, invId, pts, newBal, req.user.id]
                );
            }

            // Earn points: 1 point per ₹100 spent
            const earned = Math.floor(total / 100);
            if (earned > 0) {
                const balR = await client.query(
                    `SELECT COALESCE(loyalty_points, 0) AS pts FROM inv_customers WHERE id = $1`, [customer_id]
                );
                const newBal = (balR.rows[0]?.pts || 0) + earned;
                await client.query(
                    `UPDATE inv_customers SET loyalty_points = $1 WHERE id = $2`, [newBal, customer_id]
                );
                await client.query(
                    `INSERT INTO pos_loyalty_transactions
                        (customer_id, invoice_id, type, points, balance_after, note, created_by)
                     VALUES ($1,$2,'earn',$3,$4,'Earned on purchase',$5)`,
                    [customer_id, invId, earned, newBal, req.user.id]
                );
            }
        }

        await client.query('COMMIT');

        // Return full invoice for print
        const full = await db.query(`
            SELECT inv.*, c.name AS customer_name, c.mobile AS customer_mobile,
                   c.gst_number AS customer_gst, c.address AS customer_address,
                   sc.name AS school_name
            FROM inv_sales_invoices inv
            LEFT JOIN inv_customers c ON c.id = inv.customer_id
            LEFT JOIN inv_schools sc  ON sc.id = c.school_id
            WHERE inv.id = $1
        `, [invId]);

        const invItems = await db.query(`
            SELECT i.*, v.sku, v.size, v.color, p.name AS product_name,
                   p.hsn_code, sc.name AS school_name
            FROM inv_sales_invoice_items i
            JOIN inv_variants v  ON v.id = i.variant_id
            JOIN inv_products p  ON p.id = v.product_id
            LEFT JOIN inv_schools sc ON sc.id = v.school_id
            WHERE i.invoice_id = $1 ORDER BY i.id
        `, [invId]);

        res.status(201).json({
            ...full.rows[0],
            items: invItems.rows,
            payments,
        });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

/* ══════════════════════════════════════════════════════════════════
   GET INVOICE FOR RETURN (POS return flow)
══════════════════════════════════════════════════════════════════ */
exports.getInvoiceForReturn = async (req, res) => {
    try {
        const inv = await db.query(`
            SELECT inv.*, c.name AS customer_name, c.mobile AS customer_mobile
            FROM inv_sales_invoices inv
            LEFT JOIN inv_customers c ON c.id = inv.customer_id
            WHERE inv.invoice_number ILIKE $1 OR inv.id::text = $1
            LIMIT 1
        `, [req.params.ref]);
        if (!inv.rows.length) return res.status(404).json({ error: 'Invoice not found' });

        const items = await db.query(`
            SELECT i.*, v.sku, v.size, v.color, p.name AS product_name
            FROM inv_sales_invoice_items i
            JOIN inv_variants v ON v.id = i.variant_id
            JOIN inv_products p ON p.id = v.product_id
            WHERE i.invoice_id = $1 ORDER BY i.id
        `, [inv.rows[0].id]);

        res.json({ ...inv.rows[0], items: items.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ══════════════════════════════════════════════════════════════════
   POS RETURN — process return with stock reinstatement
══════════════════════════════════════════════════════════════════ */
exports.processPOSReturn = async (req, res) => {
    const { invoice_id, customer_id, items, reason, return_date, refund_mode } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'items required' });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const num    = await nextCounter(client, 'sales_return');
        const retNum = `SR-${String(num).padStart(5, '0')}`;

        let total = 0;
        for (const item of items) {
            total += parseFloat(item.qty) * parseFloat(item.unit_price);
        }

        const ret = await client.query(
            `INSERT INTO inv_sales_returns
                (invoice_id, customer_id, return_number, return_date, reason, total_amount, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [invoice_id || null, customer_id || null, retNum, return_date, reason || null, total, req.user.id]
        );

        for (const item of items) {
            await client.query(
                `INSERT INTO inv_sales_return_items (return_id, variant_id, qty, unit_price, total_price)
                 VALUES ($1,$2,$3,$4,$5)`,
                [ret.rows[0].id, item.variant_id, item.qty, item.unit_price,
                 parseFloat(item.qty) * parseFloat(item.unit_price)]
            );
            await updateStock(client, item.variant_id, parseFloat(item.qty),
                'sale_return', 'sale_return', ret.rows[0].id, reason, req.user.id);
        }

        // Reduce customer outstanding if credit sale
        if (customer_id && !refund_mode) {
            await client.query(
                `UPDATE inv_customers SET current_balance = current_balance - $1 WHERE id = $2`,
                [total, customer_id]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ id: ret.rows[0].id, return_number: retNum, total_amount: total });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

/* ══════════════════════════════════════════════════════════════════
   POS DASHBOARD — today's stats, hourly, payment breakdown
══════════════════════════════════════════════════════════════════ */
exports.getDashboard = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const stats = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE invoice_date = $1 AND status != 'cancelled')          AS today_orders,
                COALESCE(SUM(total_amount) FILTER (WHERE invoice_date = $1 AND status != 'cancelled'), 0) AS today_sales,
                COALESCE(SUM(paid_amount)  FILTER (WHERE invoice_date = $1 AND status != 'cancelled'), 0) AS today_collected,
                COALESCE(SUM(balance)      FILTER (WHERE invoice_date = $1 AND status NOT IN ('paid','cancelled')), 0) AS today_outstanding,
                COUNT(*) FILTER (WHERE DATE_TRUNC('month', invoice_date::date) = DATE_TRUNC('month', CURRENT_DATE) AND status != 'cancelled') AS month_orders,
                COALESCE(SUM(total_amount) FILTER (WHERE DATE_TRUNC('month', invoice_date::date) = DATE_TRUNC('month', CURRENT_DATE) AND status != 'cancelled'), 0) AS month_sales
            FROM inv_sales_invoices
        `, [today]);

        const payBreakdown = await db.query(`
            SELECT payment_mode, SUM(amount) AS total, COUNT(*) AS txns
            FROM inv_sales_payments
            WHERE payment_date = $1
            GROUP BY payment_mode
            ORDER BY total DESC
        `, [today]);

        const topProducts = await db.query(`
            SELECT p.name AS product_name,
                   SUM(i.qty)         AS total_qty,
                   SUM(i.total_price) AS total_amount
            FROM inv_sales_invoice_items i
            JOIN inv_variants  v   ON v.id  = i.variant_id
            JOIN inv_products  p   ON p.id  = v.product_id
            JOIN inv_sales_invoices inv ON inv.id = i.invoice_id
            WHERE inv.invoice_date = $1 AND inv.status != 'cancelled'
            GROUP BY p.name
            ORDER BY total_amount DESC
            LIMIT 5
        `, [today]);

        const topCustomers = await db.query(`
            SELECT c.name, c.mobile,
                   SUM(inv.total_amount) AS total_spent,
                   COUNT(*)              AS orders
            FROM inv_sales_invoices inv
            JOIN inv_customers c ON c.id = inv.customer_id
            WHERE inv.invoice_date = $1 AND inv.status != 'cancelled'
            GROUP BY c.id, c.name, c.mobile
            ORDER BY total_spent DESC
            LIMIT 5
        `, [today]);

        const hourly = await db.query(`
            SELECT
                EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')::int AS hour,
                COUNT(*)          AS orders,
                SUM(total_amount) AS sales
            FROM inv_sales_invoices
            WHERE invoice_date = $1 AND status != 'cancelled'
            GROUP BY hour
            ORDER BY hour
        `, [today]);

        const recentInvoices = await db.query(`
            SELECT inv.id, inv.invoice_number, inv.total_amount, inv.status, inv.payment_mode,
                   c.name AS customer_name
            FROM inv_sales_invoices inv
            LEFT JOIN inv_customers c ON c.id = inv.customer_id
            WHERE inv.invoice_date = $1
            ORDER BY inv.id DESC
            LIMIT 10
        `, [today]);

        res.json({
            stats:            stats.rows[0],
            payment_breakdown: payBreakdown.rows,
            top_products:     topProducts.rows,
            top_customers:    topCustomers.rows,
            hourly_sales:     hourly.rows,
            recent_invoices:  recentInvoices.rows,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ══════════════════════════════════════════════════════════════════
   CREATE DELIVERY CHALLAN
══════════════════════════════════════════════════════════════════ */
exports.createChallan = async (req, res) => {
    const { invoice_id, customer_id, challan_date, courier_name, tracking_number, notes } = req.body;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const num = await nextCounter(client, 'delivery_challan');
        const challanNum = `DC-${String(num).padStart(5, '0')}`;
        const r = await client.query(
            `INSERT INTO pos_delivery_challans
                (challan_number, invoice_id, customer_id, challan_date, courier_name, tracking_number, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [challanNum, invoice_id || null, customer_id || null, challan_date,
             courier_name || null, tracking_number || null, notes || null, req.user.id]
        );
        await client.query('COMMIT');
        res.status(201).json(r.rows[0]);
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};
