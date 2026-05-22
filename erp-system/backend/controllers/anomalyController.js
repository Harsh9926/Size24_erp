const { getAnomalies, RULES } = require('../services/anomalyService');

exports.listAnomalies = async (req, res) => {
    try {
        const { from, to, shop_id, status } = req.query;
        const rows = await getAnomalies({
            fromDate: from   || undefined,
            toDate:   to     || undefined,
            shopId:   shop_id ? parseInt(shop_id) : undefined,
            status:   status || undefined,
        });
        res.json(rows);
    } catch (err) {
        console.error('[Anomaly] listAnomalies:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.getSummary = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

        const [todayRows, weekRows] = await Promise.all([
            getAnomalies({ fromDate: today, toDate: today }),
            getAnomalies({ fromDate: weekAgo, toDate: today }),
        ]);

        const countByCode = {};
        weekRows.forEach(r => {
            r.anomaly_flags.forEach(f => {
                countByCode[f.code] = (countByCode[f.code] || 0) + 1;
            });
        });

        res.json({
            today_count:  todayRows.length,
            week_count:   weekRows.length,
            by_type: Object.entries(countByCode).map(([code, count]) => ({
                code, count, ...RULES[code],
            })).sort((a, b) => b.count - a.count),
        });
    } catch (err) {
        console.error('[Anomaly] getSummary:', err.message);
        res.status(500).json({ error: err.message });
    }
};
