-- Migration: multi-user shop support + data attribution + safer FK constraints
-- Safe to run multiple times (idempotent guards throughout).
-- Run: psql -U postgres -d erp_db -f backend/db/migrate_multiuser_shops.sql

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- 1. shop_users junction table (many-to-many: users ↔ shops)
--    ON DELETE CASCADE for shop_id: removing a shop cleans up assignments
--    ON DELETE RESTRICT for user_id: safety net (soft-delete means this rarely fires)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_users (
    id          SERIAL PRIMARY KEY,
    shop_id     INT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(shop_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_users_shop ON shop_users(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_users_user ON shop_users(user_id);

-- ─────────────────────────────────────────────────────────────────
-- 2. Seed junction table from existing shops.user_id assignments
--    (zero data loss — existing one-to-one mapping becomes first row per shop)
-- ─────────────────────────────────────────────────────────────────
INSERT INTO shop_users (shop_id, user_id)
SELECT id, user_id FROM shops WHERE user_id IS NOT NULL
ON CONFLICT (shop_id, user_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- 3. Data attribution columns
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE shops
    ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE daily_entries
    ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by INT REFERENCES users(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────
-- 4. Fix dangerous ON DELETE CASCADE on cash_transfers → RESTRICT
--    Prevents transfers from silently vanishing if a user is ever hard-deleted.
--    Soft-delete means this guard rarely fires, but it protects against accidents.
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
    -- from_user_id
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'cash_transfers_from_user_id_fkey'
    ) THEN
        ALTER TABLE cash_transfers DROP CONSTRAINT cash_transfers_from_user_id_fkey;
    END IF;
    ALTER TABLE cash_transfers ADD CONSTRAINT cash_transfers_from_user_id_fkey
        FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE RESTRICT;

    -- to_user_id
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'cash_transfers_to_user_id_fkey'
    ) THEN
        ALTER TABLE cash_transfers DROP CONSTRAINT cash_transfers_to_user_id_fkey;
    END IF;
    ALTER TABLE cash_transfers ADD CONSTRAINT cash_transfers_to_user_id_fkey
        FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE RESTRICT;
END $$;

COMMIT;
