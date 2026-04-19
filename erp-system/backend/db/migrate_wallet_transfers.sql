-- ================================================================
-- MIGRATION: Wallet Balance + Cash Transfer System
-- Run ONCE against your PostgreSQL database.
-- ================================================================

-- 1. Add wallet_balance to users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- 2. Cash transfers table
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

-- 3. Indexes for fast role-scoped queries
CREATE INDEX IF NOT EXISTS idx_cash_transfers_from   ON cash_transfers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_cash_transfers_to     ON cash_transfers(to_user_id);
CREATE INDEX IF NOT EXISTS idx_cash_transfers_status ON cash_transfers(status);

-- Done ✓
