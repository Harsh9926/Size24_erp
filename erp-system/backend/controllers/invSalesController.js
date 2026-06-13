const db = require('../config/db');
const { updateStock } = require('./inventoryController');

async function nextCounter(client, key) {
    const r = await client.query(
        `UPDATE inv_counters SET value = value + 1 WHERE key = $1 RETURNING value`, [key]
    );
    return r.rows[0].value;
}

/* ══════════════════════════════════════════════════════════════════
   SALES INVOICES
══════════════════════════════════════════════════════════════════ */
exports.getInvoices = async (req, res) => {
    try {
        const { customer_id, status, from, to, search } = req.query;
        const conds = ['1=1'];
        const params = [];
        let i = 1;
        if (customer_id) { conds.push(`inv.customer_id = $${i++}`); params.push(customer_id); }
        if (status)      { conds.push(`inv.status = $${i++}`); params.push(status); }
        if (from)        { conds.push(`inv.invoice_date >= $${i++}`); params.push(from); }
        if (to)          { conds.push(`inv.invoice_date <= $${i++}`); params.push(to); }
        if (search)      { conds.push(`(inv.invoice_number ILIKE $${i++} OR c.name ILIKE $${i-1})`); params.push(`%${search}%`); }

        const r = await db.query(
            `SELECT inv.*, c.name AS customer_name, c.mobile AS customer_mobile,
                    u.name AS created_by_name,
                    (SELECT UPPER(payment_mode) FROM inv_sales_payments
                     WHERE invoice_id = inv.id ORDER BY id DESC LIMIT 1) AS payment_mode
             FROM inv_sales_invoices inv
             LEFT JOIN inv_customers c ON c.id = inv.customer_id
             LEFT JOIN users u ON u.id = inv.created_by
             WHERE ${conds.join(' AND ')}
             ORDER BY inv.invoice_date DESC, inv.id DESC`,
            params
        );
        const totals = r.rows.reduce((acc, row) => ({
            total_amount: acc.total_amount + parseFloat(row.total_amount||0),
            paid_amount:  acc.paid_amount  + parseFloat(row.paid_amount||0),
            balance:      acc.balance      + parseFloat(row.balance||0),
        }), { total_amount:0, paid_amount:0, balance:0 });

        res.json({ invoices: r.rows, totals });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getInvoice = async (req, res) => {
    try {
        const inv = await db.query(
            `SELECT inv.*, c.name AS customer_name, c.mobile, c.gst_number AS customer_gst,
                    sc.name AS school_name
             FROM inv_sales_invoices inv
             LEFT JOIN inv_customers c ON c.id = inv.customer_id
             LEFT JOIN inv_schools sc ON sc.id = c.school_id
             WHERE inv.id = $1`, [req.params.id]
        );
        if (!inv.rows.length) return res.status(404).json({ error: 'Not found' });

        const items = await db.query(
            `SELECT i.*, v.sku, v.size, v.color, p.name AS product_name, sc.name AS school_name
             FROM inv_sales_invoice_items i
             JOIN inv_variants v ON v.id = i.variant_id
             JOIN inv_products p ON p.id = v.product_id
             LEFT JOIN inv_schools sc ON sc.id = v.school_id
             WHERE i.invoice_id = $1 ORDER BY i.id`, [req.params.id]
        );
        const payments = await db.query(
            `SELECT * FROM inv_sales_payments WHERE invoice_id = $1 ORDER BY payment_date`, [req.params.id]
        );
        res.json({ ...inv.rows[0], items: items.rows, payments: payments.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createInvoice = async (req, res) => {
    const { customer_id, invoice_date, due_date, items, discount, notes, status } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'items required' });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        let subtotal = 0, gstAmount = 0;
        for (const item of items) {
            const lineTotal = parseFloat(item.qty) * parseFloat(item.unit_price) - parseFloat(item.discount||0);
            const gst = lineTotal * (parseFloat(item.gst_rate||0) / 100);
            subtotal += parseFloat(item.qty) * parseFloat(item.unit_price);
            gstAmount += gst;
        }
        const disc = parseFloat(discount || 0);
        const total = subtotal - disc + gstAmount;

        const num = await nextCounter(client, 'sales_invoice');
        const invNum = `INV-${String(num).padStart(5,'0')}`;
        const invStatus = status || (customer_id ? 'unpaid' : 'paid');

        const inv = await client.query(
            `INSERT INTO inv_sales_invoices
                (customer_id, invoice_number, invoice_date, due_date, subtotal, discount, gst_amount,
                 total_amount, paid_amount, balance, notes, status, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$8,$9,$10,$11) RETURNING *`,
            [customer_id||null, invNum, invoice_date, due_date||null, subtotal, disc, gstAmount,
             total, notes||null, invStatus, req.user.id]
        );
        const invId = inv.rows[0].id;

        for (const item of items) {
            const lineTotal = parseFloat(item.qty) * parseFloat(item.unit_price) - parseFloat(item.discount||0);
            const gstAmt = lineTotal * (parseFloat(item.gst_rate||0) / 100);
            await client.query(
                `INSERT INTO inv_sales_invoice_items (invoice_id, variant_id, qty, unit_price, discount, gst_rate, gst_amount, total_price)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [invId, item.variant_id, item.qty, item.unit_price, item.discount||0, item.gst_rate||0, gstAmt, lineTotal + gstAmt]
            );
            // Deduct stock
            await updateStock(client, item.variant_id, -parseFloat(item.qty), 'sale', 'invoice', invId,
                `Sale invoice ${invNum}`, req.user.id);
        }

        if (customer_id) {
            await client.query(
                `UPDATE inv_customers SET current_balance = current_balance + $1 WHERE id = $2`,
                [total, customer_id]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ id: invId, invoice_number: invNum, total_amount: total });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

/* ══════════════════════════════════════════════════════════════════
   SALES PAYMENTS
══════════════════════════════════════════════════════════════════ */
exports.recordPayment = async (req, res) => {
    const { invoice_id, customer_id, amount, payment_date, payment_mode, reference, notes } = req.body;
    if (!amount) return res.status(400).json({ error: 'amount required' });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const pay = await client.query(
            `INSERT INTO inv_sales_payments (invoice_id, customer_id, amount, payment_date, payment_mode, reference, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [invoice_id||null, customer_id||null, amount, payment_date, payment_mode||'cash', reference||null, notes||null, req.user.id]
        );
        if (invoice_id) {
            await client.query(
                `UPDATE inv_sales_invoices
                 SET paid_amount = paid_amount + $1,
                     balance = balance - $1,
                     status = CASE WHEN balance - $1 <= 0 THEN 'paid'
                                   WHEN paid_amount + $1 > 0 THEN 'partial'
                                   ELSE status END
                 WHERE id = $2`,
                [amount, invoice_id]
            );
        }
        if (customer_id) {
            await client.query(
                `UPDATE inv_customers SET current_balance = current_balance - $1 WHERE id = $2`,
                [amount, customer_id]
            );
        }
        await client.query('COMMIT');
        res.status(201).json(pay.rows[0]);
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

/* ══════════════════════════════════════════════════════════════════
   SALES RETURNS
══════════════════════════════════════════════════════════════════ */
exports.createReturn = async (req, res) => {
    const { invoice_id, customer_id, items, reason, return_date } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'items required' });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const num = await nextCounter(client, 'sales_return');
        const retNum = `SR-${String(num).padStart(5,'0')}`;
        let total = 0;
        for (const item of items) total += parseFloat(item.qty) * parseFloat(item.unit_price);

        const ret = await client.query(
            `INSERT INTO inv_sales_returns (invoice_id, customer_id, return_number, return_date, reason, total_amount, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [invoice_id||null, customer_id||null, retNum, return_date, reason||null, total, req.user.id]
        );
        for (const item of items) {
            await client.query(
                `INSERT INTO inv_sales_return_items (return_id, variant_id, qty, unit_price, total_price)
                 VALUES ($1,$2,$3,$4,$5)`,
                [ret.rows[0].id, item.variant_id, item.qty, item.unit_price, parseFloat(item.qty)*parseFloat(item.unit_price)]
            );
            // Return to stock
            await updateStock(client, item.variant_id, parseFloat(item.qty), 'sale_return', 'sale_return', ret.rows[0].id, reason, req.user.id);
        }
        await client.query('COMMIT');
        res.status(201).json({ id: ret.rows[0].id, return_number: retNum });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

/* ══════════════════════════════════════════════════════════════════
   REPORTS
══════════════════════════════════════════════════════════════════ */
exports.getSalesReport = async (req, res) => {
    try {
        const { from, to, customer_id, school_id } = req.query;
        const conds = ["inv.status != 'cancelled'"];
        const params = [];
        let i = 1;
        if (from)        { conds.push(`inv.invoice_date >= $${i++}`); params.push(from); }
        if (to)          { conds.push(`inv.invoice_date <= $${i++}`); params.push(to); }
        if (customer_id) { conds.push(`inv.customer_id = $${i++}`); params.push(customer_id); }
        if (school_id)   { conds.push(`c.school_id = $${i++}`); params.push(school_id); }

        const r = await db.query(
            `SELECT inv.invoice_date, inv.invoice_number, c.name AS customer_name,
                    sc.name AS school_name, inv.total_amount, inv.paid_amount, inv.balance, inv.status
             FROM inv_sales_invoices inv
             LEFT JOIN inv_customers c ON c.id = inv.customer_id
             LEFT JOIN inv_schools sc ON sc.id = c.school_id
             WHERE ${conds.join(' AND ')}
             ORDER BY inv.invoice_date DESC`, params
        );
        const summary = r.rows.reduce((a, r) => ({
            total: a.total + parseFloat(r.total_amount||0),
            paid: a.paid + parseFloat(r.paid_amount||0),
            balance: a.balance + parseFloat(r.balance||0),
        }), { total:0, paid:0, balance:0 });

        res.json({ data: r.rows, summary });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
