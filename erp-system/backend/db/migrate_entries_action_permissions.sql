-- Migration: action-level permissions — Phase 1 (Entries module only)
--
-- Extends the existing module_permissions/permission_logs RBAC system with a
-- finer-grained layer. Does NOT touch, alter, or drop module_permissions or
-- permission_logs — those keep working exactly as before for every module
-- that hasn't been migrated to action-level permissions yet.
--
-- Schema is intentionally generic (module_name + action_key) so future
-- modules can be added by INSERTing more rows into permission_actions —
-- no schema change needed for later phases.

CREATE TABLE IF NOT EXISTS permission_actions (
    id           SERIAL PRIMARY KEY,
    module_name  VARCHAR(50) NOT NULL,
    action_key   VARCHAR(80) NOT NULL,
    description  TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(module_name, action_key),
    -- action_key alone must also be unique: user_action_permissions.action_key
    -- has a FK referencing permission_actions(action_key) by itself, and
    -- Postgres requires a unique constraint matching exactly the referenced
    -- column(s) — the composite UNIQUE(module_name, action_key) above does
    -- NOT satisfy that. Without this, the FK below fails to create with
    -- "there is no unique constraint matching given keys for referenced
    -- table" on every fresh run of this migration.
    UNIQUE(action_key)
);
CREATE INDEX IF NOT EXISTS idx_perm_actions_module ON permission_actions(module_name);

CREATE TABLE IF NOT EXISTS user_action_permissions (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_key  VARCHAR(80) NOT NULL REFERENCES permission_actions(action_key) ON UPDATE CASCADE,
    granted     BOOLEAN NOT NULL DEFAULT false,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, action_key)
);
CREATE INDEX IF NOT EXISTS idx_user_action_perms_user ON user_action_permissions(user_id);

-- Phase 1 seed: Entries module only. Other modules are added in later phases
-- by inserting more rows here (or a new migrate_<module>_action_permissions.sql) —
-- this table is additive-only, never truncated/rewritten by later migrations.
INSERT INTO permission_actions (module_name, action_key, description) VALUES
    ('entries', 'entries.view',    'View daily sales entries'),
    ('entries', 'entries.create',  'Create a new daily sales entry'),
    ('entries', 'entries.edit',    'Edit an existing entry'),
    ('entries', 'entries.delete',  'Permanently delete an entry'),
    ('entries', 'entries.submit',  'Submit an entry for approval'),
    ('entries', 'entries.approve', 'Approve a pending entry'),
    ('entries', 'entries.reject',  'Reject a pending entry'),
    ('entries', 'entries.unlock',  'Unlock a locked entry for editing'),
    ('entries', 'entries.export',  'Export entries data')
ON CONFLICT (module_name, action_key) DO NOTHING;

-- ── Backward-compatibility backfill ─────────────────────────────────
-- Admins are NOT backfilled here — the resolver (hasPermission() in
-- middleware/checkPermission.js) treats role='admin' as an unrestricted
-- superuser for module-level WRITE, so admins need no explicit rows and
-- stay correct even for admin accounts created after this migration runs.
--
-- Managers are different: they stay restricted to WRITE_ACTION_MAP, which
-- does NOT include entries.approve/entries.reject. Today's managers already
-- perform these via requireRole('admin','manager') alone, so without this
-- backfill they'd be silently 403'd the moment this migration runs. This
-- one-time INSERT preserves their current real-world access exactly.
-- Idempotent via ON CONFLICT; new managers created after this migration
-- resolve through ROLE_DEFAULTS/WRITE_ACTION_MAP as designed (i.e. will NOT
-- get approve/reject unless explicitly granted — a deliberate tightening
-- for new managers going forward, matching the "WRITE isn't unlimited" goal).
INSERT INTO user_action_permissions (user_id, action_key, granted)
SELECT u.id, a.action_key, true
FROM users u
CROSS JOIN (VALUES
    ('entries.approve'), ('entries.reject')
) AS a(action_key)
WHERE u.role = 'manager'
ON CONFLICT (user_id, action_key) DO NOTHING;
