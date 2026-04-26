/**
 * Create the erp_db database, initialize schema, and run all migrations.
 * Run: node scripts/init_db.js
 */
const { Client } = require('pg');
const fs   = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DB_NAME = process.env.DB_NAME || 'erp_db';

const pgConfig = {
    user:     process.env.DB_USER     || 'postgres',
    host:     process.env.DB_HOST     || 'localhost',
    password: process.env.DB_PASSWORD || 'admin',
    port:     process.env.DB_PORT     || 5432,
};

async function runSQL(client, label, sql) {
    try {
        await client.query(sql);
        console.log(`  ✓ ${label}`);
    } catch (err) {
        console.error(`  ✗ ${label}: ${err.message}`);
        throw err;
    }
}

async function init() {
    // Step 1: Create DB if it doesn't exist
    const pgClient = new Client({ ...pgConfig, database: 'postgres' });
    try {
        await pgClient.connect();
        const res = await pgClient.query(`SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'`);
        if (res.rowCount === 0) {
            await pgClient.query(`CREATE DATABASE ${DB_NAME}`);
            console.log(`Database '${DB_NAME}' created.`);
        } else {
            console.log(`Database '${DB_NAME}' already exists.`);
        }
    } finally {
        await pgClient.end();
    }

    // Step 2: Apply schema + consolidated migration
    const erpClient = new Client({ ...pgConfig, database: DB_NAME });
    try {
        await erpClient.connect();

        console.log('\nApplying schema...');
        const schema = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
        await runSQL(erpClient, 'schema.sql', schema);

        // Consolidated migration — adds any columns the schema may have missed
        // on DBs that were initialized before schema.sql was updated.
        const migPath = path.join(__dirname, '../db/migrate_all_missing.sql');
        if (fs.existsSync(migPath)) {
            console.log('\nApplying consolidated migration...');
            const migSql = fs.readFileSync(migPath, 'utf8');
            await runSQL(erpClient, 'migrate_all_missing.sql', migSql);
        }

        console.log('\n✅  Database ready.\n');
    } catch (err) {
        console.error('Init failed:', err.message);
        process.exit(1);
    } finally {
        await erpClient.end();
    }
}

init();
