-- Migration: action-level permissions — Phase 3 (Attendance module family)
--
-- Reuses the exact permission_actions / user_action_permissions architecture
-- created in Phase 1/2. Does NOT touch module_permissions or permission_logs.

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

-- ── Backward-compatibility backfill ─────────────────────────────────
-- Admins are NOT backfilled — the resolver's admin-WRITE-bypass (Phase 1)
-- covers them automatically now that 'attendance*' modules exist in
-- ROLE_DEFAULTS.admin (all 'WRITE' — see checkPermission.js MODULES change).
--
-- Managers: module-level WRITE_ACTION_MAP already covers view_own/view_team/
-- punch/edit (attendance), view/export (attendance_reports), and view
-- (attendance_payroll) — matching what managers can do today via
-- requireRole('admin','manager') alone, no backfill needed for those.
--
-- Managers have ZERO access today (100% admin-only routes) to:
--   attendance_assignments.*, attendance_approvals.*,
--   attendance_payroll.edit/export, attendance_settings.*
-- No backfill needed for these either — module defaults already correctly
-- deny them, matching current reality exactly. This migration intentionally
-- backfills NOTHING, because — unlike Manager Funds — every real access a
-- manager has today on Attendance is already reachable through
-- WRITE_ACTION_MAP without any explicit row.
