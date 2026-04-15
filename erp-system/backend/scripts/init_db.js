/**
 * Utility: Create the erp_db database and initialize the schema.
 * Run: node scripts/init_db.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function init() {
    const defaultClient = new Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: 'postgres',
        password: process.env.DB_PASSWORD || 'admin',
        port: process.env.DB_PORT || 5432,
    });

    try {
        await defaultClient.connect();
        const res = await defaultClient.query("SELECT 1 FROM pg_database WHERE datname='erp_db'");
        if (res.rowCount === 0) {
            await defaultClient.query('CREATE DATABASE erp_db');
            console.log("Database 'erp_db' created successfully.");
        } else {
            console.log("Database 'erp_db' already exists.");
        }
    } catch (err) {
        console.error("Error creating database:", err.message);
    } finally {
        await defaultClient.end();
    }

    const erpClient = new Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: 'erp_db',
        password: process.env.DB_PASSWORD || 'admin',
        port: process.env.DB_PORT || 5432,
    });

    try {
        await erpClient.connect();
        const sql = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
        await erpClient.query(sql);
        console.log("Schema initialized successfully.");
    } catch (err) {
        console.error("Error initializing schema:", err.message);
    } finally {
        await erpClient.end();
    }
}

init();
