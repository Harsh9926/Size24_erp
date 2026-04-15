const db = require('../config/db');

exports.createEntry = async (req, res) => {
    try {
        const { shop_id, date, total_sale, cash, paytm, razorpay, expense } = req.body;

        // Validation: Total Sale = Cash + QR/Card/Bank + Expense
        const difference = parseFloat(total_sale) - (parseFloat(cash) + parseFloat(paytm || 0) + parseFloat(razorpay || 0) + parseFloat(expense));
        if (Math.abs(difference) > 0.01) {
            return res.status(400).json({ error: 'Difference must be 0. Total Sale must equal Cash + QR/Card/Bank + Expense' });
        }

        const result = await db.query(
            `INSERT INTO daily_entries (
        shop_id, date, total_sale, cash, paytm, razorpay, expense, difference
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [shop_id, date, total_sale, cash, paytm, razorpay, expense, difference]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.constraint === 'daily_entries_shop_id_date_key') {
            return res.status(400).json({ error: 'Entry for this date already exists. Please edit instead.' });
        }
        res.status(500).json({ error: err.message });
    }
};

exports.updateEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const { total_sale, cash, paytm, razorpay, expense } = req.body;

        // Check if entry exists and its lock status
        const entryResult = await db.query('SELECT * FROM daily_entries WHERE id = $1', [id]);
        if (entryResult.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });

        const entry = entryResult.rows[0];

        // Authorization: User must be admin, or the shop must belong to the user
        // In production, you'd join with shops to verify shop.user_id = req.user.id
        if (req.user.role === 'shop_user') {
            if (entry.shop_id !== req.user.shopId) {
                return res.status(403).json({ error: 'Deny: this entry does not belong to your shop' });
            }
        }

        // Lock check
        if (entry.locked) {
            // Allow if unlocked and current time < edit_enabled_till
            if (!entry.edit_enabled_till || new Date() > new Date(entry.edit_enabled_till)) {
                return res.status(403).json({ error: 'Entry is locked and cannot be edited. Request admin to unlock.' });
            }
        }

        const difference = parseFloat(total_sale) - (parseFloat(cash) + parseFloat(paytm || 0) + parseFloat(razorpay || 0) + parseFloat(expense));
        if (Math.abs(difference) > 0.01) {
            return res.status(400).json({ error: 'Difference must be 0. Total Sale must equal Cash + QR/Card/Bank + Expense' });
        }

        // Insert an audit log (fire & forget for simplicity, or await)
        await db.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by) 
       VALUES ($1, $2, $3, $4, $5)`,
            ['daily_entries', id, entry, req.body, req.user.id]
        );

        const result = await db.query(
            `UPDATE daily_entries SET 
        total_sale = $1, cash = $2, paytm = $3, razorpay = $4, expense = $5, difference = $6
       WHERE id = $7 RETURNING *`,
            [total_sale, cash, paytm, razorpay, expense, difference, id]
        );

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getEntries = async (req, res) => {
    try {
        let query = 'SELECT e.*, s.shop_name FROM daily_entries e JOIN shops s ON e.shop_id = s.id';
        let params = [];

        if (req.user.role === 'shop_user') {
            query += ' WHERE e.shop_id = $1';
            params.push(req.user.shopId);
        }

        query += ' ORDER BY e.date DESC';
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.unlockEntry = async (req, res) => {
    try {
        const { id } = req.params;

        // Unlock for 10 minutes
        const unlockTill = new Date();
        unlockTill.setMinutes(unlockTill.getMinutes() + 10);

        const result = await db.query(
            'UPDATE daily_entries SET locked = true, edit_enabled_till = $1 WHERE id = $2 RETURNING *',
            [unlockTill, id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });

        res.json({ message: 'Entry unlocked for 10 minutes', entry: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
