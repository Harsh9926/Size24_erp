const db = require('../config/db');

/* ── GET /api/expenses  ─────────────────────────────────────────
   Query params: shop_id, from_date, to_date, category
──────────────────────────────────────────────────────────────── */
exports.getExpenses = async (req, res) => {
    try {
        const { shop_id, from_date, to_date, category } = req.query;
        const conds  = [];
        const params = [];
        let   idx    = 1;

        if (shop_id)   { conds.push(`e.shop_id = $${idx++}`);  params.push(shop_id); }
        if (from_date) { conds.push(`e.date >= $${idx++}`);    params.push(from_date); }
        if (to_date)   { conds.push(`e.date <= $${idx++}`);    params.push(to_date); }
        if (category)  { conds.push(`e.category = $${idx++}`); params.push(category); }

        // Managers see only their shop expenses
        if (req.user.role === 'manager') {
            conds.push(`s.user_id = $${idx++}`);
            params.push(req.user.id);
        }

        const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

        const result = await db.query(
            `SELECT e.*, s.shop_name, u.name AS added_by_name
             FROM expenses e
             JOIN shops s ON e.shop_id = s.id
             LEFT JOIN users u ON u.id = e.created_by
             ${where}
             ORDER BY e.date DESC, e.created_at DESC
             LIMIT 1000`,
            params,
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/* ── POST /api/expenses ─────────────────────────────────────── */
exports.createExpense = async (req, res) => {
    const { shop_id, date, amount, category, note } = req.body;
    if (!shop_id || !date || !amount) {
        return res.status(400).json({ error: 'shop_id, date and amount are required' });
    }
    try {
        const result = await db.query(
            `INSERT INTO expenses (shop_id, date, amount, category, note, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [shop_id, date, parseFloat(amount), category || 'General', note || null, req.user.id],
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/* ── PUT /api/expenses/:id ──────────────────────────────────── */
exports.updateExpense = async (req, res) => {
    const { amount, category, note, date } = req.body;
    try {
        const result = await db.query(
            `UPDATE expenses
             SET amount = COALESCE($1, amount),
                 category = COALESCE($2, category),
                 note = COALESCE($3, note),
                 date = COALESCE($4, date)
             WHERE id = $5 RETURNING *`,
            [amount ? parseFloat(amount) : null, category || null, note || null, date || null, req.params.id],
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/* ── DELETE /api/expenses/:id ───────────────────────────────── */
exports.deleteExpense = async (req, res) => {
    try {
        const result = await db.query('DELETE FROM expenses WHERE id = $1 RETURNING id', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ message: 'Expense deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
