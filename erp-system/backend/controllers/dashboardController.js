const db = require('../config/db');

// ── Admin Dashboard ──────────────────────────────────────────────
exports.getAdminDashboard = async (req, res) => {
    try {
        const { city_id, shop_id, period = 'monthly' } = req.query;

        // Build WHERE clauses — always filter to APPROVED entries only
        const conditions = [`de.approval_status = 'APPROVED'`];
        const params = [];
        let idx = 1;

        if (city_id) { conditions.push(`s.city_id = $${idx++}`); params.push(city_id); }
        if (shop_id) { conditions.push(`de.shop_id = $${idx++}`); params.push(shop_id); }

        const where = 'WHERE ' + conditions.join(' AND ');

        // ── Summary totals (approved only) ───────────────────────
        const summaryQ = await db.query(
            `SELECT
               COALESCE(SUM(de.total_sale), 0)             AS total_sales,
               COALESCE(SUM(de.cash), 0)                   AS total_cash,
               COALESCE(SUM(de.online + de.razorpay), 0)   AS total_online
             FROM daily_entries de
             JOIN shops s ON de.shop_id = s.id
             ${where}`,
            params
        );

        console.log('[Dashboard] Summary query result:', summaryQ.rows[0]);

        // ── Chart data ───────────────────────────────────────────
        let groupBy;
        if (period === 'daily')       groupBy = "TO_CHAR(de.date, 'DD Mon')";
        else if (period === 'weekly') groupBy = "TO_CHAR(de.date, 'IYYY-IW')";
        else                          groupBy = "TO_CHAR(de.date, 'Mon YYYY')";

        const chartQ = await db.query(
            `SELECT ${groupBy} AS label,
               COALESCE(SUM(de.total_sale), 0)                 AS sales,
               COALESCE(SUM(de.cash), 0)                       AS cash,
               COALESCE(SUM(de.online + de.razorpay), 0)       AS online,
               COALESCE(SUM(de.expense), 0)                    AS expense
             FROM daily_entries de
             JOIN shops s ON de.shop_id = s.id
             ${where}
             GROUP BY label ORDER BY MIN(de.date) DESC LIMIT 12`,
            params
        );

        // ── Recent entries (ALL statuses, scoped by shop/city filter) ─
        // Build a separate WHERE for entries that shows all statuses so admin
        // can see pending/rejected entries too (not just approved ones).
        const entryConditions = [];
        const entryParams = [];
        let eIdx = 1;
        if (city_id) { entryConditions.push(`s.city_id = $${eIdx++}`); entryParams.push(city_id); }
        if (shop_id) { entryConditions.push(`de.shop_id = $${eIdx++}`); entryParams.push(shop_id); }
        const entryWhere = entryConditions.length ? 'WHERE ' + entryConditions.join(' AND ') : '';

        const entriesQ = await db.query(
            `SELECT de.*, s.shop_name,
                    c.name AS city_name,
                    u.name AS approved_by_name
             FROM daily_entries de
             JOIN shops s ON de.shop_id = s.id
             LEFT JOIN cities c ON s.city_id = c.id
             LEFT JOIN users u ON de.approved_by = u.id
             ${entryWhere}
             ORDER BY de.created_at DESC LIMIT 20`,
            entryParams
        );

        console.log('[Dashboard] All recent entries returned:', entriesQ.rows.length);

        // ── Pending users count ──────────────────────────────────
        const pendingQ = await db.query(
            "SELECT COUNT(*) FROM users WHERE is_approved = false"
        );

        // ── Pending entries count ────────────────────────────────
        const pendingEntriesQ = await db.query(
            "SELECT COUNT(*) FROM daily_entries WHERE approval_status = 'PENDING'"
        );

        const summary = summaryQ.rows[0];

        res.json({
            // Flat keys expected by the frontend analytics cards
            totalSales:  parseFloat(summary.total_sales),
            totalCash:   parseFloat(summary.total_cash),
            totalOnline: parseFloat(summary.total_online),
            entries: entriesQ.rows,

            // Nested keys kept for backward compatibility
            summary,
            chartData: chartQ.rows.reverse(),
            latestEntries: entriesQ.rows,
            pendingUsersCount:   parseInt(pendingQ.rows[0].count),
            pendingEntriesCount: parseInt(pendingEntriesQ.rows[0].count),
        });
    } catch (err) {
        console.error('[Dashboard] getAdminDashboard error:', err.message);
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
               COALESCE(SUM(total_sale), 0)           AS total_sales,
               COALESCE(SUM(cash), 0)                 AS total_cash,
               COALESCE(SUM(online + razorpay), 0)    AS total_online
             FROM daily_entries
             WHERE shop_id = $1
               AND approval_status = 'APPROVED'
               AND date >= date_trunc('month', CURRENT_DATE)`,
            [shopId]
        );

        const entriesQ = await db.query(
            `SELECT * FROM daily_entries
             WHERE shop_id = $1
             ORDER BY date DESC LIMIT 30`,
            [shopId]
        );

        console.log('[Dashboard] Shop entries returned:', entriesQ.rows.length);

        const shopQ = await db.query(
            'SELECT shop_name, latitude, longitude FROM shops WHERE id = $1',
            [shopId]
        );

        const summary = summaryQ.rows[0];

        res.json({
            totalSales:  parseFloat(summary.total_sales),
            totalCash:   parseFloat(summary.total_cash),
            totalOnline: parseFloat(summary.total_online),
            entries: entriesQ.rows,

            summary,
            latestEntries: entriesQ.rows,
            shop: shopQ.rows[0] || null,
        });
    } catch (err) {
        console.error('[Dashboard] getShopDashboard error:', err.message);
        res.status(500).json({ error: err.message });
    }
};

// ── Manager Dashboard (scoped to assigned shops) ─────────────────
exports.getManagerDashboard = async (req, res) => {
    try {
        const managerId = req.user.id;
        const shopQ = await db.query(
            'SELECT id, shop_name FROM shops WHERE user_id = $1',
            [managerId]
        );

        if (shopQ.rows.length === 0) {
            return res.json({ summary: {}, chartData: [], latestEntries: [], shops: [], totalSales: 0, totalCash: 0, totalOnline: 0, entries: [] });
        }

        const shopIds     = shopQ.rows.map(s => s.id);
        const placeholder = shopIds.map((_, i) => `$${i + 1}`).join(',');

        const summaryQ = await db.query(
            `SELECT
               COALESCE(SUM(total_sale), 0)           AS total_sales,
               COALESCE(SUM(cash), 0)                 AS total_cash,
               COALESCE(SUM(online + razorpay), 0)    AS total_online
             FROM daily_entries
             WHERE approval_status = 'APPROVED'
               AND shop_id IN (${placeholder})`,
            shopIds
        );

        const chartQ = await db.query(
            `SELECT TO_CHAR(date, 'DD Mon') AS label,
               SUM(total_sale)           AS sales,
               SUM(cash)                 AS cash,
               SUM(online + razorpay)    AS online
             FROM daily_entries
             WHERE approval_status = 'APPROVED'
               AND shop_id IN (${placeholder})
             GROUP BY label ORDER BY MIN(date) DESC LIMIT 12`,
            shopIds
        );

        const entriesQ = await db.query(
            `SELECT de.*, s.shop_name
             FROM daily_entries de
             JOIN shops s ON de.shop_id = s.id
             WHERE de.approval_status = 'APPROVED'
               AND de.shop_id IN (${placeholder})
             ORDER BY de.date DESC LIMIT 20`,
            shopIds
        );

        console.log('[Dashboard] Manager approved entries returned:', entriesQ.rows.length);

        const summary = summaryQ.rows[0];

        res.json({
            totalSales:  parseFloat(summary.total_sales),
            totalCash:   parseFloat(summary.total_cash),
            totalOnline: parseFloat(summary.total_online),
            entries: entriesQ.rows,

            summary,
            chartData: chartQ.rows.reverse(),
            latestEntries: entriesQ.rows,
            shops: shopQ.rows,
        });
    } catch (err) {
        console.error('[Dashboard] getManagerDashboard error:', err.message);
        res.status(500).json({ error: err.message });
    }
};
