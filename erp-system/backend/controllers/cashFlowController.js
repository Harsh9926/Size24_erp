const db = require('../config/db');

exports.createCashFlow = async (req, res) => {
    try {
        const { shop_id, amount, type, done_by, note, date } = req.body;

        // Auth Check
        if (req.user.role === 'shop_user' && req.user.shopId !== parseInt(shop_id)) {
            return res.status(403).json({ error: 'Deny: cannot create cash flow for another shop.' });
        }

        const result = await db.query(
            `INSERT INTO cash_flows (shop_id, amount, type, done_by, note, date) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [shop_id, amount, type, done_by, note, date]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getCashFlows = async (req, res) => {
    try {
        let query = 'SELECT cf.*, s.shop_name FROM cash_flows cf JOIN shops s ON cf.shop_id = s.id';
        let params = [];

        if (req.user.role === 'shop_user') {
            query += ' WHERE cf.shop_id = $1';
            params.push(req.user.shopId);
        }

        query += ' ORDER BY cf.date DESC';
        const result = await db.query(query, params);

        // Optional: Calculate Balance
        let totalDeposit = 0;
        let totalExpense = 0;
        result.rows.forEach(row => {
            if (row.type === 'deposit') totalDeposit += parseFloat(row.amount);
            if (row.type === 'expense') totalExpense += parseFloat(row.amount);
        });

        res.json({
            data: result.rows,
            summary: {
                totalDeposit,
                totalExpense,
                balance: totalDeposit - totalExpense
            }
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
