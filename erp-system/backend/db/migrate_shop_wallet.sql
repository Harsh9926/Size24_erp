-- ================================================================
-- MIGRATION: Move wallet from users to shops
-- Run ONCE on PostgreSQL database.
--
-- Changes:
--   1. Add shops.wallet_balance column
--   2. Add cash_transfers.shop_id column
--   3. Backfill shop_id on existing transfers
--   4. Calculate initial shop wallet balances
-- ================================================================

-- 1. Add wallet_balance to shops table
ALTER TABLE shops
    ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(12,2) NOT NULL DEFAULT 0;

-- 2. Add shop_id to cash_transfers
ALTER TABLE cash_transfers
    ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id);

-- 3. Backfill shop_id on existing transfers using sender's first assigned shop
UPDATE cash_transfers ct
SET shop_id = (
    SELECT su.shop_id
    FROM shop_users su
    WHERE su.user_id = ct.from_user_id
    ORDER BY su.assigned_at ASC
    LIMIT 1
)
WHERE ct.shop_id IS NULL;

-- 4. Calculate initial shop wallet balances
--    credits = SUM(cash from APPROVED daily_entries)
--    debits  = SUM(amount from accepted/approved transfers out of this shop)
UPDATE shops s
SET wallet_balance = COALESCE((
    SELECT SUM(de.cash)
    FROM daily_entries de
    WHERE de.shop_id = s.id
      AND de.approval_status = 'APPROVED'
), 0)
- COALESCE((
    SELECT SUM(ct.amount)
    FROM cash_transfers ct
    WHERE ct.shop_id = s.id
      AND ct.status IN ('accepted', 'approved')
), 0);

-- Done ✓
-- Verify with:
-- SELECT id, shop_name, wallet_balance FROM shops;
