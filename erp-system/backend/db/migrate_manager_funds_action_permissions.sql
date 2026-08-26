-- Migration: action-level permissions — Phase 2 (Manager Funds module)
--
-- Reuses the exact permission_actions / user_action_permissions architecture
-- created in Phase 1 (see migrate_entries_action_permissions.sql). Does NOT
-- touch module_permissions or permission_logs.

INSERT INTO permission_actions (module_name, action_key, description) VALUES
    ('manager_funds', 'manager_funds.view',            'View manager fund transfers, wallets and bank ledger'),
    ('manager_funds', 'manager_funds.transfer',         'Create a fund transfer (manager→admin or shop_user→manager)'),
    ('manager_funds', 'manager_funds.approve_transfer', 'Accept/approve or reject a pending fund transfer')
ON CONFLICT (module_name, action_key) DO NOTHING;

-- ── Backward-compatibility backfill (CRITICAL for this module) ─────
-- Unlike Entries (where ROLE_DEFAULTS.manager.entries = 'WRITE'),
-- ROLE_DEFAULTS.manager.manager_funds is 'NO_ACCESS'. That default was never
-- actually enforced anywhere until this migration — managers today transfer/
-- accept/reject purely via requireRole('manager'). Without this backfill,
-- adding checkAction() to the routes would immediately 403 every existing
-- manager's core fund-transfer workflow the moment this migration runs.
-- This one-time INSERT preserves their current real-world access exactly.
-- New managers created after this migration will NOT get these grants
-- automatically (module default stays NO_ACCESS) — matches the existing
-- ROLE_DEFAULTS design intent and is a deliberate, not accidental, tightening
-- for future managers; an admin must grant manager_funds access via Access
-- Control for any manager created after this deploys.
INSERT INTO user_action_permissions (user_id, action_key, granted)
SELECT u.id, a.action_key, true
FROM users u
CROSS JOIN (VALUES
    ('manager_funds.view'), ('manager_funds.transfer'), ('manager_funds.approve_transfer')
) AS a(action_key)
WHERE u.role = 'manager'
ON CONFLICT (user_id, action_key) DO NOTHING;
