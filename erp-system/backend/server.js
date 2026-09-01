// Server updated: 2026-07-31 16:10 IST
require('dotenv').config();
const express   = require('express');
const http      = require('http');
const { Server: SocketServer } = require('socket.io');
const cors      = require('cors');
const path      = require('path');
const cron      = require('node-cron');
const rateLimit = require('express-rate-limit');
const jwt       = require('jsonwebtoken');
const db        = require('./config/db');
const { permissionCache, LEVELS } = require('./middleware/checkPermission');

const app        = express();
const httpServer = http.createServer(app);

// Trust nginx proxy (required for rate limiter + correct client IPs)
app.set('trust proxy', 1);

// ── CORS ─────────────────────────────────────────────────────────
// Set CORS_ORIGIN in .env as a comma-separated list of allowed origins.
// Example: CORS_ORIGIN=http://snugg.in,https://snugg.in
const defaultOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://shopsize24.in',
    'https://shopsize24.in',
    'http://www.shopsize24.in',
    'https://www.shopsize24.in',
    'http://snugg.in',
    'https://snugg.in',
    'http://www.snugg.in',
    'https://www.snugg.in',
];
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : defaultOrigins;

const corsOptions = {
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

/* ── Socket.io ───────────────────────────────────────────────────── */
const io = new SocketServer(httpServer, { cors: corsOptions });
app.set('io', io);   // controllers access via req.app.get('io')

io.on('connection', (socket) => {
    console.log(`[Socket] connected: ${socket.id}`);
    socket.on('disconnect', () => console.log(`[Socket] disconnected: ${socket.id}`));
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Rate limiting ────────────────────────────────────────────────
// Strict limit on auth endpoints to prevent brute-force
app.use('/api/auth/login', rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
}));
// General API limit
app.use('/api/', rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
}));

// ── Static uploads ───────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health check ─────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── Module-level RBAC permission middleware ───────────────────────
// Runs before every protected /api route.
// Admin role always passes. Non-admin users are checked against
// module_permissions table (with role-based defaults as fallback).
// JWT is decoded here without a DB round-trip; full auth still happens
// inside each route's authenticateToken middleware.
const RBAC_SKIP_PATHS = [
    '/auth', '/health', '/locations', '/upload', '/notifications',
    '/permissions', '/excel', '/ai', '/mcp', '/activity', '/cashflow',
    '/audit', '/transfers/balance', '/transfers/managers',
    '/payment-in/admins', '/attendance',
];

// Maps req.path (after /api) patterns to {module, alwaysWrite}
const RBAC_ROUTE_MAP = [
    { re: /^\/entries\/\d+\/approve(\/|$)/, module: 'approvals',     write: true  },
    { re: /^\/entries\/\d+\/reject(\/|$)/,  module: 'approvals',     write: true  },
    { re: /^\/entries\/bulk-action(\/|$)/,  module: 'approvals',     write: true  },
    { re: /^\/entries/,                     module: 'entries'                      },
    { re: /^\/shops/,                       module: 'shops'                        },
    { re: /^\/users/,                       module: 'users'                        },
    { re: /^\/expenses/,                    module: 'expenses'                     },
    { re: /^\/transfers/,                   module: 'manager_funds'                },
    { re: /^\/manager-transfers/,           module: 'manager_funds'                },
    { re: /^\/payment-in/,                 module: 'manager_funds'                },
    { re: /^\/anomalies/,                   module: 'anomalies'                    },
    { re: /^\/reports/,                     module: 'reports'                      },
    { re: /^\/dashboard/,                   module: 'dashboard'                    },
];

app.use('/api', async (req, res, next) => {
    if (RBAC_SKIP_PATHS.some(p => req.path.startsWith(p))) return next();

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return next();

    let decoded;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET); }
    catch { return next(); } // invalid token handled by authenticateToken in route

    // RBAC module system only applies to admin/manager roles.
    // Shop users are governed by requireRole() guards inside each route file.
    if (decoded.role === 'shop_user') return next();

    const rule = RBAC_ROUTE_MAP.find(r => r.re.test(req.path));
    if (!rule) return next();

    const isWrite   = rule.write || req.method !== 'GET';
    const minLevel  = isWrite ? 'WRITE' : 'VIEW';
    const permission = await permissionCache.get(decoded.id, decoded.role, rule.module);

    if ((LEVELS[permission] ?? 0) < LEVELS[minLevel]) {
        return res.status(403).json({
            error: `Access denied: you don't have ${minLevel.toLowerCase()} access to '${rule.module}'.`,
            module: rule.module,
        });
    }
    next();
});

// ── Routes ───────────────────────────────────────────────────────
// All routes are prefixed with /api so Nginx can proxy /api/* → :5000
// Route files define paths WITHOUT the /api prefix (e.g. router.post('/login'))
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/permissions',   require('./routes/permissions'));
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
app.use('/api/ai',                 require('./routes/ai'));
app.use('/api/mcp',                require('./routes/mcp'));
app.use('/api/expenses',           require('./routes/expenses'));
app.use('/api/anomalies',          require('./routes/anomalies'));
app.use('/api/activity',           require('./routes/activity'));
app.use('/api/payment-in',         require('./routes/paymentIn'));
app.use('/api/attendance',         require('./routes/attendance'));

// ── Inventory / Purchase / Sales modules ─────────────────────────────
app.use('/api/inv',          require('./routes/inventory'));
app.use('/api/inv/purchase', require('./routes/purchase'));
app.use('/api/inv/sales',    require('./routes/invSales'));
app.use('/api/inv/parties',  require('./routes/parties'));
app.use('/api/inv/schools',  require('./routes/invSchools'));

// ── Billing & POS module ──────────────────────────────────────────────
app.use('/api/pos',          require('./routes/pos'));
app.use('/api/pos2',         require('./routes/posPhase2'));

// ── Manufacturing: Product Master, Raw Materials, BOM ────────────────
app.use('/api/mfg/product-master', require('./routes/productMaster'));
app.use('/api/mfg/raw-materials',  require('./routes/rawMaterials'));
app.use('/api/mfg/bom',            require('./routes/bom'));

// ── Phase 3 Modules ─────────────────────────────────────────────────
app.use('/api/accounting',         require('./routes/accounting'));
app.use('/api/hr',                 require('./routes/hr'));
app.use('/api/crm',                require('./routes/crm'));
app.use('/api/franchise',          require('./routes/franchise'));
app.use('/api/service',            require('./routes/service'));
app.use('/api/mrp',                require('./routes/mrp'));
app.use('/api/sys',                require('./routes/settings'));

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

// ── Cron: daily reminder at 7 PM IST (13:30 UTC) ────────────────
// 1. Sends individual WhatsApp reminder to EVERY user of each missing shop
// 2. Sends consolidated summary to ALL admin users
cron.schedule('30 13 * * *', async () => {
    const wa = require('./services/aiSensyService');
    if (!wa.ENABLED) return;
    try {
        const today   = new Date().toISOString().split('T')[0];
        const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

        // ── Shops that have NOT submitted today ──────────────────
        const { rows: missingShops } = await db.query(`
            SELECT DISTINCT s.id, s.shop_name
            FROM shops s
            WHERE s.id NOT IN (
                SELECT shop_id FROM daily_entries WHERE date = $1
            )
            ORDER BY s.shop_name
        `, [today]);

        console.log(`[cron] Reminder: ${missingShops.length} shops haven't submitted for ${today}`);
        if (missingShops.length === 0) return;

        const shopIds   = missingShops.map(s => s.id);
        const shopNames = missingShops.map(s => s.shop_name).join(', ');

        // ── 1. Individual reminder to ALL users of each missing shop ──
        const { rows: shopUsers } = await db.query(`
            SELECT DISTINCT u.mobile, s.shop_name
            FROM shop_users su
            JOIN users  u ON u.id  = su.user_id
            JOIN shops  s ON s.id  = su.shop_id
            WHERE su.shop_id = ANY($1::int[])
              AND u.mobile IS NOT NULL
              AND u.is_active = true
        `, [shopIds]);

        for (const user of shopUsers) {
            await wa.notifyReminder(user.mobile, user.shop_name);
            await new Promise(r => setTimeout(r, 300)); // rate-limit
        }
        console.log(`[cron] Sent ${shopUsers.length} individual reminders`);

        // ── 2. Admin + Manager summary ───────────────────────────
        const { rows: adminManagers } = await db.query(`
            SELECT mobile FROM users
            WHERE role IN ('admin', 'manager') AND mobile IS NOT NULL AND is_active = true
        `);

        for (const u of adminManagers) {
            await wa.notifyAdminSummary(u.mobile, dateStr, missingShops.length, shopNames);
            await new Promise(r => setTimeout(r, 300));
        }
        console.log(`[cron] Sent summary to ${adminManagers.length} admins/managers`);

    } catch (err) {
        console.error('[cron] Daily reminder failed:', err.message);
    }
});

// ── Cron: 11 PM IST sales summary to all admins (17:30 UTC) ────
cron.schedule('30 17 * * *', async () => {
    const wa = require('./services/aiSensyService');
    if (!wa.ENABLED) return;
    try {
        const today   = new Date().toISOString().split('T')[0];
        const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

        const { rows: shopSales } = await db.query(`
            SELECT s.shop_name,
                   COALESCE(SUM(de.total_sale::NUMERIC), 0) AS total_sale
            FROM shops s
            LEFT JOIN daily_entries de ON de.shop_id = s.id
                AND de.date = $1
                AND de.approval_status = 'APPROVED'
            GROUP BY s.shop_name
            ORDER BY total_sale DESC
        `, [today]);

        const grandTotal = shopSales.reduce((sum, r) => sum + parseFloat(r.total_sale), 0);
        const totalStr   = grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 });
        const breakdown  = shopSales
            .map(r => `${r.shop_name}: Rs.${parseFloat(r.total_sale).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`)
            .join(' | ');

        const { rows: adminManagers } = await db.query(`
            SELECT mobile FROM users
            WHERE role IN ('admin', 'manager') AND mobile IS NOT NULL AND is_active = true
        `);

        for (const u of adminManagers) {
            await wa.notifySalesSummary(u.mobile, dateStr, totalStr, breakdown);
            await new Promise(r => setTimeout(r, 300));
        }
        console.log(`[cron] Sent 9 PM sales summary to ${adminManagers.length} admins/managers (₹${totalStr})`);

    } catch (err) {
        console.error('[cron] Sales summary failed:', err.message);
    }
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
httpServer.listen(PORT, async () => {
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

    // Auto-migrate: Inventory module tables
    try {
        const fs = require('fs');
        const path = require('path');
        const invSql = fs.readFileSync(path.join(__dirname, 'db', 'inv_schema.sql'), 'utf8');
        await db.query(invSql);
        console.log('[migrate] Inventory schema ready');
    } catch (err) {
        console.error('[migrate] Inventory schema failed:', err.message);
    }

    // Auto-migrate: Billing & POS schema (loyalty, delivery challans)
    try {
        const fs   = require('fs');
        const path = require('path');
        const posSql = fs.readFileSync(path.join(__dirname, 'db', 'pos_schema.sql'), 'utf8');
        await db.query(posSql);
        console.log('[migrate] POS/Billing schema ready');
    } catch (err) {
        console.error('[migrate] POS schema failed:', err.message);
    }

    // Auto-migrate: POS Phase 2 (exchange, advances, offers, warehouses, batches, cash counter)
    try {
        const fs   = require('fs');
        const path = require('path');
        const pos2Sql = fs.readFileSync(path.join(__dirname, 'db', 'pos_schema_v2.sql'), 'utf8');
        await db.query(pos2Sql);
        console.log('[migrate] POS Phase 2 schema ready');
    } catch (err) {
        console.error('[migrate] POS Phase 2 schema failed:', err.message);
    }

    // Auto-migrate: Manufacturing module tables (Product Master, Raw Materials, BOM)
    try {
        const fs   = require('fs');
        const path = require('path');
        const mfgSql = fs.readFileSync(path.join(__dirname, 'db', 'manufacturing_schema.sql'), 'utf8');
        await db.query(mfgSql);
        console.log('[migrate] Manufacturing schema ready');
    } catch (err) {
        console.error('[migrate] Manufacturing schema failed:', err.message);
    }

    // Auto-migrate: Phase 3 — Accounting
    try {
        const fs   = require('fs');
        const path = require('path');
        const sql = fs.readFileSync(path.join(__dirname, 'db', 'phase3_accounting.sql'), 'utf8');
        await db.query(sql);
        console.log('[migrate] Phase 3 Accounting schema ready');
    } catch (err) {
        console.error('[migrate] Phase 3 Accounting schema failed:', err.message);
    }

    // Auto-migrate: Phase 3 — HR, CRM
    try {
        const fs   = require('fs');
        const path = require('path');
        const sql = fs.readFileSync(path.join(__dirname, 'db', 'phase3_hr_crm.sql'), 'utf8');
        await db.query(sql);
        console.log('[migrate] Phase 3 HR & CRM schema ready');
    } catch (err) {
        console.error('[migrate] Phase 3 HR & CRM schema failed:', err.message);
    }

    // Auto-migrate: Phase 3 — Franchise, Service, MRP, Settings
    try {
        const fs   = require('fs');
        const path = require('path');
        const sql = fs.readFileSync(path.join(__dirname, 'db', 'phase3_franchise_service.sql'), 'utf8');
        await db.query(sql);
        console.log('[migrate] Phase 3 Franchise, Service & MRP schema ready');
    } catch (err) {
        console.error('[migrate] Phase 3 Franchise/Service/MRP schema failed:', err.message);
    }

    // Auto-migrate: mandatory Photo Proof key on daily entries
    try {
        await db.query('ALTER TABLE daily_entries ADD COLUMN IF NOT EXISTS photo_proof_key TEXT');
        console.log('[migrate] daily_entries.photo_proof_key ready');
    } catch (err) {
        console.error('[migrate] photo_proof_key migration failed:', err.message);
    }

    // Auto-migrate: Separate Attendance Shop Users junction table
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS attendance_shop_users (
                id          SERIAL PRIMARY KEY,
                shop_id     INT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                user_id     INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                assigned_by INT REFERENCES users(id) ON DELETE SET NULL,
                UNIQUE(shop_id, user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_att_shop_users_shop ON attendance_shop_users(shop_id);
            CREATE INDEX IF NOT EXISTS idx_att_shop_users_user ON attendance_shop_users(user_id);
        `);
        console.log('[migrate] attendance_shop_users ready');
    } catch (err) {
        console.error('[migrate] attendance_shop_users migration failed:', err.message);
    }

    // Auto-migrate: shops.geofence_radius_m (schema.sql only creates it on a
    // fresh table — older production shops rows predate this column)
    try {
        const fs   = require('fs');
        const path = require('path');
        const sql  = fs.readFileSync(path.join(__dirname, 'db', 'migrate_shops_geofence_radius.sql'), 'utf8');
        await db.query(sql);
        console.log('[migrate] shops.geofence_radius_m ready');
    } catch (err) {
        console.error('[migrate] shops.geofence_radius_m migration failed:', err.message);
    }

    // Auto-migrate: Employee Attendance Management module
    try {
        const fs   = require('fs');
        const path = require('path');
        const sql  = fs.readFileSync(path.join(__dirname, 'db', 'attendance_schema.sql'), 'utf8');
        await db.query(sql);
        console.log('[migrate] Attendance schema ready');
    } catch (err) {
        console.error('[migrate] Attendance schema failed:', err.message);
    }

    // Auto-migrate: Attendance Payroll upgrade (week-off, sessions, salary)
    try {
        const fs   = require('fs');
        const path = require('path');
        const sql  = fs.readFileSync(path.join(__dirname, 'db', 'attendance_payroll_schema.sql'), 'utf8');
        await db.query(sql);
        console.log('[migrate] Attendance payroll schema ready');
    } catch (err) {
        console.error('[migrate] Attendance payroll schema failed:', err.message);
    }

    // Auto-migrate: Per-employee attendance + payroll overrides
    try {
        const fs   = require('fs');
        const path = require('path');
        const sql  = fs.readFileSync(path.join(__dirname, 'db', 'attendance_user_settings_schema.sql'), 'utf8');
        await db.query(sql);
        console.log('[migrate] Attendance user-settings schema ready');
    } catch (err) {
        console.error('[migrate] Attendance user-settings schema failed:', err.message);
    }

    // Auto-migrate: dedupe guard for concurrent open attendance sessions
    try {
        const fs   = require('fs');
        const path = require('path');
        const sql  = fs.readFileSync(path.join(__dirname, 'db', 'migrate_attendance_session_dedupe.sql'), 'utf8');
        await db.query(sql);
        console.log('[migrate] Attendance session dedupe guard ready');
    } catch (err) {
        console.error('[migrate] Attendance session dedupe guard failed:', err.message);
    }

    // Auto-migrate: action-level permissions — Phase 1 (Entries module)
    try {
        const fs   = require('fs');
        const path = require('path');
        const sql  = fs.readFileSync(path.join(__dirname, 'db', 'migrate_entries_action_permissions.sql'), 'utf8');
        await db.query(sql);
        console.log('[migrate] Entries action-permissions ready');
    } catch (err) {
        console.error('[migrate] Entries action-permissions failed:', err.message);
    }

    // Auto-migrate: action-level permissions — Phase 2 (Manager Funds module)
    try {
        const fs   = require('fs');
        const path = require('path');
        const sql  = fs.readFileSync(path.join(__dirname, 'db', 'migrate_manager_funds_action_permissions.sql'), 'utf8');
        await db.query(sql);
        console.log('[migrate] Manager Funds action-permissions ready');
    } catch (err) {
        console.error('[migrate] Manager Funds action-permissions failed:', err.message);
    }

    // Auto-migrate: action-level permissions — Phase 3 (Attendance module family)
    try {
        const fs   = require('fs');
        const path = require('path');
        const sql  = fs.readFileSync(path.join(__dirname, 'db', 'migrate_attendance_action_permissions.sql'), 'utf8');
        await db.query(sql);
        console.log('[migrate] Attendance action-permissions ready');
    } catch (err) {
        console.error('[migrate] Attendance action-permissions failed:', err.message);
    }

    // Auto-migrate: Admin Bank Ledger (payment-in / manager bank deposit records)
    try {
        const fs   = require('fs');
        const path = require('path');
        const sql  = fs.readFileSync(path.join(__dirname, 'db', 'migrate_admin_bank_ledger.sql'), 'utf8');
        await db.query(sql);
        console.log('[migrate] Admin bank ledger schema ready');
    } catch (err) {
        console.error('[migrate] Admin bank ledger schema failed:', err.message);
    }

    // Auto-migrate: Payment In fields on daily_entries
    try {
        const fs   = require('fs');
        const path = require('path');
        const sql  = fs.readFileSync(path.join(__dirname, 'db', 'migrate_payment_in_entry.sql'), 'utf8');
        await db.query(sql);
        console.log('[migrate] Payment In fields ready');
    } catch (err) {
        console.error('[migrate] Payment In fields migration failed:', err.message);
    }

    // Auto-migrate: RBAC tables (module_permissions + permission_logs)
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS module_permissions (
                id              SERIAL PRIMARY KEY,
                user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                module_name     VARCHAR(50) NOT NULL,
                permission_type VARCHAR(20) NOT NULL DEFAULT 'NO_ACCESS'
                                CHECK (permission_type IN ('NO_ACCESS','VIEW','WRITE')),
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, module_name)
            )
        `);
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_module_perms_user
            ON module_permissions(user_id)
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS permission_logs (
                id             SERIAL PRIMARY KEY,
                admin_id       INT REFERENCES users(id) ON DELETE SET NULL,
                user_id        INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                module_name    VARCHAR(50) NOT NULL,
                old_permission VARCHAR(20),
                new_permission VARCHAR(20) NOT NULL,
                timestamp      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_perm_logs_user
            ON permission_logs(user_id)
        `);
        console.log('[migrate] RBAC tables ready (module_permissions, permission_logs)');
    } catch (err) {
        console.error('[migrate] RBAC migration failed:', err.message);
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
