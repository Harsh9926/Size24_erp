-- erp-system/backend/db/attendance_user_settings_schema.sql
-- Per-employee attendance + payroll overrides — idempotent (safe to re-run).
-- Loaded on server boot AFTER attendance_payroll_schema.sql.
-- Every override column is NULLABLE: NULL means "inherit the global
-- attendance_settings value". Nothing here changes existing behaviour until
-- an admin saves an override for a specific user.

CREATE TABLE IF NOT EXISTS attendance_user_settings (
    user_id               INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- Shift / marking rules (NULL => inherit global)
    shift_start           TIME,
    shift_end             TIME,
    grace_minutes         INT,
    half_day_after        TIME,
    min_working_hours     NUMERIC(4,2),
    require_gps           BOOLEAN,
    require_selfie        BOOLEAN,
    max_gps_accuracy_m    INT,
    week_off_days         INT[],
    office_radius_m       INT,

    -- When true, punches are validated against the user's ASSIGNED SHOP
    -- GPS location + radius (no other location is accepted). When false/NULL
    -- the legacy registered-location geofence is used (unchanged behaviour).
    enforce_shop_location BOOLEAN,

    -- Payroll
    monthly_salary        NUMERIC(12,2),

    updated_by            INT REFERENCES users(id) ON DELETE SET NULL,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
