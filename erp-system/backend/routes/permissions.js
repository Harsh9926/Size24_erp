const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { permissionCache, MODULES, ROLE_DEFAULTS } = require('../middleware/checkPermission');

const VALID_LEVELS = ['NO_ACCESS', 'VIEW', 'WRITE'];

/* ── GET /api/permissions/me ─────────────────────────────────────────
   Returns the calling user's module permissions.
   Admin always gets WRITE on all modules.
*/
router.get('/me', authenticateToken, async (req, res) => {
    if (req.user.role === 'admin') {
        return res.json(Object.fromEntries(MODULES.map(m => [m, 'WRITE'])));
    }
    try {
        const perms = await permissionCache.getAll(req.user.id, req.user.role);
        res.json(perms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ── GET /api/permissions/users ──────────────────────────────────────
   Returns non-admin users for the access-control dropdown (admin only).
*/
router.get('/users', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, name, mobile, role
             FROM users
             WHERE role != 'admin' AND status = 'active'
             ORDER BY role, name`
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

        const { role } = userResult.rows[0];
        if (role === 'admin') {
            return res.json(Object.fromEntries(MODULES.map(m => [m, 'WRITE'])));
        }

        const perms = await permissionCache.getAll(userId, role);
        res.json(perms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/* ── PUT /api/permissions/:userId ────────────────────────────────────
   Bulk-update a user's module permissions (admin only).
   Body: { permissions: { module_name: 'NO_ACCESS'|'VIEW'|'WRITE', ... } }
   Writes an audit log entry for every permission that changes.
*/
router.put('/:userId', authenticateToken, requireRole('admin'), async (req, res) => {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user id' });

    const { permissions } = req.body;
    if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
        return res.status(400).json({ error: 'Body must contain a permissions object' });
    }

    try {
        const userResult = await db.query('SELECT id, role FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const { role } = userResult.rows[0];
        if (role === 'admin') return res.status(400).json({ error: 'Cannot modify admin permissions' });

        // Fetch current explicit permissions for audit diffing
        const currentResult = await db.query(
            'SELECT module_name, permission_type FROM module_permissions WHERE user_id = $1',
            [userId]
        );
        const currentExplicit = Object.fromEntries(
            currentResult.rows.map(r => [r.module_name, r.permission_type])
        );

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

        // Invalidate server-side cache so next API call reflects new permissions immediately
        permissionCache.invalidate(userId);

        res.json({ success: true, message: 'Permissions updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
