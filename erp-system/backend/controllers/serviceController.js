'use strict';
const db = require('../config/db');

async function nextOrderNum() {
    const { rows } = await db.query(`UPDATE inv_counters SET last_number=last_number+1 WHERE counter_name='svc_order' RETURNING last_number`);
    return `SVC-${String(rows[0].last_number).padStart(5,'0')}`;
}

/* ── Service Orders ─────────────────────────────────────── */
exports.getOrders = async (req, res) => {
    try {
        const { status, order_type, search, from, to, assigned_to, page = 1 } = req.query;
        const offset = (page-1) * 50;
        const params = [];
        let q = `SELECT o.*, e.name AS tailor_name, c.name AS customer_name_ref
                 FROM svc_orders o
                 LEFT JOIN hr_employees e ON e.id=o.assigned_to
                 LEFT JOIN inv_customers c ON c.id=o.customer_id
                 WHERE 1=1`;
        if (status)      { params.push(status);      q += ` AND o.status=$${params.length}`; }
        if (order_type)  { params.push(order_type);  q += ` AND o.order_type=$${params.length}`; }
        if (assigned_to) { params.push(assigned_to); q += ` AND o.assigned_to=$${params.length}`; }
        if (from) { params.push(from); q += ` AND o.order_date>=$${params.length}`; }
        if (to)   { params.push(to);   q += ` AND o.order_date<=$${params.length}`; }
        if (search) { params.push(`%${search}%`); q += ` AND (o.order_number ILIKE $${params.length} OR o.customer_name ILIKE $${params.length} OR o.customer_mobile ILIKE $${params.length})`; }
        q += ` ORDER BY o.order_date DESC LIMIT 50 OFFSET ${offset}`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const [{ rows: [order] }, { rows: log }] = await Promise.all([
            db.query(`SELECT o.*, e.name AS tailor_name FROM svc_orders o LEFT JOIN hr_employees e ON e.id=o.assigned_to WHERE o.id=$1`, [id]),
            db.query(`SELECT l.*, u.name AS changed_by_name FROM svc_status_log l LEFT JOIN users u ON u.id=l.changed_by WHERE l.order_id=$1 ORDER BY l.changed_at`, [id]),
        ]);
        if (!order) return res.status(404).json({ error: 'Not found' });
        res.json({ ...order, status_log: log });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createOrder = async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const order_number = await nextOrderNum();
        const { order_type, customer_id, customer_name, customer_mobile, order_date, delivery_date, items, advance_paid, assigned_to, notes } = req.body;
        const total_amount = (items||[]).reduce((s,i) => s + parseFloat(i.amount||0), 0);
        const balance_due = total_amount - parseFloat(advance_paid||0);
        const { rows: [order] } = await client.query(
            `INSERT INTO svc_orders (order_number,order_type,customer_id,customer_name,customer_mobile,order_date,delivery_date,items,total_amount,advance_paid,balance_due,assigned_to,notes,created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
            [order_number,order_type,customer_id||null,customer_name,customer_mobile,order_date,delivery_date||null,JSON.stringify(items||[]),total_amount.toFixed(2),advance_paid||0,balance_due.toFixed(2),assigned_to||null,notes||null,req.user.id]
        );
        await client.query(`INSERT INTO svc_status_log (order_id,old_status,new_status,notes,changed_by) VALUES ($1,NULL,'received','Order created',$2)`, [order.id, req.user.id]);
        await client.query('COMMIT');
        res.json(order);
    } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
    finally { client.release(); }
};

exports.updateOrderStatus = async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const { status, notes } = req.body;
        const { rows: [old] } = await client.query(`SELECT status FROM svc_orders WHERE id=$1`, [id]);
        if (!old) throw new Error('Order not found');
        const { rows: [order] } = await client.query(`UPDATE svc_orders SET status=$1 WHERE id=$2 RETURNING *`, [status, id]);
        await client.query(`INSERT INTO svc_status_log (order_id,old_status,new_status,notes,changed_by) VALUES ($1,$2,$3,$4,$5)`, [id, old.status, status, notes||null, req.user.id]);
        await client.query('COMMIT');
        res.json(order);
    } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
    finally { client.release(); }
};

exports.updateOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { delivery_date, assigned_to, advance_paid, notes, items } = req.body;
        const sets = []; const vals = [];
        if (delivery_date !== undefined) { vals.push(delivery_date); sets.push(`delivery_date=$${vals.length}`); }
        if (assigned_to !== undefined)   { vals.push(assigned_to);   sets.push(`assigned_to=$${vals.length}`); }
        if (advance_paid !== undefined)  { vals.push(advance_paid);  sets.push(`advance_paid=$${vals.length}`); }
        if (notes !== undefined)         { vals.push(notes);         sets.push(`notes=$${vals.length}`); }
        if (items !== undefined) {
            const total = items.reduce((s,i) => s + parseFloat(i.amount||0), 0);
            vals.push(JSON.stringify(items)); sets.push(`items=$${vals.length}`);
            vals.push(total.toFixed(2)); sets.push(`total_amount=$${vals.length}`);
        }
        if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
        vals.push(id);
        const { rows: [order] } = await db.query(`UPDATE svc_orders SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
        res.json(order);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.collectPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, payment_mode } = req.body;
        const { rows: [order] } = await db.query(
            `UPDATE svc_orders SET advance_paid=advance_paid+$1, balance_due=balance_due-$1 WHERE id=$2 RETURNING *`,
            [amount, id]
        );
        res.json(order);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Dashboard ─────────────────────────────────────────── */
exports.getDashboard = async (req, res) => {
    try {
        const [{ rows: stats }, { rows: overdue }, { rows: today }] = await Promise.all([
            db.query(`SELECT status, COUNT(*) AS cnt, COALESCE(SUM(total_amount),0) AS amount FROM svc_orders GROUP BY status`),
            db.query(`SELECT o.*, e.name AS tailor_name FROM svc_orders o LEFT JOIN hr_employees e ON e.id=o.assigned_to WHERE o.delivery_date < CURRENT_DATE AND o.status NOT IN ('delivered','cancelled') ORDER BY o.delivery_date`),
            db.query(`SELECT o.*, e.name AS tailor_name FROM svc_orders o LEFT JOIN hr_employees e ON e.id=o.assigned_to WHERE o.delivery_date = CURRENT_DATE AND o.status NOT IN ('delivered','cancelled') ORDER BY o.order_number`),
        ]);
        const statsMap = Object.fromEntries(stats.map(s => [s.status, { cnt: s.cnt, amount: s.amount }]));
        res.json({ stats: statsMap, overdue_deliveries: overdue, due_today: today });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
