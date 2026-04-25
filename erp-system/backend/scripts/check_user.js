const db = require('../config/db');

async function checkUser() {
    try {
        const result = await db.query(
            'SELECT id, name, mobile, role, is_approved FROM users WHERE mobile = $1',
            ['8817654579']
        );
        if (result.rows.length === 0) {
            console.log('USER NOT FOUND in local database.');
        } else {
            console.log('User found:', result.rows[0]);
        }
    } catch (err) {
        console.error('DB Error:', err.message);
    }
    process.exit(0);
}

checkUser();
