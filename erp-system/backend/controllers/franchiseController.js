'use strict';
const db = require('../config/db');

async function nextCode(key, prefix, pad = 4) {
    const { rows } = await db.query(`UPDATE inv_counters SET last_number=last_number+1 WHERE counter_name=$1 RETURNING last_number`, [key]);
    return `${prefix}-${String(rows[0].last_number).padStart(pad,'0')}`;
}

/* ── Partners ──────────────────────────────────────────── */
exports.listPartners = async (req, res) => {
    try {
        const { search, status } = req.query;
        const params = [];
        let q = `SELECT * FROM franchise_partners WHERE 1=1`;
        if (status) { params.push(status); q += ` AND status=$${params.length}`; }
        if (search) { params.push(`%${search}%`); q += ` AND (name ILIKE $${params.length} OR code ILIKE $${params.length} OR city ILIKE $${params.length})`; }
        q += ` ORDER BY name`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getPartner = async (req, res) => {
    try {
        const { id } = req.params;
        const [{ rows: [partner] }, { rows: wallet }, { rows: [sales] }] = await Promise.all([
            db.query(`SELECT * FROM franchise_partners WHERE id=$1`, [id]),
            db.query(`SELECT * FROM franchise_wallet_ledger WHERE franchise_id=$1 ORDER BY txn_date DESC LIMIT 50`, [id]),
            db.query(`SELECT COALESCE(SUM(total_value),0) AS total_orders, COUNT(*) AS order_count FROM franchise_orders WHERE franchise_id=$1`, [id]),
        ]);
        if (!partner) return res.status(404).json({ error: 'Not found' });
        res.json({ ...partner, wallet_ledger: wallet, sales_summary: sales });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createPartner = async (req, res) => {
    try {
        const code = await nextCode('franchise_code', 'FR');
        const { name, owner_name, mobile, email, address, city, state, gstin, commission_pct, credit_limit, joined_date, notes } = req.body;
        const { rows: [p] } = await db.query(
            `INSERT INTO franchise_partners (code,name,owner_name,mobile,email,address,city,state,gstin,commission_pct,credit_limit,joined_date,notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
            [code,name,owner_name||null,mobile,email||null,address||null,city||null,state||null,gstin||null,commission_pct||0,credit_limit||0,joined_date||null,notes||null]
        );
        res.json(p);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updatePartner = async (req, res) => {
    try {
        const { id } = req.params;
        const fields = ['name','owner_name','mobile','email','address','city','state','gstin','commission_pct','credit_limit','status','notes'];
        const sets=[]; const vals=[];
        for (const f of fields) {
            if (req.body[f] !== undefined) { vals.push(req.body[f]); sets.push(`${f}=$${vals.length}`); }
        }
        vals.push(id);
        const { rows: [p] } = await db.query(`UPDATE franchise_partners SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
        res.json(p);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Wallet ────────────────────────────────────────────── */
exports.getWallet = async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await db.query(`SELECT * FROM franchise_wallet_ledger WHERE franchise_id=$1 ORDER BY txn_date DESC`, [id]);
        const { rows: [p] } = await db.query(`SELECT wallet_balance FROM franchise_partners WHERE id=$1`, [id]);
        res.json({ balance: p?.wallet_balance || 0, ledger: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.addWalletEntry = async (req, res) => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const { txn_type, amount, narration, ref_type, ref_id } = req.body;
        const { rows: [p] } = await client.query(`SELECT wallet_balance FROM franchise_partners WHERE id=$1 FOR UPDATE`, [id]);
        const newBal = parseFloat(p.wallet_balance) + (txn_type === 'credit' ? parseFloat(amount) : -parseFloat(amount));
        await client.query(`UPDATE franchise_partners SET wallet_balance=$1 WHERE id=$2`, [newBal, id]);
        const { rows: [entry] } = await client.query(
            `INSERT INTO franchise_wallet_ledger (franchise_id,txn_type,amount,narration,ref_type,ref_id,balance_after) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [id, txn_type, amount, narration||null, ref_type||null, ref_id||null, newBal]
        );
        await client.query('COMMIT');
        res.json({ ...entry, new_balance: newBal });
    } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); }
    finally { client.release(); }
};

/* ── Stock Transfers ───────────────────────────────────── */
exports.getTransfers = async (req, res) => {
    try {
        const { franchise_id, status } = req.query;
        const params = [];
        let q = `SELECT t.*, f.name AS franchise_name FROM franchise_stock_transfers t JOIN franchise_partners f ON f.id=t.franchise_id WHERE 1=1`;
        if (franchise_id) { params.push(franchise_id); q += ` AND t.franchise_id=$${params.length}`; }
        if (status) { params.push(status); q += ` AND t.status=$${params.length}`; }
        q += ` ORDER BY t.transfer_date DESC`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createTransfer = async (req, res) => {
    try {
        const transfer_number = await nextCode('franchise_transfer', 'FST');
        const { franchise_id, transfer_date, transfer_type, items, total_value, notes } = req.body;
        const { rows: [t] } = await db.query(
            `INSERT INTO franchise_stock_transfers (transfer_number,franchise_id,transfer_date,transfer_type,items,total_value,notes,created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [transfer_number, franchise_id, transfer_date, transfer_type||'out', JSON.stringify(items||[]), total_value||0, notes||null, req.user.id]
        );
        res.json(t);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.approveTransfer = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const { rows: [t] } = await db.query(
            `UPDATE franchise_stock_transfers SET status=$1, approved_by=$2 WHERE id=$3 RETURNING *`,
            [status, req.user.id, id]
        );
        res.json(t);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Orders ────────────────────────────────────────────── */
exports.getOrders = async (req, res) => {
    try {
        const { franchise_id, status } = req.query;
        const params = [];
        let q = `SELECT o.*, f.name AS franchise_name FROM franchise_orders o JOIN franchise_partners f ON f.id=o.franchise_id WHERE 1=1`;
        if (franchise_id) { params.push(franchise_id); q += ` AND o.franchise_id=$${params.length}`; }
        if (status) { params.push(status); q += ` AND o.status=$${params.length}`; }
        q += ` ORDER BY o.order_date DESC`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createOrder = async (req, res) => {
    try {
        const order_number = await nextCode('franchise_order', 'FO');
        const { franchise_id, order_date, items, total_value, notes } = req.body;
        const { rows: [o] } = await db.query(
            `INSERT INTO franchise_orders (order_number,franchise_id,order_date,items,total_value,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [order_number, franchise_id, order_date, JSON.stringify(items||[]), total_value||0, notes||null]
        );
        res.json(o);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.approveOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const { rows: [o] } = await db.query(
            `UPDATE franchise_orders SET status=$1, approved_by=$2 WHERE id=$3 RETURNING *`,
            [status, req.user.id, id]
        );
        res.json(o);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Settlements ───────────────────────────────────────── */
exports.getSettlements = async (req, res) => {
    try {
        const { franchise_id } = req.query;
        const params = franchise_id ? [franchise_id] : [];
        const q = `SELECT s.*, f.name AS franchise_name FROM franchise_settlements s JOIN franchise_partners f ON f.id=s.franchise_id ${franchise_id ? 'WHERE s.franchise_id=$1' : ''} ORDER BY s.settlement_date DESC`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createSettlement = async (req, res) => {
    try {
        const { franchise_id, settlement_date, period_from, period_to, gross_sales, commission_pct, deductions, payment_mode, notes } = req.body;
        const commission_amt = parseFloat(gross_sales||0) * parseFloat(commission_pct||0) / 100;
        const net_payable = commission_amt - parseFloat(deductions||0);
        const { rows: [s] } = await db.query(
            `INSERT INTO franchise_settlements (franchise_id,settlement_date,period_from,period_to,gross_sales,commission_amt,deductions,net_payable,payment_mode,notes,created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            [franchise_id, settlement_date, period_from, period_to, gross_sales||0, commission_amt.toFixed(2), deductions||0, net_payable.toFixed(2), payment_mode||null, notes||null, req.user.id]
        );
        res.json(s);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Dashboard ─────────────────────────────────────────── */
exports.getDashboard = async (req, res) => {
    try {
        const [{ rows: [totals] }, { rows: top }, { rows: pending }] = await Promise.all([
            db.query(`SELECT COUNT(*) AS partners, SUM(outstanding) AS total_outstanding, SUM(wallet_balance) AS total_wallet FROM franchise_partners WHERE status='active'`),
            db.query(`SELECT f.name, f.city, COALESCE(SUM(o.total_value),0) AS sales FROM franchise_partners f LEFT JOIN franchise_orders o ON o.franchise_id=f.id AND o.status='fulfilled' GROUP BY f.id,f.name,f.city ORDER BY sales DESC LIMIT 5`),
            db.query(`SELECT f.name, o.order_number, o.total_value, o.order_date FROM franchise_orders o JOIN franchise_partners f ON f.id=o.franchise_id WHERE o.status='pending' ORDER BY o.order_date LIMIT 10`),
        ]);
        res.json({ totals, top_performers: top, pending_orders: pending });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
