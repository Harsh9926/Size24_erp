/**
 * fix_amanora_transfer.js
 * Reverses the erroneous ₹33,00,000 cash transfer for Amanora Apex (shop #3)
 * and recalculates the correct wallet balance.
 *
 * Run:  node scripts/fix_amanora_transfer.js          ← dry run
 *       node scripts/fix_amanora_transfer.js --fix    ← apply fix
 */

const db  = require('../config/db');
const DRY = !process.argv.includes('--fix');

if (DRY) console.log('\n⚠  DRY RUN — no changes will be made. Run with --fix to apply.\n');
else      console.log('\n🔧  FIX MODE — applying correction.\n');

async function main() {
    const SHOP_ID = 3; // Amanora Apex

    // Find the erroneous transfer(s)
    const badTransfers = await db.query(
        `SELECT id, amount, status, created_at, note
         FROM cash_transfers
         WHERE shop_id = $1 AND amount >= 3000000
         ORDER BY created_at DESC`,
        [SHOP_ID],
    );

    console.log(`Found ${badTransfers.rows.length} large transfer(s) for Amanora Apex:`);
    badTransfers.rows.forEach(t =>
        console.log(`  ID #${t.id}  ₹${parseFloat(t.amount).toLocaleString('en-IN')}  status=${t.status}  date=${String(t.created_at).split('T')[0]}  note=${t.note || '—'}`)
    );

    if (badTransfers.rows.length === 0) {
        console.log('No transfers >= ₹30,00,000 found. Exiting.');
        process.exit(0);
    }

    // Current wallet
    const shopRes = await db.query('SELECT wallet_balance FROM shops WHERE id = $1', [SHOP_ID]);
    const currentWallet = parseFloat(shopRes.rows[0].wallet_balance);
    console.log(`\nCurrent wallet balance : ₹${currentWallet.toLocaleString('en-IN')}`);

    // Calculate total to reverse (only accepted ones)
    const toReverse = badTransfers.rows.filter(t => ['accepted', 'approved'].includes(t.status));
    const reverseTotal = toReverse.reduce((s, t) => s + parseFloat(t.amount), 0);
    const newWallet    = currentWallet + reverseTotal;

    console.log(`Amount to reverse      : ₹${reverseTotal.toLocaleString('en-IN')}`);
    console.log(`New wallet balance     : ₹${newWallet.toLocaleString('en-IN')}`);

    if (DRY) {
        console.log('\nActions that would be taken:');
        toReverse.forEach(t =>
            console.log(`  • cash_transfers #${t.id} → status = 'rejected' (reversed)`)
        );
        console.log(`  • shops #${SHOP_ID} wallet_balance → ₹${newWallet.toLocaleString('en-IN')}`);
        console.log('\nRun with --fix to apply.');
        process.exit(0);
    }

    // Apply in a transaction
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        for (const t of toReverse) {
            await client.query(
                `UPDATE cash_transfers
                 SET status = 'rejected', note = COALESCE(note, '') || ' [REVERSED: erroneous transfer]'
                 WHERE id = $1`,
                [t.id],
            );
            console.log(`  ✅ Transfer #${t.id} reversed`);
        }

        await client.query(
            'UPDATE shops SET wallet_balance = $1 WHERE id = $2',
            [newWallet, SHOP_ID],
        );
        console.log(`  ✅ Wallet updated to ₹${newWallet.toLocaleString('en-IN')}`);

        // Audit log
        await client.query(
            `INSERT INTO audit_logs (table_name, record_id, old_value, new_value, edited_by)
             VALUES ('shops', $1, $2::jsonb, $3::jsonb, 1)`,
            [
                SHOP_ID,
                JSON.stringify({ wallet_balance: currentWallet, reason: 'before_reversal' }),
                JSON.stringify({ wallet_balance: newWallet, reason: 'erroneous_33L_transfer_reversed' }),
            ],
        ).catch(() => {});

        await client.query('COMMIT');
        console.log('\n✅ Done. Amanora Apex wallet balance corrected.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error — rolled back:', err.message);
        process.exit(1);
    } finally {
        client.release();
    }

    process.exit(0);
}

main().catch(err => { console.error(err.message); process.exit(1); });
