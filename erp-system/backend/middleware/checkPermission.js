const db = require('../config/db');

const MODULES = [
    'dashboard', 'approvals', 'shops', 'users', 'entries',
    'expenses', 'manager_funds', 'anomalies', 'reports', 'new_entry',
    'access_control',
    // Phase 3: Attendance module family. These were never part of MODULES
    // before — routes/attendance.js has always been gated by requireRole()
    // alone, with zero module_permissions enforcement. Adding them here
    // (not a new system — same MODULES/ROLE_DEFAULTS arrays) is required
    // infrastructure: without a ROLE_DEFAULTS entry, admin's module-level
    // permission would resolve to NO_ACCESS (undefined → 'NO_ACCESS'
    // fallback) and the resolver's admin-WRITE-bypass would never trigger,
    // locking EVERYONE out including admin the moment checkAction() is
    // added to any attendance route.
    'attendance', 'attendance_assignments', 'attendance_approvals',
    'attendance_reports', 'attendance_payroll', 'attendance_settings',
];

// Role-based defaults: applied when no explicit DB record exists for a user+module.
// Ensures existing users don't lose access after RBAC is deployed.
const ROLE_DEFAULTS = {
    admin: Object.fromEntries(MODULES.map(m => [m, 'WRITE'])),
    manager: {
        dashboard:      'WRITE',
        approvals:      'WRITE',
        entries:        'WRITE',
        expenses:       'WRITE',
        reports:        'WRITE',
        shops:          'NO_ACCESS',
        users:          'NO_ACCESS',
        manager_funds:  'NO_ACCESS',
        anomalies:      'NO_ACCESS',
        new_entry:      'NO_ACCESS',
        access_control: 'NO_ACCESS',
        // Matches routes/attendance.js exactly as it stands today:
        // dashboard/table/detail/report/export/shops/recent-activity/day-status
        // are all requireRole('admin','manager') — managers have real WRITE-
        // equivalent access on the core module today.
        attendance:             'WRITE',
        // Assignments and approvals (registrations, location-changes) are
        // ALL requireRole('admin') only — managers have zero access today.
        attendance_assignments: 'NO_ACCESS',
        attendance_approvals:   'NO_ACCESS',
        // /report and /export are requireRole('admin','manager') — managers
        // can view and export reports today.
        attendance_reports:     'WRITE',
        // /payroll and /employees (view) are adminOrManager; salary edit
        // (/employees/:userId/salary) is admin-only — WRITE_ACTION_MAP below
        // reflects that split, not this module-level flag alone.
        attendance_payroll:     'WRITE',
        // PUT /settings is admin-only; managers have zero settings access today.
        attendance_settings:    'NO_ACCESS',
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
        const result = Object.fromEntries(entries);
        // Guarantee all 10 modules are present with a valid level
        for (const m of MODULES) {
            if (!result[m]) result[m] = ROLE_DEFAULTS[role]?.[m] ?? 'NO_ACCESS';
        }
        return result;
    },

    invalidate(userId) {
        for (const key of _cache.keys()) {
            if (key.startsWith(`${userId}:`)) _cache.delete(key);
        }
    },

    hasLevel(permission, minLevel) {
        return (LEVELS[permission] ?? 0) >= (LEVELS[minLevel] ?? 0);
    },

    /* ── Action-level permissions (Phase 1: Entries only) ────────────
       Bulk-loads a user's explicit action overrides in ONE query and
       caches the resulting map under the same 30s TTL / same _cache Map
       as module permissions — no second cache. */
    async getActionMap(userId) {
        const key = `${userId}:__actions__`;
        const cached = _cache.get(key);
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.val;

        try {
            const result = await db.query(
                'SELECT action_key, granted FROM user_action_permissions WHERE user_id = $1',
                [userId]
            );
            const val = Object.fromEntries(result.rows.map(r => [r.action_key, r.granted]));
            _cache.set(key, { val, ts: Date.now() });
            return val;
        } catch {
            return {};
        }
    },
};

/* ── Action registry (Phase 1: Entries only) ───────────────────────
   Every module added later just needs its actions appended here plus a
   migration seeding permission_actions — no other resolver change needed. */
const MODULE_ACTIONS = {
    entries: ['entries.view', 'entries.create', 'entries.edit', 'entries.delete',
              'entries.submit', 'entries.approve', 'entries.reject', 'entries.unlock', 'entries.export'],
    manager_funds: ['manager_funds.view', 'manager_funds.transfer', 'manager_funds.approve_transfer'],
    attendance: ['attendance.view_own', 'attendance.view_team', 'attendance.punch', 'attendance.edit', 'attendance.export'],
    attendance_assignments: ['attendance_assignments.view', 'attendance_assignments.edit'],
    attendance_approvals: ['attendance_approvals.view', 'attendance_approvals.approve', 'attendance_approvals.reject'],
    attendance_reports: ['attendance_reports.view', 'attendance_reports.export'],
    attendance_payroll: ['attendance_payroll.view', 'attendance_payroll.edit', 'attendance_payroll.export'],
    attendance_settings: ['attendance_settings.view', 'attendance_settings.edit'],
};

/* Documents exactly which actions the legacy module-level 'WRITE' level grants.
   WRITE never implies destructive/approval actions unless listed here — those
   must be granted explicitly via user_action_permissions. See resolution
   algorithm in hasPermission() below. */
const WRITE_ACTION_MAP = {
    entries: ['entries.view', 'entries.create', 'entries.edit', 'entries.submit', 'entries.export'],
    // entries.delete / entries.approve / entries.reject / entries.unlock are
    // deliberately excluded — WRITE alone does not grant them.
    manager_funds: ['manager_funds.view', 'manager_funds.transfer'],
    // manager_funds.approve_transfer deliberately excluded — approving a
    // transfer is a sensitive decision action, same pattern as entries.approve.
    // (In practice this branch rarely applies to managers today — their
    // module-level default is NO_ACCESS, not WRITE — see the migration's
    // backfill comment for why explicit grants are what actually matter here.)

    // Matches routes/attendance.js exactly: dashboard/table/detail/recent-
    // activity/shops are adminOrManager (view_team), punch-in/out + /me* are
    // open to all authenticated roles (view_own/punch), day-status is
    // adminOrManager (edit). attendance.export has NO backend route today
    // (the export endpoint belongs to attendance_reports) — excluded here.
    attendance: ['attendance.view_own', 'attendance.view_team', 'attendance.punch', 'attendance.edit'],
    // Assignments and approvals are 100% admin-only routes today — WRITE
    // grants nothing extra for managers on these (empty on purpose; a
    // manager only gets these via an explicit user_action_permissions grant).
    attendance_assignments: [],
    attendance_approvals: [],
    // /report and /export are adminOrManager — managers can view+export today.
    attendance_reports: ['attendance_reports.view', 'attendance_reports.export'],
    // /payroll and /employees (GET, view) are adminOrManager; salary edit is
    // admin-only — edit/export excluded from what module-level WRITE grants.
    attendance_payroll: ['attendance_payroll.view'],
    // PUT /settings is admin-only; managers have zero settings access today.
    attendance_settings: [],
};

/*
 * hasPermission(userId, role, actionKey) — central action-level resolver.
 *
 * Resolution order (highest priority first):
 *   1. Explicit row in user_action_permissions for this exact actionKey
 *      → use its `granted` boolean, full stop (this is the override layer).
 *   2. Fall back to the EXISTING module-level permission (module_permissions
 *      row, or ROLE_DEFAULTS[role][module] if no row) — unchanged from
 *      today's behavior:
 *        - NO_ACCESS → action denied
 *        - VIEW      → only '<module>.view' actions allowed
 *        - WRITE     → only actions listed in WRITE_ACTION_MAP[module] allowed
 *   3. No match at any step → denied.
 *
 * This never mutates or bypasses the existing module_permissions/ROLE_DEFAULTS
 * resolution — step 2 IS that exact resolution, reused as-is.
 */
async function hasPermission(userId, role, actionKey) {
    const moduleName = actionKey.split('.')[0];

    const actionMap = await permissionCache.getActionMap(userId);
    if (Object.prototype.hasOwnProperty.call(actionMap, actionKey)) {
        return actionMap[actionKey];
    }

    const modulePerm = await permissionCache.get(userId, role, moduleName);
    if (modulePerm === 'WRITE') {
        // 'admin' is the app's unrestricted superuser role (ROLE_DEFAULTS grants
        // it WRITE on every module today, and sensitive ops like entry deletion
        // are already further gated elsewhere by a specific-user check, not by
        // role) — WRITE for admin means everything in that module, not just the
        // conservative WRITE_ACTION_MAP subset. Non-admin roles (manager,
        // shop_user) stay restricted to WRITE_ACTION_MAP, so 'manager' still
        // cannot delete/unlock entries just because it has module-level WRITE.
        if (role === 'admin') return true;
        return (WRITE_ACTION_MAP[moduleName] || []).includes(actionKey);
    }
    if (modulePerm === 'VIEW') {
        return actionKey === `${moduleName}.view`;
    }
    return false; // NO_ACCESS or unknown module
}

/* Express middleware factory. Pass either a literal action key
   ('entries.delete') or a function (req) => actionKey for routes where the
   required action depends on the request body (e.g. bulk approve/reject).
   opts.exemptRoles — roles that bypass this check entirely (e.g. shop_user
   on a route that is ALSO their own-entry submission endpoint; the RBAC
   system was designed for the admin/manager surface — see entries.js for
   the concrete case this exists for). Exempting a role here means "this
   permission layer doesn't apply to them on this route", not "they're
   granted the action" — their access is whatever the route's existing
   business logic already gives them. */
function checkAction(actionKeyOrFn, opts = {}) {
    const exemptRoles = opts.exemptRoles || [];
    return async (req, res, next) => {
        try {
            if (exemptRoles.includes(req.user.role)) return next();
            const actionKey = typeof actionKeyOrFn === 'function' ? actionKeyOrFn(req) : actionKeyOrFn;
            const allowed = await hasPermission(req.user.id, req.user.role, actionKey);
            if (!allowed) {
                return res.status(403).json({
                    error: 'FORBIDDEN',
                    message: 'You do not have permission to perform this action.',
                });
            }
            next();
        } catch (err) {
            console.error('[checkAction] error:', err.message);
            res.status(500).json({ error: 'Permission check failed' });
        }
    };
}

/* Bulk-resolves every registered action for a user in one shot — used by
   GET /permissions/me and GET /permissions/:userId so the frontend gets one
   payload instead of calling hasPermission() per checkbox. Cheap: reuses the
   already-cached action map + module perm lookups, no extra DB round trips
   beyond what permissionCache already does. */
async function getAllActionPermissions(userId, role) {
    const allKeys = Object.values(MODULE_ACTIONS).flat();
    const entries = await Promise.all(
        allKeys.map(async k => [k, await hasPermission(userId, role, k)])
    );
    return Object.fromEntries(entries);
}

module.exports = {
    permissionCache, MODULES, ROLE_DEFAULTS, LEVELS,
    MODULE_ACTIONS, WRITE_ACTION_MAP, hasPermission, checkAction, getAllActionPermissions,
};
