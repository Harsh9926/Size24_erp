require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const cron    = require('node-cron');
const db      = require('./config/db');

const app = express();

// ── CORS ─────────────────────────────────────────────────────────
// Set CORS_ORIGIN in .env as a comma-separated list of allowed origins.
// Example: CORS_ORIGIN=http://snugg.in,https://snugg.in
const defaultOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://snugg.in',
    'https://snugg.in',
    'http://www.snugg.in',
    'https://www.snugg.in',
];
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : defaultOrigins;

app.use(cors({
    origin: (origin, cb) => {
        // Allow requests with no Origin header (mobile apps, curl, Postman)
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Static uploads ───────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health check ─────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── Routes ───────────────────────────────────────────────────────
// All routes are prefixed with /api so Nginx can proxy /api/* → :5000
// Route files define paths WITHOUT the /api prefix (e.g. router.post('/login'))
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/locations',     require('./routes/locations'));
app.use('/api/shops',         require('./routes/shops'));
app.use('/api/entries',       require('./routes/entries'));
app.use('/api/cashflow',      require('./routes/cashflow'));
app.use('/api/dashboard',     require('./routes/dashboard'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/audit',         require('./routes/audit'));
app.use('/api/upload',        require('./routes/upload'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reports',       require('./routes/reports'));
app.use('/api/excel',         require('./routes/excel'));
app.use('/api/transfers',          require('./routes/transfer'));
app.use('/api/manager-transfers',  require('./routes/managerTransfers'));

// ── 404 handler — catches any unknown /api/* path ────────────────
app.use('/api/*path', (req, res) => {
    res.status(404).json({
        error: `Route not found: ${req.method} ${req.originalUrl}`,
        hint:  'Check the API path. Example: POST /api/auth/login',
    });
});

// ── Global error handler ─────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err.message);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
});

// ── Cron: auto-lock entries every midnight ───────────────────────
cron.schedule('0 0 * * *', async () => {
    try {
        const result = await db.query(
            'UPDATE daily_entries SET locked = true WHERE locked = false',
        );
        console.log(`[cron] Locked ${result.rowCount} entries.`);
    } catch (err) {
        console.error('[cron] Auto-lock failed:', err.message);
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);

    // Auto-migrate: shop_users junction table — only creates if missing
    try {
        const exists = await db.query(
            `SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'shop_users'`
        );
        if (exists.rows.length === 0) {
            try { await db.query('GRANT CREATE ON SCHEMA public TO CURRENT_USER'); } catch (_) {}
            await db.query(`
                CREATE TABLE shop_users (
                    id          SERIAL PRIMARY KEY,
                    shop_id     INT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                    user_id     INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    assigned_by INT REFERENCES users(id) ON DELETE SET NULL,
                    UNIQUE(shop_id, user_id)
                )
            `);
            await db.query('CREATE INDEX idx_shop_users_shop ON shop_users(shop_id)');
            await db.query('CREATE INDEX idx_shop_users_user ON shop_users(user_id)');
            await db.query(`
                INSERT INTO shop_users (shop_id, user_id)
                SELECT id, user_id FROM shops WHERE user_id IS NOT NULL
                ON CONFLICT DO NOTHING
            `);
            console.log('[migrate] shop_users table created');
        } else {
            console.log('[migrate] shop_users table ready');
        }
    } catch (err) {
        console.error('[migrate] shop_users migration failed:', err.message);
        console.error('[migrate] Run: bash erp-system/backend/db/setup_production.sh');
    }

    // Auto-seed Indian states & cities if DB is empty
    try {
        const { seedLocations } = require('./scripts/seed_locations');
        const client = await db.pool.connect();
        await seedLocations(client);
        client.release();
    } catch (err) {
        console.error('[seed] Location seed failed:', err.message);
    }
});
