const db = require('../config/db');

async function buildContext() {
    const today = new Date().toISOString().split('T')[0];

    const [entries, recentEntries, shops, managerFunds, transfers, users, pendingEntries, allTimeTotals] = await Promise.all([
        db.query(
            `SELECT de.date, s.shop_name, u.name AS submitted_by,
                    de.entry_type, de.total_sale, de.cash, de.online, de.razorpay,
                    de.approval_status, de.created_at,
                    ap.name AS approved_by_name, de.approved_at, de.rejection_note
             FROM daily_entries de
             JOIN shops s ON de.shop_id = s.id
             LEFT JOIN users u ON de.created_by = u.id
             LEFT JOIN users ap ON de.approved_by = ap.id
             WHERE de.date = $1
             ORDER BY s.shop_name`,
            [today],
        ),
        db.query(
            `SELECT de.date, s.shop_name, u.name AS submitted_by,
                    de.entry_type, de.total_sale, de.cash, de.online, de.razorpay,
                    de.approval_status, de.created_at,
                    ap.name AS approved_by_name, de.approved_at, de.rejection_note
             FROM daily_entries de
             JOIN shops s ON de.shop_id = s.id
             LEFT JOIN users u ON de.created_by = u.id
             LEFT JOIN users ap ON de.approved_by = ap.id
             WHERE de.date >= CURRENT_DATE - INTERVAL '30 days'
               AND de.date < $1
             ORDER BY de.date DESC, s.shop_name
             LIMIT 200`,
            [today],
        ),
        db.query(
            `SELECT s.shop_name, c.name AS city, s.wallet_balance
             FROM shops s
             LEFT JOIN cities c ON s.city_id = c.id
             ORDER BY s.shop_name`
        ),
        db.query(
            `SELECT u.name, mf.balance, mf.updated_at
             FROM manager_funds mf
             JOIN users u ON mf.manager_id = u.id
             ORDER BY mf.balance DESC`
        ).catch(() => ({ rows: [] })),
        db.query(
            `SELECT t.amount, t.note, t.created_at,
                    s.shop_name AS from_shop,
                    u.name AS transferred_by
             FROM wallet_transfers t
             JOIN shops s ON t.from_shop_id = s.id
             JOIN users u ON t.transferred_by = u.id
             WHERE t.created_at >= NOW() - INTERVAL '7 days'
             ORDER BY t.created_at DESC LIMIT 20`
        ).catch(() => ({ rows: [] })),
        db.query(
            `SELECT id, name, mobile, role, is_approved, created_at
             FROM users ORDER BY created_at DESC`
        ).catch(() => ({ rows: [] })),
        db.query(
            `SELECT COUNT(*) AS count FROM daily_entries WHERE approval_status = 'PENDING'`
        ).catch(() => ({ rows: [{ count: 0 }] })),
        db.query(
            `SELECT
               COUNT(*) AS total_entries,
               COALESCE(SUM(CASE WHEN approval_status = 'APPROVED' THEN total_sale ELSE 0 END), 0) AS total_sales,
               COALESCE(SUM(CASE WHEN approval_status = 'APPROVED' THEN cash ELSE 0 END), 0) AS total_cash,
               COALESCE(SUM(CASE WHEN approval_status = 'APPROVED' THEN COALESCE(online,0)+COALESCE(razorpay,0) ELSE 0 END), 0) AS total_online,
               COUNT(CASE WHEN approval_status = 'APPROVED' THEN 1 END) AS approved_count,
               COUNT(CASE WHEN approval_status = 'PENDING' THEN 1 END) AS pending_count,
               COUNT(CASE WHEN approval_status = 'REJECTED' THEN 1 END) AS rejected_count
             FROM daily_entries`
        ).catch(() => ({ rows: [] })),
    ]);

    const lines = [];
    lines.push(`Today's date: ${today}`);
    lines.push('');

    // ── Users ────────────────────────────────────────────────
    const allUsers     = users.rows;
    const approvedUsers = allUsers.filter(u => u.is_approved);
    const pendingUsers  = allUsers.filter(u => !u.is_approved);
    const admins        = allUsers.filter(u => u.role === 'admin');
    const managers      = allUsers.filter(u => u.role === 'manager');
    const shopUsers     = allUsers.filter(u => u.role === 'shop_user');

    lines.push(`Total users: ${allUsers.length} (${approvedUsers.length} approved, ${pendingUsers.length} pending approval)`);
    lines.push(`  - Admins: ${admins.length}`);
    lines.push(`  - Managers: ${managers.length}`);
    lines.push(`  - Shop users: ${shopUsers.length}`);
    if (pendingUsers.length > 0) {
        lines.push(`  Pending approval users: ${pendingUsers.map(u => u.name).join(', ')}`);
    }
    lines.push('');

    // ── Shops ────────────────────────────────────────────────
    lines.push(`Total shops: ${shops.rows.length}`);
    for (const s of shops.rows) {
        lines.push(`  * ${s.shop_name} (${s.city || '?'}), Wallet: ₹${Number(s.wallet_balance || 0).toLocaleString('en-IN')}`);
    }
    lines.push('');

    // ── All-time totals ──────────────────────────────────────
    if (allTimeTotals.rows.length > 0) {
        const t = allTimeTotals.rows[0];
        lines.push(`All-time entry statistics:`);
        lines.push(`  Total entries: ${t.total_entries} (${t.approved_count} approved, ${t.pending_count} pending, ${t.rejected_count} rejected)`);
        lines.push(`  Total approved sales: ₹${Number(t.total_sales).toLocaleString('en-IN')}`);
        lines.push(`  Total cash collected: ₹${Number(t.total_cash).toLocaleString('en-IN')}`);
        lines.push(`  Total online/Razorpay: ₹${Number(t.total_online).toLocaleString('en-IN')}`);
        lines.push('');
    }

    // ── Pending approvals ────────────────────────────────────
    lines.push(`Pending entry approvals: ${pendingEntries.rows[0]?.count || 0}`);
    lines.push('');

    // ── Today's entries ──────────────────────────────────────
    const formatEntry = (e) => {
        const type    = e.entry_type === 'no_sale' ? 'No Sale' : 'Normal';
        const sale    = e.total_sale != null ? `₹${Number(e.total_sale).toLocaleString('en-IN')}` : 'N/A';
        const cash    = e.cash != null ? `₹${Number(e.cash).toLocaleString('en-IN')}` : 'N/A';
        const online  = Number(e.online || 0) + Number(e.razorpay || 0);
        const submAt  = e.created_at ? new Date(e.created_at).toLocaleString('en-IN') : 'N/A';
        const appBy   = e.approved_by_name ? `Approved by: ${e.approved_by_name}` : '';
        const appAt   = e.approved_at ? ` at ${new Date(e.approved_at).toLocaleString('en-IN')}` : '';
        const rej     = e.rejection_note ? `, Rejection reason: ${e.rejection_note}` : '';
        return `  * ${e.shop_name}: ${type}, Sale ${sale}, Cash ${cash}, Online ₹${online.toLocaleString('en-IN')}, Status: ${e.approval_status}, Submitted by: ${e.submitted_by || 'N/A'} at ${submAt}${appBy ? ', ' + appBy + appAt : ''}${rej}`;
    };

    if (entries.rows.length === 0) {
        lines.push('Today: No shop has submitted an entry yet.');
    } else {
        lines.push(`Today's entries (${entries.rows.length} shops submitted):`);
        for (const e of entries.rows) lines.push(formatEntry(e));
    }
    lines.push('');

    const approved = entries.rows.filter(r => r.approval_status === 'APPROVED');
    if (approved.length > 0) {
        const totalSale   = approved.reduce((s, r) => s + Number(r.total_sale || 0), 0);
        const totalCash   = approved.reduce((s, r) => s + Number(r.cash || 0), 0);
        const totalOnline = approved.reduce((s, r) => s + Number(r.online || 0) + Number(r.razorpay || 0), 0);
        lines.push(`Today's approved totals:`);
        lines.push(`  Total Sale: ₹${totalSale.toLocaleString('en-IN')}`);
        lines.push(`  Cash: ₹${totalCash.toLocaleString('en-IN')}`);
        lines.push(`  Online/Razorpay: ₹${totalOnline.toLocaleString('en-IN')}`);
        lines.push('');
    }

    // ── Recent entries (last 30 days) ────────────────────────────
    if (recentEntries.rows.length > 0) {
        lines.push(`Recent entries (last 30 days, ${recentEntries.rows.length} total):`);
        let currentDate = '';
        for (const e of recentEntries.rows) {
            const dateKey = String(e.date).split('T')[0];
            if (dateKey !== currentDate) {
                currentDate = dateKey;
                lines.push(`  [${dateKey}]`);
            }
            lines.push(formatEntry(e));
        }
        lines.push('');
    }

    // ── Manager funds ────────────────────────────────────────
    if (managerFunds.rows.length > 0) {
        lines.push('Manager fund balances:');
        for (const m of managerFunds.rows) {
            lines.push(`  * ${m.name}: ₹${Number(m.balance).toLocaleString('en-IN')}`);
        }
        lines.push('');
    }

    // ── Recent transfers ─────────────────────────────────────
    if (transfers.rows.length > 0) {
        lines.push('Transfers (last 7 days):');
        for (const t of transfers.rows) {
            const date = new Date(t.created_at).toLocaleDateString('en-IN');
            lines.push(
                `  * ${date}: ${t.from_shop} — ₹${Number(t.amount).toLocaleString('en-IN')} by ${t.transferred_by}${t.note ? ' — ' + t.note : ''}`
            );
        }
        lines.push('');
    }

    // ── ERP Features ─────────────────────────────────────────
    lines.push(`SIZE24 ERP Features:
  - Daily Entry: Shop users submit daily sales (total sale, cash, online, Razorpay breakdowns)
  - Approvals: Admin/Manager approve or reject submitted entries
  - Entry Status: Track which shops have submitted entries for any date range
  - Wallet System: Each shop has a wallet; cash from approved entries flows into it
  - Manager Funds: Managers hold cash balances; they can transfer to admin or deposit to bank
  - Expenses: Log business expenses against shops
  - Reports: View sales analytics with charts (daily/weekly/monthly)
  - Anomaly Detection: Auto-detect unusual entries (large sales, missing breakdowns)
  - Excel Upload: Upload sales data via Excel file
  - User Management: Admin can approve/reject new user registrations
  - Multi-shop: A shop user can be assigned to multiple shops and switch between them
  - WhatsApp Notifications: Entry approval/rejection and daily reminders via WhatsApp`);

    return lines.join('\n');
}

module.exports = { buildContext };
