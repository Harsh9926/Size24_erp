// erp-system/backend/services/dailyReports.js
// Daily WhatsApp reports — run by cron in server.js, and on demand by admins
// via POST /api/notifications/daily-reports/:type (for testing).

const db = require('../config/db');
const wa = require('./aiSensyService');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* Today's date (YYYY-MM-DD) and display string in IST */
function todayIST() {
    const now = new Date();
    return {
        today:   now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
        dateStr: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }),
    };
}

async function getAdminManagerMobiles() {
    const { rows } = await db.query(`
        SELECT mobile FROM users
        WHERE role IN ('admin', 'manager') AND mobile IS NOT NULL AND status = 'active'
    `);
    return rows.map(r => r.mobile);
}

/* 1. Individual WhatsApp reminder to EVERY user of each shop missing today's entry
 * 2. Consolidated summary to all admins/managers */
async function sendDailyReminder() {
    if (!wa.ENABLED) return { skipped: true, reason: 'AISENSY_API_KEY not set' };
    const { today, dateStr } = todayIST();

    const { rows: missingShops } = await db.query(`
        SELECT DISTINCT s.id, s.shop_name
        FROM shops s
        WHERE s.id NOT IN (
            SELECT shop_id FROM daily_entries WHERE date = $1
        )
        ORDER BY s.shop_name
    `, [today]);

    console.log(`[cron] Reminder: ${missingShops.length} shops haven't submitted for ${today}`);
    if (missingShops.length === 0) return { date: today, missingShops: 0, sent: 0 };

    const shopIds   = missingShops.map(s => s.id);
    const shopNames = missingShops.map(s => s.shop_name).join(', ');

    const { rows: shopUsers } = await db.query(`
        SELECT DISTINCT u.mobile, s.shop_name
        FROM shop_users su
        JOIN users  u ON u.id  = su.user_id
        JOIN shops  s ON s.id  = su.shop_id
        WHERE su.shop_id = ANY($1::int[])
          AND u.mobile IS NOT NULL
          AND u.status = 'active'
    `, [shopIds]);

    for (const user of shopUsers) {
        await wa.notifyReminder(user.mobile, user.shop_name);
        await sleep(300); // rate-limit
    }
    console.log(`[cron] Sent ${shopUsers.length} individual reminders`);

    const admins = await getAdminManagerMobiles();
    for (const mobile of admins) {
        await wa.notifyAdminSummary(mobile, dateStr, missingShops.length, shopNames);
        await sleep(300);
    }
    console.log(`[cron] Sent summary to ${admins.length} admins/managers`);

    return { date: today, missingShops: missingShops.length, shopUsersNotified: shopUsers.length, adminsNotified: admins.length };
}

/* Shop-wise approved sales for today to all admins/managers */
async function sendSalesSummary() {
    if (!wa.ENABLED) return { skipped: true, reason: 'AISENSY_API_KEY not set' };
    const { today, dateStr } = todayIST();

    const { rows: shopSales } = await db.query(`
        SELECT s.shop_name,
               COALESCE(SUM(de.total_sale::NUMERIC), 0) AS total_sale
        FROM shops s
        LEFT JOIN daily_entries de ON de.shop_id = s.id
            AND de.date = $1
            AND de.approval_status = 'APPROVED'
        GROUP BY s.shop_name
        ORDER BY total_sale DESC
    `, [today]);

    const grandTotal = shopSales.reduce((sum, r) => sum + parseFloat(r.total_sale), 0);
    const totalStr   = grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    const breakdown  = shopSales
        .map(r => `${r.shop_name}: Rs.${parseFloat(r.total_sale).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`)
        .join(' | ');

    const admins = await getAdminManagerMobiles();
    for (const mobile of admins) {
        await wa.notifySalesSummary(mobile, dateStr, totalStr, breakdown);
        await sleep(300);
    }
    console.log(`[cron] Sent sales summary to ${admins.length} admins/managers (₹${totalStr})`);

    return { date: today, total: totalStr, adminsNotified: admins.length };
}

module.exports = { sendDailyReminder, sendSalesSummary };
