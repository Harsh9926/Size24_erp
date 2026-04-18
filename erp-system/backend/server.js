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

// ── 404 handler — catches any unknown /api/* path ────────────────
app.use('/api/*', (req, res) => {
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
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);
});
