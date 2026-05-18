const db = require('../config/db');

async function buildContext() {
    const today = new Date().toISOString().split('T')[0];

    const [entries, shops, wallets, managerFunds, transfers] = await Promise.all([
        db.query(
            `SELECT de.date, s.shop_name, u.name AS submitted_by,
                    de.entry_type, de.total_sale, de.excel_total_sale,
                    de.cash, de.online, de.razorpay, de.approval_status
             FROM daily_entries de
             JOIN shops s ON de.shop_id = s.id
             LEFT JOIN users u ON de.submitted_by = u.id
             WHERE de.date = $1
             ORDER BY s.shop_name`,
            [today]
        ),
        db.query(
            `SELECT s.shop_name, c.name AS city, s.wallet_balance
             FROM shops s
             LEFT JOIN cities c ON s.city_id = c.id
             ORDER BY s.shop_name`
        ),
        db.query(
            `SELECT s.shop_name, s.wallet_balance
             FROM shops s WHERE s.wallet_balance > 0
             ORDER BY s.wallet_balance DESC`
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
    ]);

    const lines = [];
    lines.push(`Aaj ki date: ${today}`);
    lines.push('');

    if (entries.rows.length === 0) {
        lines.push('Aaj kisi bhi shop ne entry submit nahin ki.');
    } else {
        lines.push(`Aaj ki entries (${entries.rows.length} shops):`);
        for (const e of entries.rows) {
            const type   = e.entry_type === 'no_sale' ? 'No Sale' : 'Normal';
            const sale   = e.total_sale != null ? `Rs.${Number(e.total_sale).toLocaleString('en-IN')}` : 'NA';
            const cash   = e.cash != null ? `Rs.${Number(e.cash).toLocaleString('en-IN')}` : 'NA';
            const online = Number(e.online || 0) + Number(e.razorpay || 0);
            lines.push(
                `  * ${e.shop_name}: ${type}, Sale ${sale}, Cash ${cash}, Online Rs.${online.toLocaleString('en-IN')}, Status: ${e.approval_status}, By: ${e.submitted_by || 'N/A'}`
            );
        }
    }
    lines.push('');

    const approved = entries.rows.filter(r => r.approval_status === 'APPROVED');
    if (approved.length > 0) {
        const totalSale   = approved.reduce((s, r) => s + Number(r.total_sale || 0), 0);
        const totalCash   = approved.reduce((s, r) => s + Number(r.cash || 0), 0);
        const totalOnline = approved.reduce((s, r) => s + Number(r.online || 0) + Number(r.razorpay || 0), 0);
        lines.push(`Aaj approved entries ka total:`);
        lines.push(`  Total Sale: Rs.${totalSale.toLocaleString('en-IN')}`);
        lines.push(`  Cash: Rs.${totalCash.toLocaleString('en-IN')}`);
        lines.push(`  Online/Razorpay: Rs.${totalOnline.toLocaleString('en-IN')}`);
        lines.push('');
    }

    if (wallets.rows.length > 0) {
        lines.push('Shop wallet balances:');
        for (const w of wallets.rows) {
            lines.push(`  * ${w.shop_name}: Rs.${Number(w.wallet_balance).toLocaleString('en-IN')}`);
        }
        lines.push('');
    }

    if (managerFunds.rows.length > 0) {
        lines.push('Manager fund balances:');
        for (const m of managerFunds.rows) {
            lines.push(`  * ${m.name}: Rs.${Number(m.balance).toLocaleString('en-IN')}`);
        }
        lines.push('');
    }

    if (transfers.rows.length > 0) {
        lines.push('Pichle 7 din ke transfers:');
        for (const t of transfers.rows) {
            const date = new Date(t.created_at).toLocaleDateString('en-IN');
            lines.push(
                `  * ${date}: ${t.from_shop} se Rs.${Number(t.amount).toLocaleString('en-IN')} transfer (by ${t.transferred_by})${t.note ? ' — ' + t.note : ''}`
            );
        }
        lines.push('');
    }

    lines.push(`Total shops: ${shops.rows.length}`);
    for (const s of shops.rows) {
        lines.push(`  * ${s.shop_name} (${s.city || '?'}), Wallet: Rs.${Number(s.wallet_balance || 0).toLocaleString('en-IN')}`);
    }

    return lines.join('\n');
}

module.exports = { buildContext };
