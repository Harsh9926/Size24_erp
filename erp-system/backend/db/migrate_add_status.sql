-- Migration: add status column to users table
-- Run this once against your existing database.
-- Safe to run multiple times (IF NOT EXISTS guard via DO block).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'status'
    ) THEN
        ALTER TABLE users
            ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'
            CHECK (status IN ('active', 'inactive'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
