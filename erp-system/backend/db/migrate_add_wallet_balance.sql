-- ================================================================
-- MIGRATION: Add wallet_balance to users table
-- Safe to run even if column already exists (uses IF NOT EXISTS).
-- Run this once against your PostgreSQL database.
-- ================================================================

-- Step 1: Add column (idempotent)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Step 2: Zero out any NULLs that slipped through (safety net)
UPDATE users
    SET wallet_balance = 0
    WHERE wallet_balance IS NULL;

-- Done ✓
