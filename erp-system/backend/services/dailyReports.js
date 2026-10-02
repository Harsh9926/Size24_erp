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

/* Today's attendance summary to all admins/managers. Employees = active
 * shop_user/manager accounts. Week-off (manual or auto from week_off_days),
 * leave and holiday days are reported separately — never as absent. */
async function sendAttendanceSummary() {
    if (!wa.ENABLED) return { skipped: true, reason: 'AISENSY_API_KEY not set' };
    const { today, dateStr } = todayIST();
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0=Sun … 6=Sat

    const { rows } = await db.query(`
        SELECT u.name,
               a.punch_in_at, a.attendance_status, a.punch_in_status,
               COALESCE(us.week_off_days, gs.week_off_days, '{0}') AS week_off_days,
               (SELECT s.shop_name FROM shops s WHERE s.id = COALESCE(
                    (SELECT asu.shop_id FROM attendance_shop_users asu
                     WHERE asu.user_id = u.id ORDER BY asu.assigned_at DESC LIMIT 1),
                    (SELECT su.shop_id FROM shop_users su
                     WHERE su.user_id = u.id ORDER BY su.assigned_at DESC LIMIT 1))) AS shop_name
        FROM users u
        LEFT JOIN attendance a               ON a.user_id = u.id AND a.date = $1
        LEFT JOIN attendance_user_settings us ON us.user_id = u.id
        LEFT JOIN attendance_settings gs      ON gs.id = 1
        WHERE u.status = 'active' AND u.role IN ('shop_user', 'manager')
        ORDER BY u.name
    `, [today]);

    let present = 0, late = 0, off = 0;
    const absentNames = [];
    for (const r of rows) {
        const st = r.attendance_status;
        if (r.punch_in_at) {
            present++;
            if (st === 'late' || r.punch_in_status === 'late') late++;
        } else if (['week_off', 'paid_leave', 'unpaid_leave', 'holiday'].includes(st)
                   || (r.week_off_days || []).map(Number).includes(weekday)) {
            off++;
        } else {
            absentNames.push(r.shop_name ? `${r.name} (${r.shop_name})` : (r.name || 'Unnamed'));
        }
    }

    let absentList = absentNames.join(', ') || 'None';
    if (absentList.length > 900) absentList = absentList.slice(0, 897) + '...'; // WhatsApp param limit

    const admins = await getAdminManagerMobiles();
    for (const mobile of admins) {
        await wa.notifyAttendanceSummary(mobile, dateStr, rows.length, present, absentNames.length, late, off, absentList);
        await sleep(300);
    }
    console.log(`[cron] Sent attendance summary to ${admins.length} admins/managers (${present}/${rows.length} present)`);

    return { date: today, total: rows.length, present, absent: absentNames.length, late, offOrLeave: off, adminsNotified: admins.length };
}

module.exports = { sendDailyReminder, sendSalesSummary, sendAttendanceSummary };
