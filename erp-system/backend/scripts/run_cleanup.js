require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user:     process.env.DB_USER,
    host:     process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port:     process.env.DB_PORT || 5432,
});

async function run() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('\n✅ Transaction started\n');

        // ── STEP 1: Shop closing balances as of June 15 ─────────────
        console.log('📊 Calculating shop balances as of 15-Jun-2026...');
        await client.query(`
            CREATE TEMP TABLE tmp_shop_balances AS
            SELECT
                s.id AS shop_id,
                COALESCE((
                    SELECT SUM(de.cash) FROM daily_entries de
                    WHERE de.shop_id = s.id AND de.approval_status = 'APPROVED'
                      AND de.date <= '2026-06-15'
                ), 0)
                - COALESCE((
                    SELECT SUM(ct.amount) FROM cash_transfers ct
                    WHERE ct.shop_id = s.id AND ct.status = 'accepted'
                      AND ct.created_at <= '2026-06-15 23:59:59'
                ), 0) AS closing_balance
            FROM shops s
        `);

        const shopBalances = await client.query(`
            SELECT s.shop_name, t.closing_balance
            FROM tmp_shop_balances t JOIN shops s ON s.id = t.shop_id
            ORDER BY s.shop_name
        `);
        console.log('\nShop Balances (June 15 closing):');
        console.table(shopBalances.rows);

        // ── STEP 2: Manager closing balances as of June 15 ──────────
        console.log('\n📊 Calculating manager balances as of 15-Jun-2026...');
        await client.query(`
            CREATE TEMP TABLE tmp_manager_balances AS
            SELECT
                u.id AS manager_id,
                COALESCE((
                    SELECT SUM(ct.amount) FROM cash_transfers ct
                    WHERE ct.to_user_id = u.id AND ct.status = 'accepted'
                      AND ct.created_at <= '2026-06-15 23:59:59'
                ), 0)
                + COALESCE((
                    SELECT SUM(mt.amount) FROM manager_transfers mt
                    WHERE mt.manager_id = u.id AND mt.type = 'admin_to_manager'
                      AND mt.status = 'approved'
                      AND mt.created_at <= '2026-06-15 23:59:59'
                ), 0)
                - COALESCE((
                    SELECT SUM(mt.amount) FROM manager_transfers mt
                    WHERE mt.manager_id = u.id
                      AND mt.type IN ('manager_to_admin','manager_to_bank','manager_expense')
                      AND mt.status = 'approved'
                      AND mt.created_at <= '2026-06-15 23:59:59'
                ), 0) AS closing_balance
            FROM users u WHERE u.role = 'manager'
        `);

        const managerBalances = await client.query(`
            SELECT u.name, u.mobile, t.closing_balance
            FROM tmp_manager_balances t JOIN users u ON u.id = t.manager_id
            ORDER BY u.name
        `);
        console.log('\nManager Balances (June 15 closing):');
        console.table(managerBalances.rows);

        // ── Ask confirmation before deleting ────────────────────────
        console.log('\n⚠️  Review the balances above carefully.');
        console.log('    Type CONFIRM to proceed with deletion, or Ctrl+C to abort.\n');
        await waitForConfirm();

        // ── STEP 3: Delete old data ──────────────────────────────────
        console.log('\n🗑️  Deleting excel_uploads up to 2026-06-15...');
        const d1 = await client.query(`DELETE FROM excel_uploads WHERE upload_date <= '2026-06-15'`);
        console.log(`   Deleted: ${d1.rowCount} rows`);

        console.log('🗑️  Deleting manager_transfers up to 2026-06-15...');
        const d2 = await client.query(`DELETE FROM manager_transfers WHERE created_at <= '2026-06-15 23:59:59'`);
        console.log(`   Deleted: ${d2.rowCount} rows`);

        console.log('🗑️  Deleting cash_transfers up to 2026-06-15...');
        const d3 = await client.query(`DELETE FROM cash_transfers WHERE created_at <= '2026-06-15 23:59:59'`);
        console.log(`   Deleted: ${d3.rowCount} rows`);

        console.log('🗑️  Deleting daily_entries up to 2026-06-15...');
        const d4 = await client.query(`DELETE FROM daily_entries WHERE date <= '2026-06-15'`);
        console.log(`   Deleted: ${d4.rowCount} rows`);

        // ── STEP 4: Update balances ──────────────────────────────────
        console.log('\n💰 Updating shop wallet_balances...');
        await client.query(`
            UPDATE shops s SET wallet_balance = t.closing_balance
            FROM tmp_shop_balances t WHERE s.id = t.shop_id
        `);

        console.log('💰 Updating manager wallet_balances...');
        await client.query(`
            UPDATE users u SET wallet_balance = t.closing_balance
            FROM tmp_manager_balances t WHERE u.id = t.manager_id
        `);

        // ── STEP 5: Final verification ───────────────────────────────
        const finalShops = await client.query(`SELECT shop_name, wallet_balance FROM shops ORDER BY shop_name`);
        console.log('\n✅ Final Shop Balances:');
        console.table(finalShops.rows);

        const finalMgr = await client.query(`SELECT name, mobile, wallet_balance FROM users WHERE role='manager' ORDER BY name`);
        console.log('\n✅ Final Manager Balances:');
        console.table(finalMgr.rows);

        const remaining = await client.query(`SELECT MIN(date) AS oldest, MAX(date) AS newest, COUNT(*) AS total FROM daily_entries`);
        console.log('\n📅 Remaining daily_entries:');
        console.table(remaining.rows);

        await client.query('COMMIT');
        console.log('\n🎉 COMMITTED. Cleanup done successfully!\n');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ ERROR — ROLLED BACK. Nothing was changed.');
        console.error(err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

function waitForConfirm() {
    return new Promise((resolve, reject) => {
        process.stdout.write('>>> ');
        process.stdin.setEncoding('utf8');
        process.stdin.once('data', (data) => {
            if (data.trim().toUpperCase() === 'CONFIRM') {
                resolve();
            } else {
                reject(new Error('Aborted by user.'));
            }
        });
    });
}

run();
