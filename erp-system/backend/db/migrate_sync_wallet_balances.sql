-- ================================================================
-- MIGRATION: Sync wallet_balance for all shop users
-- Run ONCE to fix wallets that were never credited because the
-- migrate_wallet_credited_flag.sql backfill set wallet_credited=true
-- for historical APPROVED entries without actually crediting the
-- users.wallet_balance column.
--
-- Formula (derived, not stored):
--   credits = SUM(cash) from entries where:
--               approval_status = 'APPROVED'
--               OR (approval_status = 'PENDING' AND wallet_credited = true)
--   debits  = SUM(amount) from accepted/approved outgoing cash_transfers
--   result  = credits - debits
--
-- This is idempotent — safe to run multiple times.
-- ================================================================

UPDATE users u
SET wallet_balance = COALESCE((
    SELECT SUM(de.cash)
    FROM daily_entries de
    JOIN shops s ON s.id = de.shop_id
    WHERE s.user_id = u.id
      AND de.approval_status = 'APPROVED'
), 0)
- COALESCE((
    SELECT SUM(ct.amount)
    FROM cash_transfers ct
    WHERE ct.from_user_id = u.id
      AND ct.status IN ('accepted', 'approved')
), 0)
WHERE u.role = 'shop_user';

-- Done ✓
-- Verify with:
-- SELECT u.id, u.name, u.wallet_balance FROM users u WHERE u.role = 'shop_user';
