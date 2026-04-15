const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function init() {
    const defaultClient = new Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: 'postgres', // Connect to default postgres DB first
        password: process.env.DB_PASSWORD || 'admin',
        port: process.env.DB_PORT || 5432,
    });

    try {
        await defaultClient.connect();
        // Check if database exists
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
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await erpClient.query(schema);
        console.log("Schema initialized successfully.");
    } catch (err) {
        console.error("Error initializing schema:", err.message);
    } finally {
        await erpClient.end();
    }
}

init();
