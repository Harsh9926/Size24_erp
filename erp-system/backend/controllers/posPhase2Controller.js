const db = require('../config/db');
const { updateStock } = require('./inventoryController');

async function nextCounter(client, key) {
    const r = await client.query(
        `UPDATE inv_counters SET value = value + 1 WHERE key = $1 RETURNING value`, [key]
    );
    return r.rows[0].value;
}

// ── Warehouse stock helper ────────────────────────────────────────
async function updateWarehouseStock(client, variantId, warehouseId, qtyChange, txnType, refType, refId, note, userId) {
    if (!warehouseId) return;
    await client.query(
        `INSERT INTO pos_warehouse_stock (variant_id, warehouse_id, qty, updated_at)
         VALUES ($1, $2, GREATEST(0, $3), NOW())
         ON CONFLICT (variant_id, warehouse_id)
         DO UPDATE SET qty = GREATEST(0, pos_warehouse_stock.qty + $3), updated_at = NOW()`,
        [variantId, warehouseId, qtyChange]
    );
    const r = await client.query(
        `SELECT qty FROM pos_warehouse_stock WHERE variant_id=$1 AND warehouse_id=$2`,
        [variantId, warehouseId]
    );
    const qtyAfter = parseFloat(r.rows[0]?.qty || 0);
    await client.query(
        `INSERT INTO pos_warehouse_ledger (variant_id, warehouse_id, txn_type, qty_change, qty_after, ref_type, ref_id, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [variantId, warehouseId, txnType, qtyChange, qtyAfter, refType, refId, note, userId]
    );
}

/* ══════════════════════════════════════════════════════════════════
   WAREHOUSES
══════════════════════════════════════════════════════════════════ */
exports.getWarehouses = async (req, res) => {
    try {
        const r = await db.query(
            `SELECT * FROM rm_warehouses WHERE is_active = true ORDER BY name`
        );
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getWarehouseStock = async (req, res) => {
    const { variantId } = req.params;
    try {
        const r = await db.query(`
            SELECT w.id AS warehouse_id, w.name AS warehouse_name, w.location,
                   COALESCE(ws.qty, 0) AS qty
            FROM rm_warehouses w
            LEFT JOIN pos_warehouse_stock ws ON ws.warehouse_id = w.id AND ws.variant_id = $1
            WHERE w.is_active = true
            ORDER BY w.name
        `, [variantId]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ══════════════════════════════════════════════════════════════════
   PRODUCT BATCHES
══════════════════════════════════════════════════════════════════ */
exports.getBatches = async (req, res) => {
    const { variantId } = req.params;
    try {
        const r = await db.query(`
            SELECT b.*, w.name AS warehouse_name,
                   b.qty - b.used_qty AS available_qty
            FROM pos_product_batches b
            LEFT JOIN rm_warehouses w ON w.id = b.warehouse_id
            WHERE b.variant_id = $1 AND b.is_active = true
              AND (b.qty - b.used_qty) > 0
            ORDER BY b.mfg_date ASC NULLS LAST, b.created_at ASC
        `, [variantId]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createBatch = async (req, res) => {
    const { variant_id, batch_number, lot_number, mfg_date, exp_date, qty, cost_price, warehouse_id, notes } = req.body;
    if (!variant_id || !batch_number) return res.status(400).json({ error: 'variant_id and batch_number required' });
    try {
        const r = await db.query(
            `INSERT INTO pos_product_batches (variant_id, batch_number, lot_number, mfg_date, exp_date, qty, cost_price, warehouse_id, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [variant_id, batch_number, lot_number||null, mfg_date||null, exp_date||null,
             qty||0, cost_price||null, warehouse_id||null, notes||null, req.user.id]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ══════════════════════════════════════════════════════════════════
   OFFERS & PRICING
══════════════════════════════════════════════════════════════════ */
exports.getOffers = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const r = await db.query(`
            SELECT o.*,
                   bp.name AS buy_product_name, gp.name AS get_product_name,
                   sc.name AS school_name, c.name AS category_name
            FROM pos_offers o
            LEFT JOIN inv_products bp ON bp.id = o.buy_product_id
            LEFT JOIN inv_products gp ON gp.id = o.get_product_id
            LEFT JOIN inv_schools  sc ON sc.id = o.school_id
            LEFT JOIN inv_categories c ON c.id = o.category_id
            WHERE o.is_active = true
              AND (o.start_date IS NULL OR o.start_date <= $1)
              AND (o.end_date IS NULL OR o.end_date >= $1)
            ORDER BY o.name
        `, [today]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createOffer = async (req, res) => {
    const { name, description, type, start_date, end_date, buy_product_id, buy_qty, get_product_id, get_qty,
            min_qty, min_amount, discount_type, discount_value, school_id, customer_id, category_id, product_id } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type required' });
    try {
        const r = await db.query(
            `INSERT INTO pos_offers
                (name, description, type, start_date, end_date, buy_product_id, buy_qty, get_product_id, get_qty,
                 min_qty, min_amount, discount_type, discount_value, school_id, customer_id, category_id, product_id, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
            [name, description||null, type, start_date||null, end_date||null,
             buy_product_id||null, buy_qty||0, get_product_id||null, get_qty||0,
             min_qty||0, min_amount||0, discount_type||null, discount_value||0,
             school_id||null, customer_id||null, category_id||null, product_id||null, req.user.id]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateOffer = async (req, res) => {
    const { id } = req.params;
    const { is_active, name, description, start_date, end_date, discount_value, min_qty, min_amount } = req.body;
    try {
        const r = await db.query(
            `UPDATE pos_offers SET is_active=$1, name=$2, description=$3, start_date=$4, end_date=$5,
             discount_value=$6, min_qty=$7, min_amount=$8
             WHERE id=$9 RETURNING *`,
            [is_active, name, description||null, start_date||null, end_date||null,
             discount_value||0, min_qty||0, min_amount||0, id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// Evaluate cart against offers → return applied discounts + free items
exports.checkOffers = async (req, res) => {
    const { items, customer_id, school_id } = req.body;
    if (!items?.length) return res.json({ applied: [], total_savings: 0 });
    try {
        const today = new Date().toISOString().split('T')[0];
        const { rows: offers } = await db.query(`
            SELECT o.* FROM pos_offers o
            WHERE o.is_active = true
              AND (o.start_date IS NULL OR o.start_date <= $1)
              AND (o.end_date IS NULL OR o.end_date >= $1)
              AND (o.customer_id IS NULL OR o.customer_id = $2)
              AND (o.school_id IS NULL OR o.school_id = $3)
        `, [today, customer_id || null, school_id || null]);

        const applied = [];
        let totalSavings = 0;

        for (const offer of offers) {
            if (offer.type === 'buy_x_get_y' && offer.buy_product_id) {
                const matchItem = items.find(i => i.product_id === offer.buy_product_id);
                if (matchItem && parseFloat(matchItem.qty) >= parseFloat(offer.buy_qty)) {
                    const times = Math.floor(parseFloat(matchItem.qty) / parseFloat(offer.buy_qty));
                    const freeQty = times * parseFloat(offer.get_qty);
                    applied.push({
                        offer_id: offer.id, offer_name: offer.name,
                        type: 'buy_x_get_y',
                        free_product_id: offer.get_product_id,
                        free_qty: freeQty,
                        message: `Buy ${offer.buy_qty} get ${freeQty} free (${offer.name})`,
                    });
                }
            }

            if (offer.type === 'bulk_discount' || offer.type === 'percentage' || offer.type === 'flat') {
                const totalQty = items.reduce((s, i) => {
                    if (!offer.product_id || i.product_id === offer.product_id) return s + parseFloat(i.qty);
                    return s;
                }, 0);
                const totalAmt = items.reduce((s, i) => {
                    if (!offer.product_id || i.product_id === offer.product_id)
                        return s + parseFloat(i.qty) * parseFloat(i.unit_price);
                    return s;
                }, 0);

                const qtyMet = parseFloat(offer.min_qty) <= 0 || totalQty >= parseFloat(offer.min_qty);
                const amtMet = parseFloat(offer.min_amount) <= 0 || totalAmt >= parseFloat(offer.min_amount);

                if (qtyMet && amtMet) {
                    let saving = 0;
                    if (offer.discount_type === 'percentage') saving = totalAmt * parseFloat(offer.discount_value) / 100;
                    if (offer.discount_type === 'flat')       saving = parseFloat(offer.discount_value);
                    totalSavings += saving;
                    applied.push({
                        offer_id: offer.id, offer_name: offer.name,
                        type: offer.type, saving,
                        discount_value: offer.discount_value,
                        discount_type: offer.discount_type,
                        message: `${offer.name}: Save ₹${saving.toFixed(2)}`,
                    });
                }
            }
        }

        res.json({ applied, total_savings: totalSavings });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ══════════════════════════════════════════════════════════════════
   CUSTOMER PRICING
══════════════════════════════════════════════════════════════════ */
exports.getCustomerPricing = async (req, res) => {
    const { customerId } = req.params;
    try {
        const cust = await db.query(`SELECT school_id FROM inv_customers WHERE id=$1`, [customerId]);
        const schoolId = cust.rows[0]?.school_id;
        const r = await db.query(`
            SELECT cp.*, v.sku, v.size, v.color, p.name AS product_name
            FROM pos_customer_pricing cp
            LEFT JOIN inv_variants  v ON v.id = cp.variant_id
            LEFT JOIN inv_products  p ON p.id = COALESCE(cp.product_id, v.product_id)
            WHERE cp.is_active = true
              AND (cp.customer_id = $1 OR cp.school_id = $2)
            ORDER BY cp.customer_id DESC NULLS LAST
        `, [customerId, schoolId || null]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.saveCustomerPricing = async (req, res) => {
    const { customer_id, school_id, variant_id, product_id, price_type, fixed_price, discount_pct, min_qty, notes } = req.body;
    if (!price_type) return res.status(400).json({ error: 'price_type required' });
    try {
        const r = await db.query(
            `INSERT INTO pos_customer_pricing
                (customer_id, school_id, variant_id, product_id, price_type, fixed_price, discount_pct, min_qty, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [customer_id||null, school_id||null, variant_id||null, product_id||null,
             price_type, fixed_price||null, discount_pct||null, min_qty||1, notes||null, req.user.id]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ══════════════════════════════════════════════════════════════════
   CUSTOMER ADVANCES
══════════════════════════════════════════════════════════════════ */
exports.getAdvances = async (req, res) => {
    const { customerId } = req.params;
    try {
        const r = await db.query(`
            SELECT a.*, u.name AS created_by_name
            FROM pos_advances a
            LEFT JOIN users u ON u.id = a.created_by
            WHERE a.customer_id = $1
              AND (a.amount - a.adjusted_amount) > 0.01
            ORDER BY a.received_date DESC
        `, [customerId]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.createAdvance = async (req, res) => {
    const { customer_id, amount, received_date, payment_mode, reference, notes } = req.body;
    if (!customer_id || !amount) return res.status(400).json({ error: 'customer_id and amount required' });
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const r = await client.query(
            `INSERT INTO pos_advances (customer_id, amount, received_date, payment_mode, reference, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [customer_id, amount, received_date, payment_mode||'cash', reference||null, notes||null, req.user.id]
        );
        // Reduce customer balance (advance received = credit)
        await client.query(
            `UPDATE inv_customers SET current_balance = current_balance - $1 WHERE id = $2`,
            [amount, customer_id]
        );
        await client.query('COMMIT');
        res.status(201).json(r.rows[0]);
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

/* ══════════════════════════════════════════════════════════════════
   EXCHANGE INVOICE — sell new + return old in one transaction
══════════════════════════════════════════════════════════════════ */
exports.createExchangeInvoice = async (req, res) => {
    const {
        customer_id, invoice_date, due_date,
        new_items,       // items being sold
        return_items,    // items being returned (exchange)
        discount = 0, notes,
        payments = [],
        redeem_points = 0,
        advance_ids = [], // [{ advance_id, amount }]
    } = req.body;

    if (!new_items?.length) return res.status(400).json({ error: 'new_items required' });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // ── Calculate new items total ─────────────────────────────
        let subtotal = 0, gstAmount = 0;
        for (const item of new_items) {
            const base = parseFloat(item.qty) * parseFloat(item.unit_price) - parseFloat(item.discount || 0);
            subtotal  += parseFloat(item.qty) * parseFloat(item.unit_price);
            gstAmount += base * (parseFloat(item.gst_rate || 0) / 100);
        }

        // ── Calculate exchange credit (return value) ──────────────
        let exchangeAmount = 0;
        for (const item of (return_items || [])) {
            exchangeAmount += parseFloat(item.qty) * parseFloat(item.unit_price);
        }

        // ── Advance adjustments ───────────────────────────────────
        let advanceAdjusted = 0;
        for (const adv of advance_ids) advanceAdjusted += parseFloat(adv.amount || 0);

        const discDoc   = parseFloat(discount);
        const pointsVal = parseFloat(redeem_points);
        const total     = Math.max(0, subtotal - discDoc + gstAmount - exchangeAmount - advanceAdjusted - pointsVal);
        const totalPaid = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);

        let invStatus = 'unpaid';
        if (total <= 0.01 || totalPaid >= total - 0.01) invStatus = 'paid';
        else if (totalPaid > 0) invStatus = 'partial';

        const primaryMode = payments.length === 1 ? payments[0].mode : payments.length > 1 ? 'split' : null;

        // ── Invoice number ────────────────────────────────────────
        const num    = await nextCounter(client, 'sales_invoice');
        const invNum = `INV-${String(num).padStart(5, '0')}`;

        const inv = await client.query(
            `INSERT INTO inv_sales_invoices
                (customer_id, invoice_number, invoice_date, due_date,
                 subtotal, discount, gst_amount, total_amount,
                 paid_amount, balance, notes, status, payment_mode,
                 exchange_amount, advance_adjusted, invoice_type, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
            [customer_id||null, invNum, invoice_date, due_date||null,
             subtotal, discDoc + pointsVal + advanceAdjusted, gstAmount, total,
             totalPaid, total - totalPaid,
             notes||null, invStatus, primaryMode,
             exchangeAmount, advanceAdjusted,
             (return_items?.length ? 'exchange' : 'sale'), req.user.id]
        );
        const invId = inv.rows[0].id;

        // ── Insert new items + deduct stock ───────────────────────
        for (const item of new_items) {
            const base   = parseFloat(item.qty) * parseFloat(item.unit_price) - parseFloat(item.discount || 0);
            const gstAmt = base * (parseFloat(item.gst_rate || 0) / 100);
            await client.query(
                `INSERT INTO inv_sales_invoice_items
                    (invoice_id, variant_id, qty, unit_price, discount, gst_rate, gst_amount, total_price, warehouse_id, batch_id, lot_number)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                [invId, item.variant_id, item.qty, item.unit_price,
                 item.discount||0, item.gst_rate||0, gstAmt, base+gstAmt,
                 item.warehouse_id||null, item.batch_id||null, item.lot_number||null]
            );
            // Global stock deduction
            await updateStock(client, item.variant_id, -parseFloat(item.qty),
                'sale', 'invoice', invId, `Sale ${invNum}`, req.user.id);
            // Warehouse stock deduction
            if (item.warehouse_id) {
                await updateWarehouseStock(client, item.variant_id, item.warehouse_id,
                    -parseFloat(item.qty), 'sale', 'invoice', invId, `Sale ${invNum}`, req.user.id);
            }
            // Batch usage deduction
            if (item.batch_id) {
                await client.query(
                    `UPDATE pos_product_batches SET used_qty = used_qty + $1 WHERE id = $2`,
                    [item.qty, item.batch_id]
                );
            }
        }

        // ── Insert exchange (return) items + reinstate stock ──────
        for (const item of (return_items || [])) {
            await client.query(
                `INSERT INTO pos_exchange_items (invoice_id, variant_id, qty, unit_price, total_price, original_invoice_id)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                [invId, item.variant_id, item.qty, item.unit_price,
                 parseFloat(item.qty)*parseFloat(item.unit_price),
                 item.original_invoice_id||null]
            );
            // Return to stock
            await updateStock(client, item.variant_id, parseFloat(item.qty),
                'sale_return', 'exchange', invId, `Exchange return ${invNum}`, req.user.id);
        }

        // ── Record payments ───────────────────────────────────────
        for (const pay of payments) {
            const amt = parseFloat(pay.amount||0);
            if (amt <= 0) continue;
            await client.query(
                `INSERT INTO inv_sales_payments
                    (invoice_id, customer_id, amount, payment_date, payment_mode, reference, created_by)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [invId, customer_id||null, amt, invoice_date, pay.mode||'cash', pay.reference||null, req.user.id]
            );
        }

        // ── Customer balance ──────────────────────────────────────
        if (customer_id) {
            const netDue = total - totalPaid;
            if (Math.abs(netDue) > 0.01) {
                await client.query(
                    `UPDATE inv_customers SET current_balance = current_balance + $1 WHERE id = $2`,
                    [netDue, customer_id]
                );
            }

            // Adjust selected advances
            for (const adv of advance_ids) {
                const advAmt = parseFloat(adv.amount || 0);
                if (advAmt <= 0) continue;
                await client.query(
                    `UPDATE pos_advances SET adjusted_amount = adjusted_amount + $1 WHERE id = $2`,
                    [advAmt, adv.advance_id]
                );
                await client.query(
                    `INSERT INTO pos_advance_adjustments (advance_id, invoice_id, amount, created_by)
                     VALUES ($1,$2,$3,$4)`,
                    [adv.advance_id, invId, advAmt, req.user.id]
                );
            }

            // Loyalty: earn
            const earned = Math.floor(total / 100);
            if (earned > 0) {
                const balR = await client.query(
                    `SELECT COALESCE(loyalty_points,0) AS pts FROM inv_customers WHERE id=$1`, [customer_id]
                );
                const newBal = (balR.rows[0]?.pts || 0) + earned;
                await client.query(`UPDATE inv_customers SET loyalty_points=$1 WHERE id=$2`, [newBal, customer_id]);
                await client.query(
                    `INSERT INTO pos_loyalty_transactions (customer_id, invoice_id, type, points, balance_after, note, created_by)
                     VALUES ($1,$2,'earn',$3,$4,'Earned on exchange',$5)`,
                    [customer_id, invId, earned, newBal, req.user.id]
                );
            }

            // Loyalty: redeem
            if (pointsVal > 0 && parseInt(redeem_points) > 0) {
                const pts = parseInt(redeem_points);
                const balR = await client.query(
                    `SELECT COALESCE(loyalty_points,0) AS pts FROM inv_customers WHERE id=$1`, [customer_id]
                );
                const newBal = Math.max(0, (balR.rows[0]?.pts||0) - pts);
                await client.query(`UPDATE inv_customers SET loyalty_points=$1 WHERE id=$2`, [newBal, customer_id]);
                await client.query(
                    `INSERT INTO pos_loyalty_transactions (customer_id, invoice_id, type, points, balance_after, note, created_by)
                     VALUES ($1,$2,'redeem',$3,$4,'Redeemed on exchange',$5)`,
                    [customer_id, invId, pts, newBal, req.user.id]
                );
            }
        }

        await client.query('COMMIT');

        // Return enriched invoice
        const full = await db.query(`
            SELECT inv.*, c.name AS customer_name, c.mobile AS customer_mobile,
                   c.gst_number AS customer_gst, c.address AS customer_address
            FROM inv_sales_invoices inv
            LEFT JOIN inv_customers c ON c.id = inv.customer_id
            WHERE inv.id = $1
        `, [invId]);

        const invItems = await db.query(`
            SELECT i.*, v.sku, v.size, v.color, p.name AS product_name, p.hsn_code
            FROM inv_sales_invoice_items i
            JOIN inv_variants v ON v.id = i.variant_id
            JOIN inv_products p ON p.id = v.product_id
            WHERE i.invoice_id = $1 ORDER BY i.id
        `, [invId]);

        const retItems = await db.query(`
            SELECT e.*, v.size, v.color, p.name AS product_name
            FROM pos_exchange_items e
            JOIN inv_variants v ON v.id = e.variant_id
            JOIN inv_products p ON p.id = v.product_id
            WHERE e.invoice_id = $1
        `, [invId]);

        res.status(201).json({
            ...full.rows[0],
            items: invItems.rows,
            exchange_items: retItems.rows,
            payments,
        });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

/* ══════════════════════════════════════════════════════════════════
   CUSTOMER CREDIT & LEDGER
══════════════════════════════════════════════════════════════════ */
exports.getCustomerLedger = async (req, res) => {
    const { customerId } = req.params;
    const { from, to } = req.query;
    try {
        const cust = await db.query(`
            SELECT c.*, COALESCE(c.loyalty_points,0) AS loyalty_points,
                   sc.name AS school_name
            FROM inv_customers c
            LEFT JOIN inv_schools sc ON sc.id = c.school_id
            WHERE c.id = $1
        `, [customerId]);
        if (!cust.rows.length) return res.status(404).json({ error: 'Customer not found' });

        const conds = [`inv.customer_id = $1`];
        const params = [customerId];
        let i = 2;
        if (from) { conds.push(`inv.invoice_date >= $${i++}`); params.push(from); }
        if (to)   { conds.push(`inv.invoice_date <= $${i++}`); params.push(to); }

        const txns = await db.query(`
            SELECT inv.id, inv.invoice_number, inv.invoice_date, inv.due_date,
                   inv.total_amount, inv.paid_amount, inv.balance, inv.status,
                   inv.invoice_type, inv.exchange_amount, inv.advance_adjusted,
                   'invoice' AS txn_type
            FROM inv_sales_invoices inv
            WHERE ${conds.join(' AND ')} AND inv.status != 'cancelled'
            UNION ALL
            SELECT p.id, CONCAT('PAY-', p.id::text), p.payment_date, NULL,
                   p.amount, p.amount, 0, 'paid',
                   p.payment_mode, 0, 0, 'payment'
            FROM inv_sales_payments p
            WHERE p.customer_id = $1
              ${from ? `AND p.payment_date >= '${from}'` : ''}
              ${to   ? `AND p.payment_date <= '${to}'`   : ''}
            ORDER BY invoice_date DESC, id DESC
        `, params);

        const advances = await db.query(`
            SELECT * FROM pos_advances WHERE customer_id = $1 ORDER BY received_date DESC
        `, [customerId]);

        const summary = {
            total_billed:   txns.rows.filter(t => t.txn_type === 'invoice').reduce((s, r) => s + parseFloat(r.total_amount), 0),
            total_paid:     txns.rows.filter(t => t.txn_type === 'invoice').reduce((s, r) => s + parseFloat(r.paid_amount), 0),
            outstanding:    parseFloat(cust.rows[0].current_balance),
            advances_total: advances.rows.reduce((s, r) => s + parseFloat(r.balance), 0),
        };

        res.json({ customer: cust.rows[0], transactions: txns.rows, advances: advances.rows, summary });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateCreditLimit = async (req, res) => {
    const { customerId } = req.params;
    const { credit_limit, credit_days } = req.body;
    try {
        const r = await db.query(
            `UPDATE inv_customers SET credit_limit=$1, credit_days=$2 WHERE id=$3 RETURNING *`,
            [credit_limit||0, credit_days||0, customerId]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ══════════════════════════════════════════════════════════════════
   CASH COUNTER / SHIFT MANAGEMENT
══════════════════════════════════════════════════════════════════ */
exports.getCurrentSession = async (req, res) => {
    try {
        const r = await db.query(`
            SELECT s.*, u.name AS opened_by_name, w.name AS warehouse_name
            FROM pos_sessions s
            LEFT JOIN users u ON u.id = s.opened_by
            LEFT JOIN rm_warehouses w ON w.id = s.warehouse_id
            WHERE s.status = 'open'
            ORDER BY s.opened_at DESC
            LIMIT 1
        `);
        res.json(r.rows[0] || null);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.openSession = async (req, res) => {
    const { opening_cash, warehouse_id, notes } = req.body;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        // Close any orphaned open sessions
        await client.query(
            `UPDATE pos_sessions SET status='closed', closed_at=NOW() WHERE status='open' AND opened_by=$1`,
            [req.user.id]
        );
        const r = await client.query(
            `INSERT INTO pos_sessions (opened_by, opening_cash, warehouse_id, notes, status)
             VALUES ($1,$2,$3,$4,'open') RETURNING *`,
            [req.user.id, opening_cash||0, warehouse_id||null, notes||null]
        );
        const sessId = r.rows[0].id;
        await client.query(
            `INSERT INTO pos_cash_movements (session_id, type, amount, reason, created_by)
             VALUES ($1,'opening',$2,'Shift opened',$3)`,
            [sessId, opening_cash||0, req.user.id]
        );
        await client.query('COMMIT');
        res.status(201).json(r.rows[0]);
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

exports.closeSession = async (req, res) => {
    const { id } = req.params;
    const { physical_cash, notes } = req.body;
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Get session + calculate expected cash
        const sess = await client.query(`SELECT * FROM pos_sessions WHERE id=$1`, [id]);
        if (!sess.rows.length) return res.status(404).json({ error: 'Session not found' });

        const today = sess.rows[0].opened_at.toISOString().split('T')[0];

        // Sum cash payments during session
        const cashSales = await client.query(`
            SELECT COALESCE(SUM(p.amount),0) AS cash_in
            FROM inv_sales_payments p
            WHERE p.payment_mode = 'cash'
              AND p.created_at >= $1 AND p.created_at <= NOW()
        `, [sess.rows[0].opened_at]);

        // Sum cash movements (cash_in - cash_out)
        const movements = await client.query(`
            SELECT COALESCE(SUM(CASE WHEN type='cash_in' THEN amount ELSE 0 END),0) AS cash_in,
                   COALESCE(SUM(CASE WHEN type='cash_out' THEN amount ELSE 0 END),0) AS cash_out
            FROM pos_cash_movements WHERE session_id=$1
        `, [id]);

        const opening     = parseFloat(sess.rows[0].opening_cash || 0);
        const cashIn      = parseFloat(cashSales.rows[0].cash_in || 0) + parseFloat(movements.rows[0].cash_in || 0);
        const cashOut     = parseFloat(movements.rows[0].cash_out || 0);
        const expected    = opening + cashIn - cashOut;
        const physical    = parseFloat(physical_cash || 0);
        const difference  = physical - expected;

        // Count today's orders
        const orders = await client.query(`
            SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount),0) AS total
            FROM inv_sales_invoices
            WHERE created_at >= $1 AND status != 'cancelled'
        `, [sess.rows[0].opened_at]);

        await client.query(
            `UPDATE pos_sessions SET
                status='closed', closed_at=NOW(), closed_by=$1,
                expected_cash=$2, physical_cash=$3, difference=$4,
                total_sales=$5, total_orders=$6, notes=$7
             WHERE id=$8`,
            [req.user.id, expected, physical, difference,
             orders.rows[0].total, orders.rows[0].cnt, notes||null, id]
        );
        await client.query(
            `INSERT INTO pos_cash_movements (session_id, type, amount, reason, created_by)
             VALUES ($1,'closing',$2,'Shift closed',$3)`,
            [id, physical, req.user.id]
        );
        await client.query('COMMIT');
        res.json({ expected_cash: expected, physical_cash: physical, difference, total_sales: orders.rows[0].total });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
};

exports.recordCashMovement = async (req, res) => {
    const { session_id, type, amount, reason } = req.body;
    if (!session_id || !type || !amount) return res.status(400).json({ error: 'session_id, type, amount required' });
    try {
        const r = await db.query(
            `INSERT INTO pos_cash_movements (session_id, type, amount, reason, created_by)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [session_id, type, amount, reason||null, req.user.id]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getSessionReport = async (req, res) => {
    const { id } = req.params;
    try {
        const sess = await db.query(`
            SELECT s.*, u.name AS opened_by_name, cb.name AS closed_by_name
            FROM pos_sessions s
            LEFT JOIN users u  ON u.id = s.opened_by
            LEFT JOIN users cb ON cb.id = s.closed_by
            WHERE s.id = $1
        `, [id]);
        if (!sess.rows.length) return res.status(404).json({ error: 'Not found' });

        const movements = await db.query(
            `SELECT * FROM pos_cash_movements WHERE session_id=$1 ORDER BY created_at`, [id]
        );
        const payBreakdown = await db.query(`
            SELECT payment_mode, COUNT(*) AS txns, SUM(amount) AS total
            FROM inv_sales_payments
            WHERE created_at >= $1 AND ($2::timestamp IS NULL OR created_at <= $2)
            GROUP BY payment_mode ORDER BY total DESC
        `, [sess.rows[0].opened_at, sess.rows[0].closed_at]);

        res.json({
            session: sess.rows[0],
            cash_movements: movements.rows,
            payment_breakdown: payBreakdown.rows,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.listSessions = async (req, res) => {
    try {
        const r = await db.query(`
            SELECT s.*, u.name AS opened_by_name
            FROM pos_sessions s
            LEFT JOIN users u ON u.id = s.opened_by
            ORDER BY s.opened_at DESC
            LIMIT 30
        `);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

/* ══════════════════════════════════════════════════════════════════
   BARCODE LABELS — get variants with all label data
══════════════════════════════════════════════════════════════════ */
exports.getBarcodeLabels = async (req, res) => {
    const { search, category_id, school_id } = req.query;
    try {
        const conds = ['v.is_active = true', 'p.is_active = true', '(v.barcode IS NOT NULL OR v.sku IS NOT NULL)'];
        const params = [];
        let i = 1;
        if (search)      { conds.push(`(p.name ILIKE $${i++} OR v.sku ILIKE $${i-1} OR v.barcode ILIKE $${i-1})`); params.push(`%${search}%`); }
        if (category_id) { conds.push(`p.category_id = $${i++}`); params.push(category_id); }
        if (school_id)   { conds.push(`v.school_id = $${i++}`); params.push(school_id); }

        const r = await db.query(`
            SELECT v.id AS variant_id, v.sku, v.barcode, v.size, v.color, v.sale_price, v.mrp,
                   p.name AS product_name, p.article_code,
                   sc.name AS school_name, cat.name AS category_name,
                   COALESCE(st.qty,0) AS stock
            FROM inv_variants v
            JOIN inv_products p ON p.id = v.product_id
            LEFT JOIN inv_schools sc ON sc.id = v.school_id
            LEFT JOIN inv_categories cat ON cat.id = p.category_id
            LEFT JOIN inv_stock st ON st.variant_id = v.id
            WHERE ${conds.join(' AND ')}
            ORDER BY p.name, v.size
            LIMIT 200
        `, params);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
};
