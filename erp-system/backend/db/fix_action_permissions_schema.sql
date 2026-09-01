-- ============================================================================
-- REPAIR: action-level permissions schema (partial-migration recovery)
--
-- Root cause: migrate_entries_action_permissions.sql created permission_actions
-- with only a COMPOSITE unique constraint UNIQUE(module_name, action_key).
-- user_action_permissions.action_key has a FK referencing
-- permission_actions(action_key) ALONE — Postgres requires a unique
-- constraint matching exactly the referenced column(s), so that FK could
-- never be created, on this database or a fresh one. This script:
--   1. Verifies no duplicate action_key values exist (would block the fix)
--   2. Adds the missing UNIQUE(action_key) constraint, only if not present
--   3. Creates user_action_permissions if it doesn't already exist
--   4. Re-applies the Phase 1/2/3 seed INSERTs (all ON CONFLICT DO NOTHING —
--      safe to re-run, will not duplicate or overwrite existing rows)
--
-- Safe to run multiple times. Does not DROP, TRUNCATE, or delete any rows.
-- Wrapped in a transaction: if anything fails, nothing is committed.
-- ============================================================================

BEGIN;

-- ---- 0. Pre-flight: verify permission_actions exists ----
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'permission_actions') THEN
        RAISE EXCEPTION 'permission_actions table does not exist — run migrate_entries_action_permissions.sql first (the CREATE TABLE part already succeeded per prior output, so this should not happen)';
    END IF;
END $$;

-- ---- 1. Guard: fail loudly (rollback) if duplicate action_key values exist ----
-- If this raises, STOP and inspect manually — do not proceed blindly.
DO $$
DECLARE
    dup_count INT;
BEGIN
    SELECT COUNT(*) INTO dup_count FROM (
        SELECT action_key FROM permission_actions GROUP BY action_key HAVING COUNT(*) > 1
    ) d;
    IF dup_count > 0 THEN
        RAISE EXCEPTION 'Found % duplicate action_key value(s) in permission_actions — resolve manually before adding UNIQUE(action_key). Run: SELECT action_key, COUNT(*) FROM permission_actions GROUP BY action_key HAVING COUNT(*) > 1;', dup_count;
    END IF;
END $$;

-- ---- 2. Add the missing single-column unique constraint (idempotent) ----
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'permission_actions'::regclass
          AND conname = 'permission_actions_action_key_key'
    ) THEN
        ALTER TABLE permission_actions ADD CONSTRAINT permission_actions_action_key_key UNIQUE (action_key);
        RAISE NOTICE 'Added UNIQUE(action_key) constraint to permission_actions';
    ELSE
        RAISE NOTICE 'UNIQUE(action_key) constraint already exists — skipped';
    END IF;
END $$;

-- ---- 3. Create user_action_permissions (safe no-op if it already exists) ----
CREATE TABLE IF NOT EXISTS user_action_permissions (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_key  VARCHAR(80) NOT NULL REFERENCES permission_actions(action_key) ON UPDATE CASCADE,
    granted     BOOLEAN NOT NULL DEFAULT false,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, action_key)
);
CREATE INDEX IF NOT EXISTS idx_user_action_perms_user ON user_action_permissions(user_id);

-- ---- 4a. Re-apply Phase 1 (Entries) seed rows — idempotent ----
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

INSERT INTO user_action_permissions (user_id, action_key, granted)
SELECT u.id, a.action_key, true
FROM users u
CROSS JOIN (VALUES ('entries.approve'), ('entries.reject')) AS a(action_key)
WHERE u.role = 'manager'
ON CONFLICT (user_id, action_key) DO NOTHING;

-- ---- 4b. Re-apply Phase 2 (Manager Funds) seed rows — idempotent ----
INSERT INTO permission_actions (module_name, action_key, description) VALUES
    ('manager_funds', 'manager_funds.view',            'View manager fund transfers, wallets and bank ledger'),
    ('manager_funds', 'manager_funds.transfer',         'Create a fund transfer (manager→admin or shop_user→manager)'),
    ('manager_funds', 'manager_funds.approve_transfer', 'Accept/approve or reject a pending fund transfer')
ON CONFLICT (module_name, action_key) DO NOTHING;

INSERT INTO user_action_permissions (user_id, action_key, granted)
SELECT u.id, a.action_key, true
FROM users u
CROSS JOIN (VALUES
    ('manager_funds.view'), ('manager_funds.transfer'), ('manager_funds.approve_transfer')
) AS a(action_key)
WHERE u.role = 'manager'
ON CONFLICT (user_id, action_key) DO NOTHING;

-- ---- 4c. Re-apply Phase 3 (Attendance family) seed rows — idempotent ----
INSERT INTO permission_actions (module_name, action_key, description) VALUES
    ('attendance', 'attendance.view_own',  'View own attendance / punch history'),
    ('attendance', 'attendance.view_team', 'View team/shop attendance dashboard and table'),
    ('attendance', 'attendance.punch',     'Punch in / punch out'),
    ('attendance', 'attendance.edit',      'Manually correct a day''s attendance status'),
    ('attendance', 'attendance.export',    'Export attendance data (no dedicated route today — see attendance_reports.export)'),

    ('attendance_assignments', 'attendance_assignments.view', 'View which shops an employee is assigned to for attendance'),
    ('attendance_assignments', 'attendance_assignments.edit', 'Assign or unassign an employee to/from a shop'),

    ('attendance_approvals', 'attendance_approvals.view',    'View pending registration and location-change requests'),
    ('attendance_approvals', 'attendance_approvals.approve', 'Approve a registration or location-change request'),
    ('attendance_approvals', 'attendance_approvals.reject',  'Reject a registration or location-change request'),

    ('attendance_reports', 'attendance_reports.view',   'View the monthly attendance report'),
    ('attendance_reports', 'attendance_reports.export', 'Export the attendance report as CSV/Excel'),

    ('attendance_payroll', 'attendance_payroll.view',   'View payroll / salary data'),
    ('attendance_payroll', 'attendance_payroll.edit',   'Edit an employee''s salary configuration'),
    ('attendance_payroll', 'attendance_payroll.export', 'Export payroll data (no dedicated route today)'),

    ('attendance_settings', 'attendance_settings.view', 'View attendance shift/geofence settings'),
    ('attendance_settings', 'attendance_settings.edit', 'Edit attendance shift/geofence settings')
ON CONFLICT (module_name, action_key) DO NOTHING;

COMMIT;

-- ---- 5. Post-checks (run these separately, after COMMIT, to verify) ----
-- SELECT conname FROM pg_constraint WHERE conrelid = 'permission_actions'::regclass;
-- SELECT to_regclass('user_action_permissions');
-- SELECT module_name, COUNT(*) FROM permission_actions GROUP BY module_name ORDER BY module_name;
-- SELECT COUNT(*) FROM user_action_permissions;
