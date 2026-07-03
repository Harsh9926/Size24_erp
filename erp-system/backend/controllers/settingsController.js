'use strict';
const db = require('../config/db');

/* ── System Settings ─────────────────────────────────────── */
exports.getSettings = async (req, res) => {
    try {
        const { rows } = await db.query(`SELECT key, value, description FROM sys_settings ORDER BY key`);
        const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
        res.json(settings);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateSettings = async (req, res) => {
    try {
        const updates = req.body; // { key: value, ... }
        for (const [key, value] of Object.entries(updates)) {
            await db.query(
                `INSERT INTO sys_settings (key, value, updated_at) VALUES ($1,$2,NOW())
                 ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
                [key, String(value)]
            );
        }
        res.json({ updated: Object.keys(updates).length });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getSetting = async (req, res) => {
    try {
        const { key } = req.params;
        const { rows: [row] } = await db.query(`SELECT value FROM sys_settings WHERE key=$1`, [key]);
        res.json({ key, value: row?.value || null });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Branches ─────────────────────────────────────────────── */
exports.getBranches = async (req, res) => {
    try {
        const { rows } = await db.query(`SELECT * FROM sys_branches WHERE is_active=true ORDER BY name`);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createBranch = async (req, res) => {
    try {
        const { name, address, city, state, gstin, mobile, email, is_head_office } = req.body;
        const { rows: [b] } = await db.query(
            `INSERT INTO sys_branches (name,address,city,state,gstin,mobile,email,is_head_office) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [name,address||null,city||null,state||null,gstin||null,mobile||null,email||null,is_head_office||false]
        );
        res.json(b);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateBranch = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, city, state, gstin, mobile, email, is_head_office, is_active } = req.body;
        const { rows: [b] } = await db.query(
            `UPDATE sys_branches SET name=$1,address=$2,city=$3,state=$4,gstin=$5,mobile=$6,email=$7,is_head_office=$8,is_active=$9 WHERE id=$10 RETURNING *`,
            [name,address||null,city||null,state||null,gstin||null,mobile||null,email||null,is_head_office||false,is_active!==false,id]
        );
        res.json(b);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Notification Templates ──────────────────────────────── */
exports.getNotifTemplates = async (req, res) => {
    try {
        const { channel } = req.query;
        const params = channel ? [channel] : [];
        const q = `SELECT * FROM sys_notification_templates ${channel ? 'WHERE channel=$1' : ''} ORDER BY channel, event_type`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.upsertNotifTemplate = async (req, res) => {
    try {
        const { channel, event_type, template_name, subject, body, variables, is_active } = req.body;
        const { rows: [t] } = await db.query(
            `INSERT INTO sys_notification_templates (channel,event_type,template_name,subject,body,variables,is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (channel,event_type) DO UPDATE SET template_name=EXCLUDED.template_name, subject=EXCLUDED.subject, body=EXCLUDED.body, variables=EXCLUDED.variables, is_active=EXCLUDED.is_active
             RETURNING *`,
            [channel, event_type, template_name||null, subject||null, body, JSON.stringify(variables||[]), is_active!==false]
        );
        res.json(t);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Notification Logs ────────────────────────────────────── */
exports.getNotifLogs = async (req, res) => {
    try {
        const { status, channel, from, to, page = 1 } = req.query;
        const offset = (page - 1) * 50;
        const params = [];
        let q = `SELECT * FROM sys_notification_log WHERE 1=1`;
        if (status)  { params.push(status);  q += ` AND status=$${params.length}`; }
        if (channel) { params.push(channel); q += ` AND channel=$${params.length}`; }
        if (from) { params.push(from); q += ` AND created_at::date>=$${params.length}`; }
        if (to)   { params.push(to);   q += ` AND created_at::date<=$${params.length}`; }
        q += ` ORDER BY created_at DESC LIMIT 50 OFFSET ${offset}`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Send Notification (in-app / email stub) ──────────────── */
exports.sendNotification = async (req, res) => {
    try {
        const { channel, recipient, event_type, ref_type, ref_id, subject, body } = req.body;
        const { rows: [log] } = await db.query(
            `INSERT INTO sys_notification_log (channel,recipient,event_type,ref_type,ref_id,subject,body,status,sent_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'sent',NOW()) RETURNING *`,
            [channel, recipient, event_type||null, ref_type||null, ref_id||null, subject||null, body]
        );
        // In production: integrate with WhatsApp/SMS/Email services here
        const io = req.app.get('io');
        if (channel === 'in_app' && io) {
            io.emit('notification', { event_type, subject, body, ref_type, ref_id });
        }
        res.json(log);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── AI / Demand Intelligence ────────────────────────────── */
exports.getAIInsights = async (req, res) => {
    try {
        const [{ rows: topSellers }, { rows: deadStock }, { rows: lowStock }, { rows: forecast }, { rows: customerPattern }] = await Promise.all([
            db.query(`
                SELECT p.name AS product_name, v.size, v.color,
                       SUM(ii.qty) AS units_sold,
                       SUM(ii.qty * ii.unit_price) AS revenue
                FROM inv_sales_invoice_items ii
                JOIN inv_variants v ON v.id=ii.variant_id
                JOIN inv_products p ON p.id=v.product_id
                JOIN inv_sales_invoices i ON i.id=ii.invoice_id
                WHERE i.invoice_date >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY p.name, v.size, v.color
                ORDER BY units_sold DESC LIMIT 10
            `),
            db.query(`
                SELECT p.name AS product_name, v.size, v.color, v.stock,
                       COALESCE(s.sold_6m,0) AS sold_6m
                FROM inv_variants v
                JOIN inv_products p ON p.id=v.product_id
                LEFT JOIN (
                    SELECT ii.variant_id, SUM(ii.qty) AS sold_6m
                    FROM inv_sales_invoice_items ii
                    JOIN inv_sales_invoices i ON i.id=ii.invoice_id
                    WHERE i.invoice_date >= CURRENT_DATE - INTERVAL '6 months'
                    GROUP BY ii.variant_id
                ) s ON s.variant_id=v.id
                WHERE v.stock > 10 AND COALESCE(s.sold_6m,0) = 0 AND v.is_active=true
                ORDER BY v.stock DESC LIMIT 10
            `),
            db.query(`
                SELECT p.name AS product_name, v.size, v.color, v.stock,
                       COALESCE(v.min_stock,0) AS min_stock
                FROM inv_variants v
                JOIN inv_products p ON p.id=v.product_id
                WHERE v.is_active=true AND v.stock <= COALESCE(v.min_stock,0)
                ORDER BY v.stock LIMIT 20
            `),
            db.query(`
                SELECT
                    TO_CHAR(i.invoice_date,'YYYY-MM') AS month,
                    COUNT(*) AS orders,
                    SUM(i.grand_total) AS revenue
                FROM inv_sales_invoices i
                WHERE i.invoice_date >= CURRENT_DATE - INTERVAL '6 months'
                GROUP BY TO_CHAR(i.invoice_date,'YYYY-MM')
                ORDER BY month
            `),
            db.query(`
                SELECT c.name AS customer_name, COUNT(*) AS purchases,
                       SUM(i.grand_total) AS total_spent,
                       MAX(i.invoice_date) AS last_purchase
                FROM inv_sales_invoices i
                JOIN inv_customers c ON c.id=i.customer_id
                WHERE i.invoice_date >= CURRENT_DATE - INTERVAL '90 days'
                GROUP BY c.id, c.name
                ORDER BY total_spent DESC LIMIT 10
            `),
        ]);
        res.json({
            top_sellers: topSellers,
            dead_stock: deadStock,
            low_stock: lowStock,
            revenue_forecast: forecast,
            customer_patterns: customerPattern,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Enhanced Reports ─────────────────────────────────────── */
exports.getMasterReport = async (req, res) => {
    try {
        const { report_type, from, to, format } = req.query;
        const params = [];
        let rows = [];

        const dateFilter = (alias = 'i') => {
            let f = '';
            if (from) { params.push(from); f += ` AND ${alias}.invoice_date>=$${params.length}`; }
            if (to)   { params.push(to);   f += ` AND ${alias}.invoice_date<=$${params.length}`; }
            return f;
        };

        switch (report_type) {
            case 'sales_summary':
                ({ rows } = await db.query(`
                    SELECT i.invoice_date, i.invoice_number, c.name AS customer_name,
                           i.grand_total, i.payment_mode
                    FROM inv_sales_invoices i LEFT JOIN inv_customers c ON c.id=i.customer_id
                    WHERE 1=1 ${dateFilter('i')}
                    ORDER BY i.invoice_date DESC LIMIT 1000
                `, params));
                break;
            case 'purchase_summary':
                ({ rows } = await db.query(`
                    SELECT pu.purchase_date, pu.bill_number, p.name AS supplier_name,
                           pu.grand_total
                    FROM inv_purchases pu LEFT JOIN inv_parties p ON p.id=pu.party_id
                    WHERE 1=1 ${(()=>{
                        let f = '';
                        if (from) { params.push(from); f += ` AND pu.purchase_date>=$${params.length}`; }
                        if (to)   { params.push(to);   f += ` AND pu.purchase_date<=$${params.length}`; }
                        return f;
                    })()}
                    ORDER BY pu.purchase_date DESC LIMIT 1000
                `, params));
                break;
            case 'stock_valuation':
                ({ rows } = await db.query(`
                    SELECT p.name, v.size, v.color, v.sku, v.stock,
                           v.cost_price, v.sale_price,
                           v.stock * v.cost_price AS stock_value,
                           v.stock * v.sale_price AS selling_value
                    FROM inv_variants v JOIN inv_products p ON p.id=v.product_id
                    WHERE v.is_active=true AND v.stock > 0
                    ORDER BY stock_value DESC
                `));
                break;
            case 'gst_summary':
                ({ rows } = await db.query(`
                    SELECT entry_date, ref_type, ref_number, party_name,
                           taxable_amount, cgst, sgst, igst, total_gst, gst_type
                    FROM acc_gst_ledger WHERE 1=1
                    ${(()=>{ let f=''; if(from){params.push(from);f+=` AND entry_date>=$${params.length}`;} if(to){params.push(to);f+=` AND entry_date<=$${params.length}`;} return f; })()}
                    ORDER BY entry_date DESC
                `, params));
                break;
            case 'customer_outstanding':
                ({ rows } = await db.query(`
                    SELECT c.id, c.name, c.mobile, c.current_balance AS outstanding,
                           COUNT(DISTINCT i.id) AS total_invoices,
                           MAX(i.invoice_date) AS last_purchase
                    FROM inv_customers c
                    LEFT JOIN inv_sales_invoices i ON i.customer_id=c.id
                    WHERE c.current_balance > 0
                    GROUP BY c.id, c.name, c.mobile, c.current_balance
                    ORDER BY c.current_balance DESC
                `));
                break;
            case 'expense_report':
                ({ rows } = await db.query(`
                    SELECT e.expense_date, e.category, e.description, e.amount, e.payment_mode, u.name AS created_by
                    FROM expenses e LEFT JOIN users u ON u.id=e.created_by
                    WHERE 1=1
                    ${(()=>{ let f=''; if(from){params.push(from);f+=` AND e.expense_date>=$${params.length}`;} if(to){params.push(to);f+=` AND e.expense_date<=$${params.length}`;} return f; })()}
                    ORDER BY e.expense_date DESC LIMIT 1000
                `, params));
                break;
            default:
                return res.status(400).json({ error: 'Unknown report_type' });
        }
        res.json({ report_type, from, to, rows, count: rows.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
