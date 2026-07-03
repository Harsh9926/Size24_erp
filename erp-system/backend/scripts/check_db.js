require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user:     process.env.DB_USER,
    host:     process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port:     process.env.DB_PORT || 5432,
});

async function check() {
    const client = await pool.connect();
    try {
        console.log('\n=== DB CONNECTION ===');
        console.log('Host:', process.env.DB_HOST);
        console.log('DB:  ', process.env.DB_NAME);

        const de = await client.query(`SELECT MIN(date) oldest, MAX(date) newest, COUNT(*) total FROM daily_entries`);
        console.log('\n=== daily_entries ===');
        console.table(de.rows);

        const ct = await client.query(`SELECT MIN(created_at) oldest, MAX(created_at) newest, COUNT(*) total FROM cash_transfers`);
        console.log('\n=== cash_transfers ===');
        console.table(ct.rows);

        const mt = await client.query(`SELECT MIN(created_at) oldest, MAX(created_at) newest, COUNT(*) total FROM manager_transfers`);
        console.log('\n=== manager_transfers ===');
        console.table(mt.rows);

        const shops = await client.query(`SELECT id, shop_name, wallet_balance FROM shops`);
        console.log('\n=== shops ===');
        console.table(shops.rows);

        const mgr = await client.query(`SELECT id, name, mobile, wallet_balance FROM users WHERE role='manager'`);
        console.log('\n=== managers ===');
        console.table(mgr.rows);

    } finally {
        client.release();
        await pool.end();
    }
}

check().catch(console.error);
