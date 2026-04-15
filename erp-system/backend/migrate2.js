require('dotenv').config();
const db = require('./config/db');

const migrations = [
    'ALTER TABLE shops ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7)',
    'ALTER TABLE shops ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7)',
    'ALTER TABLE daily_entries ADD COLUMN IF NOT EXISTS photo_url TEXT',
    'ALTER TABLE daily_entries ADD COLUMN IF NOT EXISTS submitted_lat DECIMAL(10,7)',
    'ALTER TABLE daily_entries ADD COLUMN IF NOT EXISTS submitted_lng DECIMAL(10,7)',
    'ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check',
    "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','manager','shop_user'))",
    `CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
    'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)',
];

(async () => {
    for (const sql of migrations) {
        try {
            await db.query(sql);
            console.log('OK:', sql.slice(0, 70));
        } catch (e) {
            console.error('ERR:', e.message);
        }
    }
    console.log('All migrations done');
    db.pool.end();
})();
