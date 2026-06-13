const db = require('../config/db');

/* ══════════════════════════════════════════════════════════════════
   SUPPLIERS
══════════════════════════════════════════════════════════════════ */
exports.getSuppliers = async (req, res) => {
    try {
        const { search, active } = req.query;
        const conds = ['1=1'];
        const params = [];
        let i = 1;
        if (search) { conds.push(`s.name ILIKE $${i++}`); params.push(`%${search}%`); }
        if (active !== undefined) { conds.push(`s.is_active = $${i++}`); params.push(active === 'true'); }

        const r = await db.query(
            `SELECT s.*,
                    COUNT(DISTINCT b.id) AS total_bills,
                    COALESCE(SUM(b.total_amount),0) AS total_purchase,
                    COALESCE(SUM(b.balance),0) AS outstanding
             FROM inv_suppliers s
             LEFT JOIN inv_purchase_bills b ON b.supplier_id = s.id AND b.status != 'cancelled'
             WHERE ${conds.join(' AND ')}
             GROUP BY s.id ORDER BY s.name`, params
        );
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getSupplier = async (req, res) => {
    try {
        const s = await db.query('SELECT * FROM inv_suppliers WHERE id=$1', [req.params.id]);
        if (!s.rows.length) return res.status(404).json({ error: 'Not found' });

        const bills = await db.query(
            `SELECT id, bill_number, bill_date, due_date, total_amount, paid_amount, balance, status
             FROM inv_purchase_bills WHERE supplier_id=$1 ORDER BY bill_date DESC LIMIT 50`,
            [req.params.id]
        );
        const payments = await db.query(
            `SELECT * FROM inv_purchase_payments WHERE supplier_id=$1 ORDER BY payment_date DESC LIMIT 50`,
            [req.params.id]
        );
        res.json({ ...s.rows[0], bills: bills.rows, payments: payments.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createSupplier = async (req, res) => {
    const { name, gst_number, mobile, email, address, credit_days, credit_limit, opening_balance } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const r = await db.query(
            `INSERT INTO inv_suppliers (name, gst_number, mobile, email, address, credit_days, credit_limit, opening_balance, current_balance)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *`,
            [name, gst_number||null, mobile||null, email||null, address||null,
             credit_days||0, credit_limit||0, opening_balance||0]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateSupplier = async (req, res) => {
    const { name, gst_number, mobile, email, address, credit_days, credit_limit, is_active } = req.body;
    try {
        const r = await db.query(
            `UPDATE inv_suppliers SET name=$1, gst_number=$2, mobile=$3, email=$4, address=$5,
             credit_days=$6, credit_limit=$7, is_active=$8
             WHERE id=$9 RETURNING *`,
            [name, gst_number||null, mobile||null, email||null, address||null,
             credit_days||0, credit_limit||0, is_active!==false, req.params.id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ══════════════════════════════════════════════════════════════════
   CUSTOMERS
══════════════════════════════════════════════════════════════════ */
exports.getCustomers = async (req, res) => {
    try {
        const { search, school_id, active } = req.query;
        const conds = ['1=1'];
        const params = [];
        let i = 1;
        if (search)   { conds.push(`c.name ILIKE $${i++}`); params.push(`%${search}%`); }
        if (school_id){ conds.push(`c.school_id = $${i++}`); params.push(school_id); }
        if (active !== undefined) { conds.push(`c.is_active = $${i++}`); params.push(active === 'true'); }

        const r = await db.query(
            `SELECT c.*, sc.name AS school_name,
                    COUNT(DISTINCT inv.id) AS total_invoices,
                    COALESCE(SUM(inv.total_amount),0) AS total_sales,
                    COALESCE(SUM(inv.balance),0) AS outstanding
             FROM inv_customers c
             LEFT JOIN inv_schools sc ON sc.id = c.school_id
             LEFT JOIN inv_sales_invoices inv ON inv.customer_id = c.id AND inv.status != 'cancelled'
             WHERE ${conds.join(' AND ')}
             GROUP BY c.id, sc.name ORDER BY c.name`, params
        );
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getCustomer = async (req, res) => {
    try {
        const c = await db.query(
            `SELECT c.*, sc.name AS school_name FROM inv_customers c
             LEFT JOIN inv_schools sc ON sc.id = c.school_id
             WHERE c.id=$1`, [req.params.id]
        );
        if (!c.rows.length) return res.status(404).json({ error: 'Not found' });

        const invoices = await db.query(
            `SELECT id, invoice_number, invoice_date, total_amount, paid_amount, balance, status
             FROM inv_sales_invoices WHERE customer_id=$1 ORDER BY invoice_date DESC LIMIT 50`,
            [req.params.id]
        );
        const payments = await db.query(
            `SELECT * FROM inv_sales_payments WHERE customer_id=$1 ORDER BY payment_date DESC LIMIT 50`,
            [req.params.id]
        );
        res.json({ ...c.rows[0], invoices: invoices.rows, payments: payments.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createCustomer = async (req, res) => {
    const { name, mobile, gst_number, address, school_id, opening_balance } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const r = await db.query(
            `INSERT INTO inv_customers (name, mobile, gst_number, address, school_id, opening_balance, current_balance)
             VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING *`,
            [name, mobile||null, gst_number||null, address||null, school_id||null, opening_balance||0]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateCustomer = async (req, res) => {
    const { name, mobile, gst_number, address, school_id, is_active } = req.body;
    try {
        const r = await db.query(
            `UPDATE inv_customers SET name=$1, mobile=$2, gst_number=$3, address=$4, school_id=$5, is_active=$6
             WHERE id=$7 RETURNING *`,
            [name, mobile||null, gst_number||null, address||null, school_id||null, is_active!==false, req.params.id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};
