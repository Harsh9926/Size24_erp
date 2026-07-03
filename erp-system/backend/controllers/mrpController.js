'use strict';
const db = require('../config/db');

/* ── Generate Purchase Suggestions ──────────────────────── */
exports.generateSuggestions = async (req, res) => {
    try {
        const { min_stock_multiplier = 1.2 } = req.query;
        // Find all variants where current stock <= min threshold
        // Use avg monthly sales as forecast demand
        const { rows } = await db.query(`
            WITH monthly_sales AS (
                SELECT ii.variant_id,
                       AVG(ii.qty) AS avg_monthly_qty
                FROM inv_sales_invoice_items ii
                JOIN inv_sales_invoices inv ON inv.id=ii.invoice_id
                WHERE inv.invoice_date >= CURRENT_DATE - INTERVAL '3 months'
                GROUP BY ii.variant_id
            ),
            stock_data AS (
                SELECT v.id AS variant_id,
                       p.name AS product_name,
                       v.size, v.color, v.sku, v.barcode,
                       COALESCE(v.stock,0) AS current_stock,
                       COALESCE(ms.avg_monthly_qty,0) AS avg_monthly_demand,
                       COALESCE(v.min_stock,0) AS min_stock
                FROM inv_variants v
                JOIN inv_products p ON p.id=v.product_id
                LEFT JOIN monthly_sales ms ON ms.variant_id=v.id
                WHERE v.is_active=true
            )
            SELECT sd.*,
                   GREATEST(0, CEIL(sd.avg_monthly_demand * $1::numeric * 2) - sd.current_stock) AS suggested_qty,
                   (SELECT party_id FROM inv_purchase_items pi2 JOIN inv_purchases pu ON pu.id=pi2.purchase_id WHERE pi2.variant_id=sd.variant_id ORDER BY pu.purchase_date DESC LIMIT 1) AS last_supplier_id
            FROM stock_data sd
            WHERE sd.current_stock <= sd.min_stock OR (sd.avg_monthly_demand > 0 AND sd.current_stock < sd.avg_monthly_demand * $1::numeric)
            ORDER BY (sd.avg_monthly_demand - sd.current_stock) DESC
        `, [min_stock_multiplier]);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.saveSuggestions = async (req, res) => {
    try {
        const { suggestions } = req.body;
        const saved = [];
        for (const s of suggestions) {
            const { rows: [row] } = await db.query(
                `INSERT INTO mrp_purchase_suggestions (variant_id,product_name,current_stock,min_stock,suggested_qty,preferred_supplier_id,expected_delivery,priority,notes)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
                [s.variant_id, s.product_name, s.current_stock, s.min_stock||0, s.suggested_qty, s.preferred_supplier_id||null, s.expected_delivery||null, s.priority||'medium', s.notes||null]
            );
            saved.push(row);
        }
        res.json({ saved: saved.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getSuggestions = async (req, res) => {
    try {
        const { status, priority } = req.query;
        const params = [];
        let q = `SELECT s.*, p.name AS supplier_name FROM mrp_purchase_suggestions s LEFT JOIN inv_parties p ON p.id=s.preferred_supplier_id WHERE 1=1`;
        if (status)   { params.push(status);   q += ` AND s.status=$${params.length}`; }
        if (priority) { params.push(priority); q += ` AND s.priority=$${params.length}`; }
        q += ` ORDER BY s.suggestion_date DESC`;
        const { rows } = await db.query(q, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.approveSuggestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const { rows: [s] } = await db.query(
            `UPDATE mrp_purchase_suggestions SET status=$1, approved_by=$2 WHERE id=$3 RETURNING *`,
            [status, req.user.id, id]
        );
        res.json(s);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Current Stock Dashboard ─────────────────────────────── */
exports.getStockAnalysis = async (req, res) => {
    try {
        const { rows } = await db.query(`
            WITH sales_3m AS (
                SELECT ii.variant_id, SUM(ii.qty) AS sold_3m
                FROM inv_sales_invoice_items ii
                JOIN inv_sales_invoices i ON i.id=ii.invoice_id
                WHERE i.invoice_date >= CURRENT_DATE - INTERVAL '3 months'
                GROUP BY ii.variant_id
            )
            SELECT v.id, p.name AS product_name, v.size, v.color, v.sku,
                   COALESCE(v.stock,0) AS stock,
                   COALESCE(v.min_stock,0) AS min_stock,
                   COALESCE(s3.sold_3m,0) AS sold_3m,
                   ROUND(COALESCE(s3.sold_3m,0)/3.0,1) AS avg_monthly,
                   CASE
                     WHEN COALESCE(v.stock,0) = 0 THEN 'out_of_stock'
                     WHEN COALESCE(v.stock,0) <= COALESCE(v.min_stock,0) THEN 'low_stock'
                     WHEN COALESCE(s3.sold_3m,0) = 0 AND COALESCE(v.stock,0) > 20 THEN 'dead_stock'
                     ELSE 'ok'
                   END AS stock_status
            FROM inv_variants v
            JOIN inv_products p ON p.id=v.product_id
            LEFT JOIN sales_3m s3 ON s3.variant_id=v.id
            WHERE v.is_active=true
            ORDER BY stock_status, v.stock
            LIMIT 500
        `);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ── Demand Plans ─────────────────────────────────────────── */
exports.getDemandPlans = async (req, res) => {
    try {
        const { rows } = await db.query(`SELECT dp.*, v.sku, p.name AS product_name FROM mrp_demand_plans dp LEFT JOIN inv_variants v ON v.id=dp.variant_id LEFT JOIN inv_products p ON p.id=v.product_id ORDER BY dp.plan_date DESC LIMIT 200`);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};
