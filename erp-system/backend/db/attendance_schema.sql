-- erp-system/backend/db/attendance_schema.sql
-- Employee Attendance Management Module — idempotent (safe to re-run).
-- Auto-loaded on server boot (see server.js migrate block).
-- Roles reuse the existing users table: 'shop_user' acts as Employee,
-- 'manager' marks own attendance, 'admin' has full control.

-- ── 1. Global attendance settings (single row, id = 1) ─────────────
CREATE TABLE IF NOT EXISTS attendance_settings (
    id                   INT PRIMARY KEY DEFAULT 1,
    shift_start          TIME        NOT NULL DEFAULT '11:00',
    shift_end            TIME        NOT NULL DEFAULT '20:00',
    grace_minutes        INT         NOT NULL DEFAULT 15,
    half_day_after       TIME        NOT NULL DEFAULT '13:00',
    office_radius_m      INT         NOT NULL DEFAULT 50,
    min_working_hours    NUMERIC(4,2) NOT NULL DEFAULT 9,
    require_gps          BOOLEAN     NOT NULL DEFAULT true,
    require_selfie       BOOLEAN     NOT NULL DEFAULT true,
    max_gps_accuracy_m   INT         NOT NULL DEFAULT 20,
    updated_by           INT REFERENCES users(id) ON DELETE SET NULL,
    updated_at           TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_settings_row CHECK (id = 1)
);
INSERT INTO attendance_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── 2. Per-user registration (GPS + selfie, admin-approved office) ─
CREATE TABLE IF NOT EXISTS attendance_registration (
    id                  SERIAL PRIMARY KEY,
    user_id             INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shop_id             INT REFERENCES shops(id) ON DELETE SET NULL,
    latitude            DECIMAL(10,7),
    longitude           DECIMAL(10,7),
    gps_accuracy_m      NUMERIC(8,2),
    selfie_url          TEXT,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected')),
    -- Locked-in office location, set on approval
    registered_lat      DECIMAL(10,7),
    registered_lng      DECIMAL(10,7),
    allowed_radius_m    INT DEFAULT 50,
    reject_reason       TEXT,
    reviewed_by         INT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at         TIMESTAMP,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_att_reg_status ON attendance_registration(status);

-- Self-healing: patch tables created by an earlier partial schema so the
-- approval columns exist (CREATE TABLE IF NOT EXISTS never adds columns).
-- All idempotent — no-ops when the column is already present.
ALTER TABLE attendance_registration ADD COLUMN IF NOT EXISTS shop_id          INT REFERENCES shops(id) ON DELETE SET NULL;
ALTER TABLE attendance_registration ADD COLUMN IF NOT EXISTS gps_accuracy_m   NUMERIC(8,2);
ALTER TABLE attendance_registration ADD COLUMN IF NOT EXISTS selfie_url       TEXT;
ALTER TABLE attendance_registration ADD COLUMN IF NOT EXISTS registered_lat   DECIMAL(10,7);
ALTER TABLE attendance_registration ADD COLUMN IF NOT EXISTS registered_lng   DECIMAL(10,7);
ALTER TABLE attendance_registration ADD COLUMN IF NOT EXISTS allowed_radius_m INT DEFAULT 50;
ALTER TABLE attendance_registration ADD COLUMN IF NOT EXISTS reject_reason    TEXT;
ALTER TABLE attendance_registration ADD COLUMN IF NOT EXISTS reviewed_by      INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE attendance_registration ADD COLUMN IF NOT EXISTS reviewed_at      TIMESTAMP;

-- ── 3. Daily attendance (one row per user per day) ─────────────────
CREATE TABLE IF NOT EXISTS attendance (
    id                    SERIAL PRIMARY KEY,
    user_id               INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shop_id               INT REFERENCES shops(id) ON DELETE SET NULL,
    date                  DATE NOT NULL,

    -- Punch In
    punch_in_at           TIMESTAMP,
    punch_in_lat          DECIMAL(10,7),
    punch_in_lng          DECIMAL(10,7),
    punch_in_distance_m   NUMERIC(8,2),
    punch_in_accuracy_m   NUMERIC(8,2),
    punch_in_selfie_url   TEXT,
    punch_in_status       VARCHAR(20),  -- early_arrival | on_time | late | half_day
    punch_in_ip           VARCHAR(64),
    punch_in_browser      VARCHAR(120),
    punch_in_device       VARCHAR(120),

    -- Punch Out
    punch_out_at          TIMESTAMP,
    punch_out_lat         DECIMAL(10,7),
    punch_out_lng         DECIMAL(10,7),
    punch_out_distance_m  NUMERIC(8,2),
    punch_out_accuracy_m  NUMERIC(8,2),
    punch_out_selfie_url  TEXT,
    punch_out_status      VARCHAR(20),  -- early_exit | on_time | overtime
    punch_out_ip          VARCHAR(64),
    punch_out_browser     VARCHAR(120),
    punch_out_device      VARCHAR(120),

    working_hours         NUMERIC(5,2),
    attendance_status     VARCHAR(20) NOT NULL DEFAULT 'present',
                            -- present | absent | late | half_day
    verification_status   VARCHAR(20) NOT NULL DEFAULT 'ok',
                            -- ok | pending_verification
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_date    ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_user    ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_shop    ON attendance(shop_id);

-- ── 4. Audit trail of every attendance action ──────────────────────
CREATE TABLE IF NOT EXISTS attendance_logs (
    id             SERIAL PRIMARY KEY,
    user_id        INT REFERENCES users(id) ON DELETE SET NULL,
    attendance_id  INT REFERENCES attendance(id) ON DELETE CASCADE,
    action         VARCHAR(40) NOT NULL,  -- PUNCH_IN | PUNCH_OUT | REGISTER | APPROVE_REG | ...
    detail         JSONB,
    ip             VARCHAR(64),
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_att_logs_user ON attendance_logs(user_id);

-- ── 5. Selfie registry (all captured selfies, any context) ─────────
CREATE TABLE IF NOT EXISTS attendance_selfies (
    id             SERIAL PRIMARY KEY,
    user_id        INT REFERENCES users(id) ON DELETE CASCADE,
    attendance_id  INT REFERENCES attendance(id) ON DELETE CASCADE,
    context        VARCHAR(30) NOT NULL,  -- registration | punch_in | punch_out | location_change
    url            TEXT NOT NULL,
    latitude       DECIMAL(10,7),
    longitude      DECIMAL(10,7),
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 6. Location change requests (admin-approved) ───────────────────
CREATE TABLE IF NOT EXISTS location_change_requests (
    id               SERIAL PRIMARY KEY,
    user_id          INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude         DECIMAL(10,7),
    longitude        DECIMAL(10,7),
    gps_accuracy_m   NUMERIC(8,2),
    selfie_url       TEXT,
    reason           TEXT,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','rejected')),
    reject_reason    TEXT,
    reviewed_by      INT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at      TIMESTAMP,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_loc_change_status ON location_change_requests(status);

-- ── Self-healing for punch + location-change write columns (idempotent) ──
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in_at          TIMESTAMP;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in_lat         DECIMAL(10,7);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in_lng         DECIMAL(10,7);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in_distance_m  NUMERIC(8,2);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in_accuracy_m  NUMERIC(8,2);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in_selfie_url  TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in_status      VARCHAR(20);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in_ip          VARCHAR(64);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in_browser     VARCHAR(120);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_in_device      VARCHAR(120);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out_at         TIMESTAMP;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out_lat        DECIMAL(10,7);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out_lng        DECIMAL(10,7);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out_distance_m NUMERIC(8,2);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out_accuracy_m NUMERIC(8,2);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out_selfie_url TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out_status     VARCHAR(20);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out_ip         VARCHAR(64);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out_browser    VARCHAR(120);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS punch_out_device     VARCHAR(120);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS working_hours        NUMERIC(5,2);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS attendance_status    VARCHAR(20) DEFAULT 'present';
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS verification_status  VARCHAR(20) DEFAULT 'ok';

ALTER TABLE location_change_requests ADD COLUMN IF NOT EXISTS gps_accuracy_m NUMERIC(8,2);
ALTER TABLE location_change_requests ADD COLUMN IF NOT EXISTS selfie_url     TEXT;
ALTER TABLE location_change_requests ADD COLUMN IF NOT EXISTS reason         TEXT;
ALTER TABLE location_change_requests ADD COLUMN IF NOT EXISTS reject_reason  TEXT;
ALTER TABLE location_change_requests ADD COLUMN IF NOT EXISTS reviewed_by    INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE location_change_requests ADD COLUMN IF NOT EXISTS reviewed_at    TIMESTAMP;
