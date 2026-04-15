/**
 * Utility: Print all users in the database.
 * Run: node scripts/list_users.js
 */
const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function list() {
    const c = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });
    await c.connect();
    const r = await c.query('SELECT id, name, mobile, role FROM users ORDER BY role');
    r.rows.forEach(u => {
        console.log('---');
        console.log('Name   : ' + u.name);
        console.log('Mobile : ' + u.mobile);
        console.log('Role   : ' + u.role);
    });
    await c.end();
}
list().catch(console.error);
