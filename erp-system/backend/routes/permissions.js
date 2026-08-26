const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { permissionCache, MODULES, ROLE_DEFAULTS, MODULE_ACTIONS, getAllActionPermissions } = require('../middleware/checkPermission');

const VALID_LEVELS = ['NO_ACCESS', 'VIEW', 'WRITE'];
const VALID_ACTION_KEYS = new Set(Object.values(MODULE_ACTIONS).flat());

/* ── GET /api/permissions/me ─────────────────────────────────────────
   Returns the calling user's module permissions (DB + role defaults),
   plus an additive `actions` map (Phase 1: entries.* only) so the frontend
   can do can('entries.delete') style checks from one payload — existing
   consumers reading the flat module keys are unaffected.
*/
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const perms = await permissionCache.getAll(req.user.id, req.user.role);
        const actions = await getAllActionPermissions(req.user.id, req.user.role);
        res.json({ ...perms, actions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ── GET /api/permissions/users ──────────────────────────────────────
   Returns all users for the access-control dropdown (admin only).
   Admins are included but their permissions cannot be modified.
*/
router.get('/users', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, name, mobile, role
             FROM users
             WHERE status = 'active'
             ORDER BY
               CASE role WHEN 'admin' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END,
               name`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ── GET /api/permissions/:userId ────────────────────────────────────
   Returns a specific user's module permissions (admin only).
*/
router.get('/:userId', authenticateToken, requireRole('admin'), async (req, res) => {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });

    try {
        const userResult = await db.query('SELECT id, role FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const perms = await permissionCache.getAll(userId, userResult.rows[0].role);
        const actions = await getAllActionPermissions(userId, userResult.rows[0].role);
        res.json({ ...perms, actions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ── PUT /api/permissions/:userId ────────────────────────────────────
   Bulk-update a user's module permissions (admin only).
   Body: { permissions: { module_name: 'NO_ACCESS'|'VIEW'|'WRITE', ... },
           actionPermissions: { 'entries.delete': true, ... } }  ← optional,
   additive. Writes an audit log entry for every permission that changes.
*/
router.put('/:userId', authenticateToken, requireRole('admin'), async (req, res) => {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });

    const { permissions, actionPermissions } = req.body;
    const hasModuleBody = permissions && typeof permissions === 'object' && !Array.isArray(permissions);
    const hasActionBody = actionPermissions && typeof actionPermissions === 'object' && !Array.isArray(actionPermissions);
    if (!hasModuleBody && !hasActionBody) {
        return res.status(400).json({ error: 'Body must contain a permissions and/or actionPermissions object' });
    }

    try {
        const userResult = await db.query('SELECT id, role FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const { role } = userResult.rows[0];

        // Fetch current explicit permissions for audit diffing
        const currentResult = await db.query(
            'SELECT module_name, permission_type FROM module_permissions WHERE user_id = $1',
            [userId]
        );
        const currentExplicit = Object.fromEntries(
            currentResult.rows.map(r => [r.module_name, r.permission_type])
        );

        if (hasModuleBody) {
            for (const [moduleName, permType] of Object.entries(permissions)) {
                if (!MODULES.includes(moduleName)) continue;
                if (!VALID_LEVELS.includes(permType)) continue;

                const oldPerm = currentExplicit[moduleName] ?? (ROLE_DEFAULTS[role]?.[moduleName] ?? 'NO_ACCESS');

                await db.query(
                    `INSERT INTO module_permissions (user_id, module_name, permission_type, updated_at)
                     VALUES ($1, $2, $3, NOW())
                     ON CONFLICT (user_id, module_name)
                     DO UPDATE SET permission_type = $3, updated_at = NOW()`,
                    [userId, moduleName, permType]
                );

                if (oldPerm !== permType) {
                    await db.query(
                        `INSERT INTO permission_logs (admin_id, user_id, module_name, old_permission, new_permission)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [req.user.id, userId, moduleName, oldPerm, permType]
                    );
                }
            }
        }

        if (hasActionBody) {
            // Fetch current explicit action overrides for audit diffing
            const currentActionsResult = await db.query(
                'SELECT action_key, granted FROM user_action_permissions WHERE user_id = $1',
                [userId]
            );
            const currentActionExplicit = Object.fromEntries(
                currentActionsResult.rows.map(r => [r.action_key, r.granted])
            );

            for (const [actionKey, granted] of Object.entries(actionPermissions)) {
                // Never trust an arbitrary client-supplied string — must be a
                // real, seeded action_key (FK on user_action_permissions also
                // enforces this at the DB layer as defense-in-depth).
                if (!VALID_ACTION_KEYS.has(actionKey)) continue;
                if (typeof granted !== 'boolean') continue;

                const oldGranted = Object.prototype.hasOwnProperty.call(currentActionExplicit, actionKey)
                    ? currentActionExplicit[actionKey]
                    : null; // null = "was inherited, no explicit row yet"

                await db.query(
                    `INSERT INTO user_action_permissions (user_id, action_key, granted, updated_at)
                     VALUES ($1, $2, $3, NOW())
                     ON CONFLICT (user_id, action_key)
                     DO UPDATE SET granted = $3, updated_at = NOW()`,
                    [userId, actionKey, granted]
                );

                if (oldGranted !== granted) {
                    await db.query(
                        `INSERT INTO permission_logs (admin_id, user_id, module_name, old_permission, new_permission)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [req.user.id, userId, actionKey,
                         oldGranted === null ? 'INHERITED' : String(oldGranted).toUpperCase(),
                         String(granted).toUpperCase()]
                    );
                }
            }
        }

        // Invalidate server-side cache so next API call reflects new permissions immediately
        permissionCache.invalidate(userId);

        res.json({ success: true, message: 'Permissions updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
