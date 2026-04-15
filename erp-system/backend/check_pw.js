const { Client } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function check() {
    const c = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });
    await c.connect();
    const r = await c.query('SELECT id, name, mobile, role, password_hash FROM users ORDER BY role');
    for (const u of r.rows) {
        const t1 = await bcrypt.compare('admin@123', u.password_hash);
        const t2 = await bcrypt.compare('user@123', u.password_hash);
        console.log(`name=${u.name} mobile=${u.mobile} role=${u.role} -> admin@123:${t1} user@123:${t2}`);
    }
    await c.end();
}
check().catch(console.error);
