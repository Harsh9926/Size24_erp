const db = require('../config/db');

/* ─────────────────────────────────────────────────────────────────
   GET /api/payment-in/admins
   Shop user fetches the list of admins to direct their payment to.
───────────────────────────────────────────────────────────────── */
exports.getAdmins = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, name, mobile
             FROM users
             WHERE role = 'admin' AND is_approved = true
             ORDER BY name`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[PaymentIn] getAdmins:', err.message);
        res.status(500).json({ error: err.message });
    }
};

/* ─────────────────────────────────────────────────────────────────
   POST /api/payment-in
   Shop user records a Payment In amount.
   - Creates a row in admin_bank_ledger (PAYMENT_IN)
   - Does NOT affect: daily_entries, shop wallet, sales totals
───────────────────────────────────────────────────────────────── */
exports.createPaymentIn = async (req, res) => {
    const { amount, admin_id, remarks } = req.body;
    const userId = req.user.id;

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0)
        return res.status(400).json({ error: 'A positive amount is required.' });
    if (!admin_id)
        return res.status(400).json({ error: 'Please select an admin bank account.' });

    try {
        // Resolve shop for the submitting user
        const shopQ = await db.query(
            `SELECT s.id, s.shop_name
             FROM shop_users su
             JOIN shops s ON s.id = su.shop_id
             WHERE su.user_id = $1
             LIMIT 1`,
            [userId]
        );
        const shop = shopQ.rows[0] || null;

        // Resolve admin name
        const adminQ = await db.query(
            `SELECT id, name FROM users WHERE id = $1 AND role = 'admin'`,
            [parseInt(admin_id)]
        );
        if (!adminQ.rows.length)
            return res.status(404).json({ error: 'Selected admin not found.' });

        // Resolve creator name
        const userQ = await db.query(`SELECT name FROM users WHERE id = $1`, [userId]);
        const creatorName = userQ.rows[0]?.name || String(userId);

        const result = await db.query(
            `INSERT INTO admin_bank_ledger
                (transaction_type, amount, shop_id, shop_name, admin_id,
                 remarks, created_by, created_by_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                'PAYMENT_IN',
                amt,
                shop?.id   || null,
                shop?.shop_name || null,
                parseInt(admin_id),
                remarks?.trim() || null,
                userId,
                creatorName,
            ]
        );

        // Audit log
        await db.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
             VALUES ('admin_bank_ledger', $1, NULL, $2, $3)`,
            [
                result.rows[0].id,
                JSON.stringify(result.rows[0]),
                userId,
            ]
        ).catch(() => {}); // non-fatal

        console.log(
            `[PaymentIn] Shop user ${userId} (${shop?.shop_name}) recorded ₹${amt} ` +
            `to admin ${admin_id}`
        );

        res.status(201).json({
            message: 'Payment In recorded successfully.',
            entry:   result.rows[0],
        });
    } catch (err) {
        console.error('[PaymentIn] createPaymentIn:', err.message);
        res.status(500).json({ error: err.message });
    }
};

/* ─────────────────────────────────────────────────────────────────
   GET /api/payment-in
   Admin views all Admin Bank Ledger entries.
   Filters: type, shop_id, admin_id, from_date, to_date
───────────────────────────────────────────────────────────────── */
exports.getLedger = async (req, res) => {
    const { type, shop_id, admin_id, from_date, to_date, limit = 200 } = req.query;

    const conditions = [];
    const params     = [];
    let   idx        = 1;

    if (type)      { conditions.push(`abl.transaction_type = $${idx++}`); params.push(type); }
    if (shop_id)   { conditions.push(`abl.shop_id = $${idx++}`);          params.push(parseInt(shop_id)); }
    if (admin_id)  { conditions.push(`abl.admin_id = $${idx++}`);         params.push(parseInt(admin_id)); }
    if (from_date) { conditions.push(`abl.created_at >= $${idx++}`);      params.push(from_date); }
    if (to_date)   { conditions.push(`abl.created_at < ($${idx++}::date + INTERVAL '1 day')`); params.push(to_date); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    params.push(parseInt(limit));

    try {
        const result = await db.query(
            `SELECT
                abl.*,
                a.name  AS admin_name,
                a.mobile AS admin_mobile
             FROM admin_bank_ledger abl
             LEFT JOIN users a ON abl.admin_id = a.id
             ${where}
             ORDER BY abl.created_at DESC
             LIMIT $${idx}`,
            params
        );

        // Summary totals for the filtered set
        const totalPaymentIn = result.rows
            .filter(r => r.transaction_type === 'PAYMENT_IN')
            .reduce((s, r) => s + parseFloat(r.amount), 0);

        const totalBankDeposit = result.rows
            .filter(r => r.transaction_type === 'MANAGER_BANK_DEPOSIT')
            .reduce((s, r) => s + parseFloat(r.amount), 0);

        res.json({
            entries:           result.rows,
            count:             result.rows.length,
            totalPaymentIn,
            totalBankDeposit,
            grandTotal:        totalPaymentIn + totalBankDeposit,
        });
    } catch (err) {
        console.error('[PaymentIn] getLedger:', err.message);
        res.status(500).json({ error: err.message });
    }
};
