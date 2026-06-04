const db = require('../config/db');

const MODULES = [
    'dashboard', 'approvals', 'shops', 'users', 'entries',
    'expenses', 'manager_funds', 'anomalies', 'reports', 'new_entry',
];

// Role-based defaults: applied when no explicit DB record exists for a user+module.
// Ensures existing managers don't lose access after RBAC is deployed.
const ROLE_DEFAULTS = {
    manager: {
        dashboard:    'WRITE',
        approvals:    'WRITE',
        entries:      'WRITE',
        expenses:     'WRITE',
        reports:      'WRITE',
        shops:        'NO_ACCESS',
        users:        'NO_ACCESS',
        manager_funds:'NO_ACCESS',
        anomalies:    'NO_ACCESS',
        new_entry:    'NO_ACCESS',
    },
    shop_user: Object.fromEntries(MODULES.map(m => [m, 'NO_ACCESS'])),
};

// In-memory cache: key = "userId:moduleName", value = { val, ts }
const _cache = new Map();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

const LEVELS = { NO_ACCESS: 0, VIEW: 1, WRITE: 2 };

const permissionCache = {
    async get(userId, role, moduleName) {
        const key = `${userId}:${moduleName}`;
        const cached = _cache.get(key);
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.val;

        try {
            const result = await db.query(
                'SELECT permission_type FROM module_permissions WHERE user_id = $1 AND module_name = $2',
                [userId, moduleName]
            );
            const val = result.rows.length > 0
                ? result.rows[0].permission_type
                : (ROLE_DEFAULTS[role]?.[moduleName] ?? 'NO_ACCESS');
            _cache.set(key, { val, ts: Date.now() });
            return val;
        } catch {
            return ROLE_DEFAULTS[role]?.[moduleName] ?? 'NO_ACCESS';
        }
    },

    async getAll(userId, role) {
        const entries = await Promise.all(
            MODULES.map(async m => [m, await this.get(userId, role, m)])
        );
        return Object.fromEntries(entries);
    },

    invalidate(userId) {
        for (const key of _cache.keys()) {
            if (key.startsWith(`${userId}:`)) _cache.delete(key);
        }
    },

    hasLevel(permission, minLevel) {
        return (LEVELS[permission] ?? 0) >= (LEVELS[minLevel] ?? 0);
    },
};

module.exports = { permissionCache, MODULES, ROLE_DEFAULTS, LEVELS };
