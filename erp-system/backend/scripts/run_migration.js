/**
 * Run a single migration SQL file against the ERP database.
 * Usage:  node scripts/run_migration.js <filename>
 * Example: node scripts/run_migration.js migrate_add_wallet_balance.sql
 */
const { Client } = require('pg');
const fs   = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
    const filename = process.argv[2];
    if (!filename) {
        console.error('Usage: node scripts/run_migration.js <sql-filename>');
        process.exit(1);
    }

    const sqlPath = path.join(__dirname, '../db', filename);
    if (!fs.existsSync(sqlPath)) {
        console.error(`File not found: ${sqlPath}`);
        process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');

    const client = new Client({
        user:     process.env.DB_USER     || 'postgres',
        host:     process.env.DB_HOST     || 'localhost',
        database: process.env.DB_NAME     || 'erp_db',
        password: process.env.DB_PASSWORD || 'admin',
        port:     process.env.DB_PORT     || 5432,
    });

    try {
        await client.connect();
        console.log(`Running migration: ${filename}`);
        await client.query(sql);
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
