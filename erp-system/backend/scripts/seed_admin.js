/**
 * Creates an admin user in the local database for development.
 * Usage: node scripts/seed_admin.js
 */
const db     = require('../config/db');
const bcrypt = require('bcrypt');

async function seedAdmin() {
    const mobile   = '8817654579';
    const password = 'Radhika';      // change if needed
    const name     = 'Radhika';
    const role     = 'admin';

    try {
        const existing = await db.query('SELECT id FROM users WHERE mobile = $1', [mobile]);
        if (existing.rows.length > 0) {
            console.log('Admin user already exists. Skipping.');
            process.exit(0);
        }

        const hash = await bcrypt.hash(password, 10);
        await db.query(
            `INSERT INTO users (name, mobile, password_hash, role, is_approved)
             VALUES ($1, $2, $3, $4, true)`,
            [name, mobile, hash, role]
        );
        console.log(`Admin user created — mobile: ${mobile}  password: ${password}`);
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
}

seedAdmin();
