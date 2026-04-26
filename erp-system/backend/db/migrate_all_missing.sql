-- ================================================================
-- CONSOLIDATED MIGRATION — run this on any DB that started from
-- the base schema.sql without individual migration files.
-- All statements use IF NOT EXISTS / DO NOTHING so it is SAFE
-- to run multiple times.
-- ================================================================

-- ── 1. daily_entries: online (QR / Card / Bank) ──────────────────
ALTER TABLE daily_entries
    ADD COLUMN IF NOT EXISTS online DECIMAL(12, 2) DEFAULT 0;

UPDATE daily_entries SET online = COALESCE(paytm, 0) WHERE online IS NULL OR online = 0;

-- ── 2. daily_entries: approval workflow columns ───────────────────
ALTER TABLE daily_entries
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20)
        NOT NULL DEFAULT 'PENDING'
        CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));

ALTER TABLE daily_entries
    ADD COLUMN IF NOT EXISTS excel_total_sale DECIMAL(12, 2) DEFAULT 0;

ALTER TABLE daily_entries
    ADD COLUMN IF NOT EXISTS approved_by INT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE daily_entries
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

ALTER TABLE daily_entries
    ADD COLUMN IF NOT EXISTS rejection_note TEXT;

-- Backfill: locked entries are already accepted → APPROVED
UPDATE daily_entries
SET approval_status  = 'APPROVED',
    excel_total_sale = total_sale
WHERE locked = true AND approval_status = 'PENDING';

-- ── 3. users: wallet_balance ──────────────────────────────────────
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- ── 4. cash_transfers table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_transfers (
    id           SERIAL PRIMARY KEY,
    from_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount       DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    note         TEXT,
    status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT no_self_transfer CHECK (from_user_id != to_user_id)
);

-- ── 5. Indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_daily_entries_approval
    ON daily_entries(approval_status);

CREATE INDEX IF NOT EXISTS idx_daily_entries_online
    ON daily_entries(online);

CREATE INDEX IF NOT EXISTS idx_cash_transfers_from
    ON cash_transfers(from_user_id);

CREATE INDEX IF NOT EXISTS idx_cash_transfers_to
    ON cash_transfers(to_user_id);

CREATE INDEX IF NOT EXISTS idx_cash_transfers_status
    ON cash_transfers(status);

-- Done ✓
