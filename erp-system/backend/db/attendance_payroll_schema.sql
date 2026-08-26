-- erp-system/backend/db/attendance_payroll_schema.sql
-- Upgrade layer over attendance_schema.sql — idempotent (safe to re-run).
-- Adds: WEEK_OFF + expanded day statuses, configurable weekly-off days,
-- multi-session punch in/out, and per-employee monthly salary for payroll.
-- Loaded on server boot AFTER attendance_schema.sql. Never drops/renames.

-- ── 1. Settings: weekly-off days + payroll toggles ─────────────────
-- week_off_days: array of ISO weekday numbers (0=Sunday … 6=Saturday).
-- Default {0} = Sundays are weekly offs (paid, not absent).
ALTER TABLE attendance_settings ADD COLUMN IF NOT EXISTS week_off_days   INT[]  NOT NULL DEFAULT '{0}';
-- Number of paid days used as the payroll divisor. NULL/0 => use calendar
-- days in month. Kept configurable for fixed-30-day payroll policies.
ALTER TABLE attendance_settings ADD COLUMN IF NOT EXISTS payroll_days_basis VARCHAR(12) NOT NULL DEFAULT 'calendar';
                                   -- 'calendar' = days in month | 'fixed30'

-- ── 2. Per-employee monthly salary (drives payroll) ────────────────
ALTER TABLE attendance_registration ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(12,2) NOT NULL DEFAULT 0;

-- ── 3. Multi-session punches (In → Out → In → Out …) ───────────────
-- Every punch is stored as its own session row; nothing is overwritten.
-- The parent attendance row keeps first punch_in_at / last punch_out_at /
-- summed working_hours for backward compatibility with all existing APIs.
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id                  SERIAL PRIMARY KEY,
    attendance_id       INT NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
    user_id             INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date                DATE NOT NULL,
    seq                 INT NOT NULL,          -- 1-based session number within the day

    punch_in_at         TIMESTAMP,
    punch_in_lat        DECIMAL(10,7),
    punch_in_lng        DECIMAL(10,7),
    punch_in_distance_m NUMERIC(8,2),
    punch_in_accuracy_m NUMERIC(8,2),
    punch_in_selfie_url TEXT,
    punch_in_status     VARCHAR(20),
    punch_in_ip         VARCHAR(64),
    punch_in_browser    VARCHAR(120),
    punch_in_device     VARCHAR(120),

    punch_out_at        TIMESTAMP,
    punch_out_lat       DECIMAL(10,7),
    punch_out_lng       DECIMAL(10,7),
    punch_out_distance_m NUMERIC(8,2),
    punch_out_accuracy_m NUMERIC(8,2),
    punch_out_selfie_url TEXT,
    punch_out_status    VARCHAR(20),
    punch_out_ip        VARCHAR(64),
    punch_out_browser   VARCHAR(120),

    working_hours       NUMERIC(6,2),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_att_sessions_att  ON attendance_sessions(attendance_id);
CREATE INDEX IF NOT EXISTS idx_att_sessions_user ON attendance_sessions(user_id, date);

-- ── 4. Widen attendance_status to hold the full status set ─────────
-- attendance_status was VARCHAR(20) with NO check constraint, so the new
-- values (week_off, paid_leave, unpaid_leave, holiday) already fit. This
-- column records how a day was set manually vs auto from a punch.
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS status_source VARCHAR(12) NOT NULL DEFAULT 'punch';
                              -- 'punch' = derived from punches | 'manual' = admin-set

-- ── 5. Backfill: migrate existing single-punch rows into sessions ──
-- One-time, idempotent: only inserts a session for legacy rows that have a
-- punch but no session yet. Never runs twice for the same attendance row.
INSERT INTO attendance_sessions
    (attendance_id, user_id, date, seq,
     punch_in_at, punch_in_lat, punch_in_lng, punch_in_distance_m, punch_in_accuracy_m,
     punch_in_selfie_url, punch_in_status, punch_in_ip, punch_in_browser, punch_in_device,
     punch_out_at, punch_out_lat, punch_out_lng, punch_out_distance_m, punch_out_accuracy_m,
     punch_out_selfie_url, punch_out_status, punch_out_ip, punch_out_browser, working_hours)
SELECT a.id, a.user_id, a.date, 1,
       a.punch_in_at, a.punch_in_lat, a.punch_in_lng, a.punch_in_distance_m, a.punch_in_accuracy_m,
       a.punch_in_selfie_url, a.punch_in_status, a.punch_in_ip, a.punch_in_browser, a.punch_in_device,
       a.punch_out_at, a.punch_out_lat, a.punch_out_lng, a.punch_out_distance_m, a.punch_out_accuracy_m,
       a.punch_out_selfie_url, a.punch_out_status, a.punch_out_ip, a.punch_out_browser, a.working_hours
FROM attendance a
WHERE a.punch_in_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM attendance_sessions s WHERE s.attendance_id = a.id);
