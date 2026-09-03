-- erp-system/backend/db/migrate_attendance_face_verification.sql
-- Face verification for punch-in (live selfie vs. registered/approved selfie).
-- Idempotent — safe to re-run. Never drops/renames existing columns.

-- Cached 128-d face descriptor for the employee's APPROVED registration selfie,
-- computed lazily on first use so approval flow itself is untouched.
ALTER TABLE attendance_registration ADD COLUMN IF NOT EXISTS face_descriptor JSONB;
ALTER TABLE attendance_registration ADD COLUMN IF NOT EXISTS face_descriptor_updated_at TIMESTAMP;

-- Per-punch face-match audit trail.
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in_face_verified BOOLEAN;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in_face_distance NUMERIC(6,4);

ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS punch_in_face_verified BOOLEAN;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS punch_in_face_distance NUMERIC(6,4);

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out_face_verified BOOLEAN;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out_face_distance NUMERIC(6,4);

ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS punch_out_face_verified BOOLEAN;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS punch_out_face_distance NUMERIC(6,4);

-- Configurable match strictness (lower = stricter). Default matches
-- faceVerificationService.js's DEFAULT_THRESHOLD.
ALTER TABLE attendance_settings ADD COLUMN IF NOT EXISTS face_match_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.550;
