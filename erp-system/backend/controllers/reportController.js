const db = require('../config/db');
const { Parser } = require('json2csv');

// Helper: build entry query with filters
const buildQuery = (filters, role, userId) => {
    const conditions = [];
    const params = [];
    let idx = 1;
    if (filters.shop_id) { conditions.push(`de.shop_id = $${idx++}`); params.push(filters.shop_id); }
    if (filters.city_id) { conditions.push(`s.city_id = $${idx++}`); params.push(filters.city_id); }
    if (filters.from_date) { conditions.push(`de.date >= $${idx++}`); params.push(filters.from_date); }
    if (filters.to_date) { conditions.push(`de.date <= $${idx++}`); params.push(filters.to_date); }
    if (role === 'manager') {
        conditions.push(`s.user_id = $${idx++}`);
        params.push(userId);
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    return { where, params };
};

exports.downloadCSV = async (req, res) => {
    try {
        const { where, params } = buildQuery(req.query, req.user.role, req.user.id);
        const result = await db.query(
            `SELECT de.date, s.shop_name, de.total_sale, de.cash, de.paytm, de.razorpay, de.expense, de.difference
       FROM daily_entries de JOIN shops s ON de.shop_id = s.id ${where}
       ORDER BY de.date DESC LIMIT 5000`,
            params
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'No data found' });

        const fields = ['date', 'shop_name', 'total_sale', 'cash', 'paytm', 'razorpay', 'expense', 'difference'];
        const csv = new Parser({ fields }).parse(result.rows);
        res.header('Content-Type', 'text/csv');
        res.attachment('erp_report.csv');
        res.send(csv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getReportData = async (req, res) => {
    try {
        const { where, params } = buildQuery(req.query, req.user.role, req.user.id);
        const result = await db.query(
            `SELECT de.id, de.date, s.shop_name, c.name as city_name,
              de.total_sale, de.cash, de.paytm, de.razorpay, de.expense, de.difference, de.photo_url
       FROM daily_entries de
       JOIN shops s ON de.shop_id = s.id
       JOIN cities c ON s.city_id = c.id
       ${where}
       ORDER BY de.date DESC LIMIT 5000`,
            params
        );
        const summary = result.rows.reduce((acc, r) => ({
            total_sale: (acc.total_sale || 0) + parseFloat(r.total_sale || 0),
            total_cash: (acc.total_cash || 0) + parseFloat(r.cash || 0),
            total_online: (acc.total_online || 0) + parseFloat(r.paytm || 0) + parseFloat(r.razorpay || 0),
            total_expense: (acc.total_expense || 0) + parseFloat(r.expense || 0),
        }), {});
        res.json({ data: result.rows, summary, count: result.rows.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
