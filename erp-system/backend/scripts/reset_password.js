/**
 * Utility: Reset all passwords to defaults (admin@123 for admins, user@123 for others).
 * Run: node scripts/reset_password.js
 */
const { Client } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function resetPasswords() {
    const client = new Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'erp_db',
        password: process.env.DB_PASSWORD || 'admin',
        port: process.env.DB_PORT || 5432,
    });

    try {
        await client.connect();
        console.log('Connected to database.\n');

        const usersResult = await client.query('SELECT id, name, mobile, role, is_approved FROM users ORDER BY role, id');
        console.log('=== ALL USERS IN DATABASE ===');
        console.table(usersResult.rows);

        const adminHash = await bcrypt.hash('admin@123', 10);
        const adminUpdate = await client.query(
            "UPDATE users SET password_hash = $1 WHERE role = 'admin' RETURNING id, name, mobile, role",
            [adminHash]
        );
        console.log('\n=== ADMIN PASSWORD RESET ===');
        console.log('New password: admin@123');
        console.table(adminUpdate.rows);

        const userHash = await bcrypt.hash('user@123', 10);
        const userUpdate = await client.query(
            "UPDATE users SET password_hash = $1 WHERE role != 'admin' RETURNING id, name, mobile, role",
            [userHash]
        );
        console.log('\n=== USER PASSWORD RESET ===');
        console.log('New password: user@123');
        console.table(userUpdate.rows);

        console.log('\nDone! Use the mobile number shown above + the new password to login.');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

resetPasswords();
