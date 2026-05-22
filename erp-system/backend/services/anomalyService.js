const db = require('../config/db');

/*
 * Batch anomaly detection — single SQL query, rules applied in JS.
 *
 * Rules:
 *   ZERO_SALE       — total_sale = 0 (non no_sale entry)
 *   ODD_HOURS       — submitted before 6 AM or after 11 PM IST
 *   SUDDEN_DROP     — sale < 50% of shop's 30-day approved average (≥5 data points)
 *   SUDDEN_SPIKE    — sale > 250% of 30-day average
 *   ALL_CASH        — 100% cash when shop's normal cash ratio < 80%
 *   REPEATED_AMOUNT — exact same total_sale repeated ≥ 2 times in last 7 days
 */

const RULES = {
    ZERO_SALE:       { label: 'Zero Sales',        severity: 'high'   },
    ODD_HOURS:       { label: 'Odd Submission Time',severity: 'medium' },
    SUDDEN_DROP:     { label: 'Sudden Sales Drop',  severity: 'high'   },
    SUDDEN_SPIKE:    { label: 'Unusual Sales Spike',severity: 'medium' },
    ALL_CASH:        { label: 'All-Cash Entry',     severity: 'medium' },
    REPEATED_AMOUNT: { label: 'Repeated Amount',    severity: 'high'   },
};

function applyRules(row) {
    const flags = [];
    const total      = parseFloat(row.total_sale  || 0);
    const cash       = parseFloat(row.cash        || 0);
    const avg        = parseFloat(row.avg_sale    || 0);
    const cashRatio  = parseFloat(row.avg_cash_ratio || 0);
    const entryCount = parseInt(row.entry_count   || 0);
    const istHour    = parseFloat(row.ist_hour    || 12);
    const repeatCnt  = parseInt(row.repeat_count  || 0);

    if (row.entry_type === 'no_sale') return flags;

    if (total === 0) {
        flags.push({ code: 'ZERO_SALE', ...RULES.ZERO_SALE, detail: 'Entry submitted with ₹0 total sale' });
        return flags;
    }

    if (istHour < 6 || istHour >= 23) {
        const hh = Math.floor(istHour);
        const mm = String(Math.round((istHour % 1) * 60)).padStart(2, '0');
        flags.push({ code: 'ODD_HOURS', ...RULES.ODD_HOURS, detail: `Submitted at ${hh}:${mm} IST` });
    }

    if (entryCount >= 5 && avg > 0) {
        const pct = Math.round((total / avg) * 100);
        if (total < avg * 0.50) {
            flags.push({ code: 'SUDDEN_DROP', ...RULES.SUDDEN_DROP,
                detail: `₹${fmt(total)} is ${pct}% of 30-day avg ₹${fmt(avg)}` });
        } else if (total > avg * 2.50) {
            flags.push({ code: 'SUDDEN_SPIKE', ...RULES.SUDDEN_SPIKE,
                detail: `₹${fmt(total)} is ${pct}% of 30-day avg ₹${fmt(avg)}` });
        }
    }

    const todayCashRatio = total > 0 ? cash / total : 0;
    if (entryCount >= 5 && cashRatio < 0.80 && todayCashRatio === 1) {
        flags.push({ code: 'ALL_CASH', ...RULES.ALL_CASH,
            detail: `100% cash today vs usual ${Math.round(cashRatio * 100)}% cash ratio` });
    }

    if (repeatCnt >= 2) {
        flags.push({ code: 'REPEATED_AMOUNT', ...RULES.REPEATED_AMOUNT,
            detail: `Amount ₹${fmt(total)} repeated ${repeatCnt}× this week` });
    }

    return flags;
}

function fmt(n) {
    return Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/* ── Main export: get anomalous entries ─────────────────────────── */
async function getAnomalies({ fromDate, toDate, shopId, status } = {}) {
    const from  = fromDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const to    = toDate   || new Date().toISOString().split('T')[0];

    const params = [from, to];
    let shopFilter = '';
    if (shopId) { params.push(shopId); shopFilter = `AND de.shop_id = $${params.length}`; }

    let statusFilter = '';
    if (status) { params.push(status); statusFilter = `AND de.approval_status = $${params.length}`; }

    const sql = `
        WITH shop_stats AS (
            SELECT
                shop_id,
                COUNT(*)                                                                AS entry_count,
                AVG(total_sale::NUMERIC)                                                AS avg_sale,
                AVG(CASE WHEN total_sale::NUMERIC > 0
                    THEN cash::NUMERIC / total_sale::NUMERIC ELSE 0 END)                AS avg_cash_ratio
            FROM daily_entries
            WHERE approval_status = 'APPROVED'
              AND date >= CURRENT_DATE - INTERVAL '30 days'
              AND entry_type != 'no_sale'
            GROUP BY shop_id
        ),
        repeat_amounts AS (
            SELECT shop_id, total_sale, COUNT(*) AS repeat_count
            FROM daily_entries
            WHERE date >= CURRENT_DATE - INTERVAL '7 days'
              AND total_sale::NUMERIC > 0
            GROUP BY shop_id, total_sale
            HAVING COUNT(*) >= 2
        )
        SELECT
            de.id, de.shop_id, de.date,
            de.total_sale, de.cash, de.online, de.razorpay,
            de.approval_status, de.created_at, de.entry_type,
            s.shop_name,
            ss.avg_sale, ss.avg_cash_ratio, ss.entry_count,
            ra.repeat_count,
            EXTRACT(HOUR FROM de.created_at AT TIME ZONE 'Asia/Kolkata') AS ist_hour
        FROM daily_entries de
        JOIN  shops s ON s.id = de.shop_id
        LEFT JOIN shop_stats    ss ON ss.shop_id = de.shop_id
        LEFT JOIN repeat_amounts ra ON ra.shop_id = de.shop_id AND ra.total_sale = de.total_sale
        WHERE de.date >= $1 AND de.date <= $2
          AND de.entry_type != 'no_sale'
          ${shopFilter}
          ${statusFilter}
        ORDER BY de.created_at DESC
        LIMIT 500
    `;

    const { rows } = await db.query(sql, params);

    return rows
        .map(row => ({ ...row, anomaly_flags: applyRules(row) }))
        .filter(row => row.anomaly_flags.length > 0);
}

/* ── Single entry check (used inline after create) ──────────────── */
async function checkEntry(entryId) {
    const { rows } = await db.query(`
        WITH shop_stats AS (
            SELECT shop_id,
                COUNT(*)                                                          AS entry_count,
                AVG(total_sale::NUMERIC)                                          AS avg_sale,
                AVG(CASE WHEN total_sale::NUMERIC > 0
                    THEN cash::NUMERIC / total_sale::NUMERIC ELSE 0 END)          AS avg_cash_ratio
            FROM daily_entries
            WHERE approval_status = 'APPROVED'
              AND date >= CURRENT_DATE - INTERVAL '30 days'
              AND entry_type != 'no_sale'
            GROUP BY shop_id
        ),
        repeat_amounts AS (
            SELECT shop_id, total_sale, COUNT(*) AS repeat_count
            FROM daily_entries
            WHERE date >= CURRENT_DATE - INTERVAL '7 days'
              AND total_sale::NUMERIC > 0
            GROUP BY shop_id, total_sale
            HAVING COUNT(*) >= 2
        )
        SELECT de.*,
            ss.avg_sale, ss.avg_cash_ratio, ss.entry_count,
            ra.repeat_count,
            EXTRACT(HOUR FROM de.created_at AT TIME ZONE 'Asia/Kolkata') AS ist_hour
        FROM daily_entries de
        LEFT JOIN shop_stats     ss ON ss.shop_id = de.shop_id
        LEFT JOIN repeat_amounts ra ON ra.shop_id = de.shop_id AND ra.total_sale = de.total_sale
        WHERE de.id = $1
    `, [entryId]);

    return rows.length ? applyRules(rows[0]) : [];
}

module.exports = { getAnomalies, checkEntry, RULES };
