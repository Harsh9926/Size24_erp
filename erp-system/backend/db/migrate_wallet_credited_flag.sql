-- ================================================================
-- MIGRATION: Add wallet_credited flag to daily_entries
-- Run ONCE against your PostgreSQL database.
-- ================================================================

-- 1. Add the flag column (idempotent)
ALTER TABLE daily_entries
    ADD COLUMN IF NOT EXISTS wallet_credited BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill: APPROVED entries were already credited at approval time
UPDATE daily_entries
SET wallet_credited = true
WHERE approval_status = 'APPROVED';

-- Done ✓
