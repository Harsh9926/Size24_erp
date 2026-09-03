-- erp-system/backend/db/migrate_attendance_backdate_edit.sql
-- Adds admin back-date attendance marking support. Idempotent — safe to re-run.
-- Never drops/renames existing columns.

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS remarks             TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS manually_edited_by  INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS manually_edited_at  TIMESTAMP;
