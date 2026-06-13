const db = require('../config/db');
const { updateStock } = require('./inventoryController');

async function nextCounter(client, key) {
    const r = await client.query(
        `UPDATE inv_counters SET value = value + 1 WHERE key = $1 RETURNING value`, [key]
    );
    return r.rows[0].value;
}

/* ══════════════════════════════════════════════════════════════════
   PURCHASE BILLS — Register
══════════════════════════════════════════════════════════════════ */
exports.getBills = async (req, res) => {
    try {
        const { supplier_id, status, from, to, search } = req.query;
        const conds = ['1=1'];
        const params = [];
        let i = 1;
        if (supplier_id) { conds.push(`b.supplier_id = $${i++}`); params.push(supplier_id); }
        if (status)      { conds.push(`b.status = $${i++}`); params.push(status); }
        if (from)        { conds.push(`b.bill_date >= $${i++}`); params.push(from); }
        if (to)          { conds.push(`b.bill_date <= $${i++}`); params.push(to); }
        if (search)      { conds.push(`(b.bill_number ILIKE $${i++} OR s.name ILIKE $${i-1})`); params.push(`%${search}%`); }

        const r = await db.query(
            `SELECT b.*, s.name AS supplier_name, s.gst_number AS supplier_gst,
                    u.name AS created_by_name
             FROM inv_purchase_bills b
             LEFT JOIN inv_suppliers s ON s.id = b.supplier_id
             LEFT JOIN users u ON u.id = b.created_by
             WHERE ${conds.join(' AND ')}
             ORDER BY b.bill_date DESC, b.id DESC`,
            params
        );
        const totals = r.rows.reduce((acc, row) => ({
            total_amount: acc.total_amount + parseFloat(row.total_amount||0),
            paid_amount:  acc.paid_amount  + parseFloat(row.paid_amount||0),
            balance:      acc.balance      + parseFloat(row.balance||0),
        }), { total_amount:0, paid_amount:0, balance:0 });

        res.json({ bills: r.rows, totals });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getBill = async (req, res) => {
    try {
        const bill = await db.query(
            `SELECT b.*, s.name AS supplier_name, s.gst_number, s.mobile AS supplier_mobile
             FROM inv_purchase_bills b
             LEFT JOIN inv_suppliers s ON s.id = b.supplier_id
             WHERE b.id = $1`, [req.params.id]
        );
        if (!bill.rows.length) return res.status(404).json({ error: 'Not found' });

        const items = await db.query(
            `SELECT i.*, v.sku, v.size, v.color, p.name AS product_name, sc.name AS school_name
             FROM inv_purchase_bill_items i
             JOIN inv_variants v ON v.id = i.variant_id
             JOIN inv_products p ON p.id = v.product_id
             LEFT JOIN inv_schools sc ON sc.id = v.school_id
             WHERE i.bill_id = $1 ORDER BY i.id`, [req.params.id]
        );
        const payments = await db.query(
            `SELECT * FROM inv_purchase_payments WHERE bill_id = $1 ORDER BY payment_date`, [req.params.id]
        );
        res.json({ ...bill.rows[0], items: items.rows, payments: payments.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createBill = async (req, res) => {
    const { supplier_id, bill_number, bill_date, due_date, items, discount, notes } = req.body;
    if (!supplier_id || !items?.length) return res.status(400).json({ error: 'supplier_id and items required' });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Calculate totals
        let subtotal = 0, gstAmount = 0;
        for (const item of items) {
            const lineTotal = parseFloat(item.qty) * parseFloat(item.unit_price);
            const gst = lineTotal * (parseFloat(item.gst_rate||0) / 100);
            subtotal += lineTotal;
            gstAmount += gst;
        }
        const disc = parseFloat(discount || 0);
        const total = subtotal + gstAmount - disc;

        // Auto-number if bill_number not provided
        const num = await nextCounter(client, 'purchase_bill');
        const billNum = bill_number || `PB-${String(num).padStart(5,'0')}`;

        const bill = await client.query(
            `INSERT INTO inv_purchase_bills
                (supplier_id, bill_number, bill_date, due_date, subtotal, discount, gst_amount, total_amount, paid_amount, balance, notes, created_by, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$8,$9,$10,'unpaid') RETURNING *`,
            [supplier_id, billNum, bill_date, due_date||null, subtotal, disc, gstAmount, total, notes||null, req.user.id]
        );
        const billId = bill.rows[0].id;

        for (const item of items) {
            const lineTotal = parseFloat(item.qty) * parseFloat(item.unit_price);
            const gstAmt = lineTotal * (parseFloat(item.gst_rate||0) / 100);
            await client.query(
                `INSERT INTO inv_purchase_bill_items (bill_id, variant_id, qty, unit_price, gst_rate, gst_amount, total_price)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [billId, item.variant_id, item.qty, item.unit_price, item.gst_rate||0, gstAmt, lineTotal + gstAmt]
            );
            // Update stock
            await updateStock(client, item.variant_id, parseFloat(item.qty), 'purchase', 'bill', billId,
                `Purchase bill ${billNum}`, req.user.id);
            // Update variant purchase price
            await client.query(
                `UPDATE inv_variants SET purchase_price = $1 WHERE id = $2`,
                [item.unit_price, item.variant_id]
            );
        }

        // Update supplier balance
        await client.query(
            `UPDATE inv_suppliers SET current_balance = current_balance + $1 WHERE id = $2`,
            [total, supplier_id]
        );

        await client.query('COMMIT');
        res.status(201).json({ id: billId, bill_number: billNum, total_amount: total });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

/* ══════════════════════════════════════════════════════════════════
   PURCHASE PAYMENTS
══════════════════════════════════════════════════════════════════ */
exports.recordPayment = async (req, res) => {
    const { bill_id, supplier_id, amount, payment_date, payment_mode, reference, notes } = req.body;
    if (!supplier_id || !amount) return res.status(400).json({ error: 'supplier_id and amount required' });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const pay = await client.query(
            `INSERT INTO inv_purchase_payments (bill_id, supplier_id, amount, payment_date, payment_mode, reference, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [bill_id||null, supplier_id, amount, payment_date, payment_mode||'cash', reference||null, notes||null, req.user.id]
        );

        if (bill_id) {
            await client.query(
                `UPDATE inv_purchase_bills
                 SET paid_amount = paid_amount + $1,
                     balance = balance - $1,
                     status = CASE WHEN balance - $1 <= 0 THEN 'paid'
                                   WHEN paid_amount + $1 > 0 THEN 'partial'
                                   ELSE status END
                 WHERE id = $2`,
                [amount, bill_id]
            );
        }
        // Reduce supplier balance
        await client.query(
            `UPDATE inv_suppliers SET current_balance = current_balance - $1 WHERE id = $2`,
            [amount, supplier_id]
        );

        await client.query('COMMIT');
        res.status(201).json(pay.rows[0]);
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

/* ══════════════════════════════════════════════════════════════════
   PURCHASE RETURNS
══════════════════════════════════════════════════════════════════ */
exports.createReturn = async (req, res) => {
    const { bill_id, supplier_id, items, reason, return_date } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'items required' });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const num = await nextCounter(client, 'purchase_return');
        const retNum = `PR-${String(num).padStart(5,'0')}`;
        let total = 0;
        for (const item of items) total += parseFloat(item.qty) * parseFloat(item.unit_price);

        const ret = await client.query(
            `INSERT INTO inv_purchase_returns (bill_id, supplier_id, return_number, return_date, reason, total_amount, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [bill_id||null, supplier_id||null, retNum, return_date, reason||null, total, req.user.id]
        );
        for (const item of items) {
            await client.query(
                `INSERT INTO inv_purchase_return_items (return_id, variant_id, qty, unit_price, total_price)
                 VALUES ($1,$2,$3,$4,$5)`,
                [ret.rows[0].id, item.variant_id, item.qty, item.unit_price, parseFloat(item.qty)*parseFloat(item.unit_price)]
            );
            await updateStock(client, item.variant_id, -parseFloat(item.qty), 'purchase_return', 'purchase_return', ret.rows[0].id, reason, req.user.id);
        }
        await client.query('COMMIT');
        res.status(201).json({ id: ret.rows[0].id, return_number: retNum });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};
