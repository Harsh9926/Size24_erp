#!/usr/bin/env node
/**
 * Run once on the server to apply all pending schema migrations.
 * Usage:  node db/migrate.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function run() {
    const client = await pool.connect();
    try {
        console.log(`Connected to database: ${process.env.DB_NAME} @ ${process.env.DB_HOST}`);
        await client.query('BEGIN');

        // Grant schema privilege (PostgreSQL 15+ removed public CREATE by default)
        try {
            await client.query('GRANT CREATE ON SCHEMA public TO CURRENT_USER');
            console.log('[grant] CREATE on public schema granted to current user');
        } catch (e) {
            console.warn('[grant] Could not self-grant schema privilege:', e.message);
            console.warn('[grant] You may need to run as the RDS master user:');
            console.warn(`[grant]   PGPASSWORD=<admin_pass> psql -h ${process.env.DB_HOST} -U postgres -d ${process.env.DB_NAME} -c "GRANT CREATE ON SCHEMA public TO ${process.env.DB_USER};"`);
        }

        // shop_users junction table
        await client.query(`
            CREATE TABLE IF NOT EXISTS shop_users (
                id          SERIAL PRIMARY KEY,
                shop_id     INT NOT NULL REFERENCES shops(id)  ON DELETE CASCADE,
                user_id     INT NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                assigned_by INT       REFERENCES users(id)     ON DELETE SET NULL,
                UNIQUE(shop_id, user_id)
            )
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_shop_users_shop ON shop_users(shop_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_shop_users_user ON shop_users(user_id)');
        console.log('[migrate] shop_users table created/verified');

        // Seed from legacy shops.user_id
        const seeded = await client.query(`
            INSERT INTO shop_users (shop_id, user_id)
            SELECT id, user_id FROM shops WHERE user_id IS NOT NULL
            ON CONFLICT (shop_id, user_id) DO NOTHING
        `);
        console.log(`[seed] shop_users seeded ${seeded.rowCount} row(s) from shops.user_id`);

        await client.query('COMMIT');
        console.log('\n✓ Migration complete. Restart the backend: pm2 restart backend');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n✗ Migration failed:', err.message);
        if (err.message.includes('permission denied')) {
            console.error('\nFix: connect to your DB as the admin/master user and run:');
            console.error(`  GRANT CREATE ON SCHEMA public TO ${process.env.DB_USER};`);
            console.error('Then re-run:  node db/migrate.js');
        }
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
