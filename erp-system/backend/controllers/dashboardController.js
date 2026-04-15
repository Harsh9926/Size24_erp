const db = require('../config/db');

// ── Admin Dashboard ──────────────────────────────────────────────
exports.getAdminDashboard = async (req, res) => {
    try {
        const { city_id, shop_id, period = 'monthly' } = req.query;

        // Build shop filter
        const shopFilter = [];
        const params = [];
        let idx = 1;
        if (city_id) { shopFilter.push(`s.city_id = $${idx++}`); params.push(city_id); }
        if (shop_id) { shopFilter.push(`de.shop_id = $${idx++}`); params.push(shop_id); }
        const where = shopFilter.length ? 'WHERE ' + shopFilter.join(' AND ') : '';

        // Summary totals
        const summaryQ = await db.query(
            `SELECT
        COALESCE(SUM(de.total_sale),0) AS total_sales,
        COALESCE(SUM(de.cash),0) AS total_cash,
        COALESCE(SUM(de.paytm + de.razorpay),0) AS total_online,
        COALESCE(SUM(de.expense),0) AS total_expense
       FROM daily_entries de
       JOIN shops s ON de.shop_id = s.id
       ${where}`,
            params
        );

        // Chart data
        let groupBy;
        if (period === 'daily') groupBy = "TO_CHAR(de.date, 'DD Mon')";
        else if (period === 'weekly') groupBy = "TO_CHAR(de.date, 'IYYY-IW')";
        else groupBy = "TO_CHAR(de.date, 'Mon YYYY')";

        const chartQ = await db.query(
            `SELECT ${groupBy} AS label,
              COALESCE(SUM(de.total_sale),0) AS sales,
              COALESCE(SUM(de.cash),0) AS cash,
              COALESCE(SUM(de.paytm + de.razorpay),0) AS online,
              COALESCE(SUM(de.expense),0) AS expense
       FROM daily_entries de
       JOIN shops s ON de.shop_id = s.id
       ${where}
       GROUP BY label ORDER BY MIN(de.date) DESC LIMIT 12`,
            params
        );

        // Recent entries
        const entriesQ = await db.query(
            `SELECT de.*, s.shop_name, c.name as city_name
       FROM daily_entries de
       JOIN shops s ON de.shop_id = s.id
       JOIN cities c ON s.city_id = c.id
       ${where}
       ORDER BY de.date DESC LIMIT 20`,
            params
        );

        // Pending users count
        const pendingQ = await db.query("SELECT COUNT(*) FROM users WHERE is_approved = false AND role != 'admin'");

        res.json({
            summary: summaryQ.rows[0],
            chartData: chartQ.rows.reverse(),
            latestEntries: entriesQ.rows,
            pendingUsersCount: parseInt(pendingQ.rows[0].count),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// ── Shop User Dashboard ──────────────────────────────────────────
exports.getShopDashboard = async (req, res) => {
    try {
        const shopId = req.user.shopId;
        if (!shopId) return res.status(403).json({ error: 'No shop assigned to your account' });

        const summaryQ = await db.query(
            `SELECT
        COALESCE(SUM(total_sale),0) AS total_sales,
        COALESCE(SUM(cash),0) AS total_cash,
        COALESCE(SUM(paytm + razorpay),0) AS total_online,
        COALESCE(SUM(expense),0) AS total_expense
       FROM daily_entries
       WHERE shop_id = $1 AND date >= date_trunc('month', CURRENT_DATE)`,
            [shopId]
        );
        const entriesQ = await db.query(
            'SELECT * FROM daily_entries WHERE shop_id = $1 ORDER BY date DESC LIMIT 30',
            [shopId]
        );
        const shopQ = await db.query(
            'SELECT shop_name, latitude, longitude FROM shops WHERE id = $1',
            [shopId]
        );
        res.json({
            summary: summaryQ.rows[0],
            latestEntries: entriesQ.rows,
            shop: shopQ.rows[0] || null,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── Manager Dashboard (scoped to assigned shop) ──────────────────
exports.getManagerDashboard = async (req, res) => {
    try {
        const managerId = req.user.id;
        const shopQ = await db.query('SELECT id, shop_name FROM shops WHERE user_id = $1', [managerId]);
        if (shopQ.rows.length === 0) return res.json({ summary: {}, chartData: [], latestEntries: [], shops: [] });

        const shopIds = shopQ.rows.map(s => s.id);
        const placeholder = shopIds.map((_, i) => `$${i + 1}`).join(',');

        const summaryQ = await db.query(
            `SELECT COALESCE(SUM(total_sale),0) AS total_sales, COALESCE(SUM(cash),0) AS total_cash,
              COALESCE(SUM(paytm + razorpay),0) AS total_online, COALESCE(SUM(expense),0) AS total_expense
       FROM daily_entries WHERE shop_id IN (${placeholder})`,
            shopIds
        );
        const chartQ = await db.query(
            `SELECT TO_CHAR(date, 'DD Mon') AS label,
              SUM(total_sale) AS sales, SUM(cash) AS cash,
              SUM(paytm + razorpay) AS online, SUM(expense) AS expense
       FROM daily_entries WHERE shop_id IN (${placeholder})
       GROUP BY label ORDER BY MIN(date) DESC LIMIT 12`,
            shopIds
        );
        const entriesQ = await db.query(
            `SELECT de.*, s.shop_name FROM daily_entries de
       JOIN shops s ON de.shop_id = s.id
       WHERE de.shop_id IN (${placeholder})
       ORDER BY de.date DESC LIMIT 20`,
            shopIds
        );
        res.json({ summary: summaryQ.rows[0], chartData: chartQ.rows.reverse(), latestEntries: entriesQ.rows, shops: shopQ.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
