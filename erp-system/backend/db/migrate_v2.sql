-- ================================================================
-- Migration v2: manager_transfers table + to_admin_id column
-- SAFE to run multiple times (IF NOT EXISTS / IF EXISTS guards).
-- Run via: node backend/scripts/run_migration.js migrate_v2.sql
-- ================================================================

-- ── 1. Create manager_transfers table ────────────────────────────
CREATE TABLE IF NOT EXISTS manager_transfers (
    id             SERIAL PRIMARY KEY,
    manager_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount         DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    type           VARCHAR(30) NOT NULL CHECK (type IN ('manager_to_admin', 'manager_to_bank')),
    note           TEXT,
    receipt_url    TEXT,
    status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by    INT REFERENCES users(id) ON DELETE SET NULL,
    approved_at    TIMESTAMP,
    rejection_note TEXT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 2. Add to_admin_id (which admin the manager is sending to) ───
ALTER TABLE manager_transfers
    ADD COLUMN IF NOT EXISTS to_admin_id INT REFERENCES users(id) ON DELETE SET NULL;

-- ── 3. Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_manager_transfers_manager  ON manager_transfers(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_transfers_status   ON manager_transfers(status);
CREATE INDEX IF NOT EXISTS idx_manager_transfers_type     ON manager_transfers(type);
CREATE INDEX IF NOT EXISTS idx_manager_transfers_admin    ON manager_transfers(to_admin_id);

-- ── 4. Allow 'approved' status in cash_transfers ─────────────────
-- Drop the old CHECK constraint (auto-named by Postgres) then re-add with 'approved' included.
DO $$
BEGIN
    -- Drop any existing status check on cash_transfers
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'cash_transfers'::regclass
          AND contype  = 'c'
          AND conname  LIKE '%status%'
    ) THEN
        EXECUTE (
            SELECT 'ALTER TABLE cash_transfers DROP CONSTRAINT ' || conname
            FROM pg_constraint
            WHERE conrelid = 'cash_transfers'::regclass
              AND contype  = 'c'
              AND conname  LIKE '%status%'
            LIMIT 1
        );
    END IF;
END$$;

ALTER TABLE cash_transfers
    ADD CONSTRAINT cash_transfers_status_check
        CHECK (status IN ('pending', 'accepted', 'approved', 'rejected'));

-- Done ✓
