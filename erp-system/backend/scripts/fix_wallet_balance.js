/**
 * fix_wallet_balance.js
 * Diagnoses and fixes negative/incorrect wallet balances.
 *
 * Run on EC2:  node scripts/fix_wallet_balance.js
 *              node scripts/fix_wallet_balance.js --fix      ← actually apply the fix
 */

const db  = require('../config/db');
const DRY = !process.argv.includes('--fix');

if (DRY) {
    console.log('\n⚠  DRY RUN — no changes will be made.');
    console.log('   Run with --fix to apply corrections.\n');
} else {
    console.log('\n🔧  FIX MODE — wallet balances will be corrected.\n');
}

async function main() {
    const shops = await db.query('SELECT id, shop_name, wallet_balance FROM shops ORDER BY id');

    for (const shop of shops.rows) {
        const sid = shop.id;

        // Total cash credited from APPROVED entries
        const cashIn = await db.query(
            `SELECT COALESCE(SUM(cash), 0) AS total
             FROM daily_entries
             WHERE shop_id = $1 AND approval_status = 'APPROVED'`,
            [sid],
        );

        // Total cash debited via approved/accepted cash transfers
        const cashOut = await db.query(
            `SELECT COALESCE(SUM(amount), 0) AS total
             FROM cash_transfers
             WHERE shop_id = $1 AND status IN ('approved', 'accepted')`,
            [sid],
        );

        const correctBalance = parseFloat(cashIn.rows[0].total) - parseFloat(cashOut.rows[0].total);
        const currentBalance = parseFloat(shop.wallet_balance);
        const diff           = correctBalance - currentBalance;

        console.log(`─── Shop #${sid}: ${shop.shop_name}`);
        console.log(`    Cash from approved entries : ₹${parseFloat(cashIn.rows[0].total).toLocaleString('en-IN')}`);
        console.log(`    Cash transfers out          : ₹${parseFloat(cashOut.rows[0].total).toLocaleString('en-IN')}`);
        console.log(`    Correct balance             : ₹${correctBalance.toLocaleString('en-IN')}`);
        console.log(`    Current balance             : ₹${currentBalance.toLocaleString('en-IN')}`);
        console.log(`    Difference                  : ₹${diff.toLocaleString('en-IN')} ${Math.abs(diff) < 0.01 ? '✓ OK' : '← NEEDS FIX'}`);

        // Show recent entries for context
        const entries = await db.query(
            `SELECT date, cash, approval_status, wallet_credited
             FROM daily_entries WHERE shop_id = $1
             ORDER BY date DESC LIMIT 10`,
            [sid],
        );
        if (entries.rows.length) {
            console.log(`    Last 10 entries:`);
            entries.rows.forEach(e =>
                console.log(`      ${String(e.date).split('T')[0]}  cash=₹${e.cash}  ${e.approval_status}  wallet_credited=${e.wallet_credited}`)
            );
        }

        // Show recent transfers
        const transfers = await db.query(
            `SELECT amount, status, created_at FROM cash_transfers
             WHERE shop_id = $1 ORDER BY created_at DESC LIMIT 5`,
            [sid],
        );
        if (transfers.rows.length) {
            console.log(`    Last 5 cash transfers:`);
            transfers.rows.forEach(t =>
                console.log(`      ₹${t.amount}  ${t.status}  ${String(t.created_at).split('T')[0]}`)
            );
        }

        if (!DRY && Math.abs(diff) > 0.01) {
            await db.query(
                'UPDATE shops SET wallet_balance = $1 WHERE id = $2',
                [correctBalance, sid],
            );
            console.log(`    ✅ Balance corrected to ₹${correctBalance.toLocaleString('en-IN')}`);

            // Audit log
            await db.query(
                `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
                 VALUES ('shops', $1, $2::jsonb, $3::jsonb, 1)`,
                [
                    sid,
                    JSON.stringify({ wallet_balance: currentBalance, reason: 'before_fix' }),
                    JSON.stringify({ wallet_balance: correctBalance, reason: 'fix_wallet_balance_script' }),
                ],
            ).catch(() => {}); // non-fatal
        }

        console.log('');
    }

    if (DRY) {
        console.log('Run with --fix to apply the corrections above.');
    } else {
        console.log('✅ All wallet balances corrected.');
    }

    process.exit(0);
}

main().catch(err => { console.error(err.message); process.exit(1); });
