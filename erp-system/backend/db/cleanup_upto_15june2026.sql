-- ================================================================
-- DATA CLEANUP: Delete all records up to 15 June 2026
-- and set shop + manager wallet balances to their closing values
-- as of that date.
--
-- HOW TO RUN:
--   psql $DATABASE_URL -f cleanup_upto_15june2026.sql
--   OR paste into pgAdmin and execute.
--
-- SAFE: wrapped in a transaction. If anything errors, ROLLBACK.
-- Verify results before committing (search for the COMMIT line).
-- ================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- STEP 1: Calculate closing shop wallet balances as of 2026-06-15
--         Formula: SUM(approved daily cash) - SUM(accepted cash_transfers out)
-- ────────────────────────────────────────────────────────────────
CREATE TEMP TABLE tmp_shop_balances AS
SELECT
    s.id AS shop_id,
    -- cash collected from APPROVED daily entries up to June 15
    COALESCE((
        SELECT SUM(de.cash)
        FROM daily_entries de
        WHERE de.shop_id = s.id
          AND de.approval_status = 'APPROVED'
          AND de.date <= '2026-06-15'
    ), 0)
    -- minus cash transferred OUT (accepted) up to June 15
    - COALESCE((
        SELECT SUM(ct.amount)
        FROM cash_transfers ct
        WHERE ct.shop_id = s.id
          AND ct.status = 'accepted'
          AND ct.created_at <= '2026-06-15 23:59:59'
    ), 0)
    AS closing_balance
FROM shops s;

-- ────────────────────────────────────────────────────────────────
-- STEP 2: Calculate closing manager wallet balances as of 2026-06-15
--         Credits: cash_transfers received (accepted) + admin_to_manager (approved)
--         Debits:  manager_to_admin + manager_to_bank + manager_expense (approved)
-- ────────────────────────────────────────────────────────────────
CREATE TEMP TABLE tmp_manager_balances AS
SELECT
    u.id AS manager_id,

    -- Credits: accepted transfers from shop users
    COALESCE((
        SELECT SUM(ct.amount)
        FROM cash_transfers ct
        WHERE ct.to_user_id = u.id
          AND ct.status = 'accepted'
          AND ct.created_at <= '2026-06-15 23:59:59'
    ), 0)
    -- Credits: admin_to_manager approved
    + COALESCE((
        SELECT SUM(mt.amount)
        FROM manager_transfers mt
        WHERE mt.manager_id = u.id
          AND mt.type = 'admin_to_manager'
          AND mt.status = 'approved'
          AND mt.created_at <= '2026-06-15 23:59:59'
    ), 0)
    -- Debits: manager_to_admin + manager_to_bank + manager_expense approved
    - COALESCE((
        SELECT SUM(mt.amount)
        FROM manager_transfers mt
        WHERE mt.manager_id = u.id
          AND mt.type IN ('manager_to_admin', 'manager_to_bank', 'manager_expense')
          AND mt.status = 'approved'
          AND mt.created_at <= '2026-06-15 23:59:59'
    ), 0)
    AS closing_balance

FROM users u
WHERE u.role = 'manager';

-- ────────────────────────────────────────────────────────────────
-- STEP 3: Preview — check balances before committing
--         (optional: comment out if running in automated mode)
-- ────────────────────────────────────────────────────────────────
SELECT 'SHOP BALANCES AS OF 15-JUN-2026' AS info;
SELECT s.shop_name, t.closing_balance
FROM tmp_shop_balances t
JOIN shops s ON s.id = t.shop_id
ORDER BY s.shop_name;

SELECT 'MANAGER BALANCES AS OF 15-JUN-2026' AS info;
SELECT u.name, u.mobile, t.closing_balance
FROM tmp_manager_balances t
JOIN users u ON u.id = t.manager_id
ORDER BY u.name;

-- ────────────────────────────────────────────────────────────────
-- STEP 4: Delete old data (up to and including 15 June 2026)
-- ────────────────────────────────────────────────────────────────

-- Excel uploads
DELETE FROM excel_uploads
WHERE upload_date <= '2026-06-15';

-- Manager transfers (manager→admin, manager→bank, expenses, admin→manager)
DELETE FROM manager_transfers
WHERE created_at <= '2026-06-15 23:59:59';

-- Cash transfers (shop user → manager)
DELETE FROM cash_transfers
WHERE created_at <= '2026-06-15 23:59:59';

-- Daily entries
DELETE FROM daily_entries
WHERE date <= '2026-06-15';

-- ────────────────────────────────────────────────────────────────
-- STEP 5: Update shop wallet balances to June 15 closing values
-- ────────────────────────────────────────────────────────────────
UPDATE shops s
SET wallet_balance = t.closing_balance
FROM tmp_shop_balances t
WHERE s.id = t.shop_id;

-- ────────────────────────────────────────────────────────────────
-- STEP 6: Update manager wallet balances to June 15 closing values
-- ────────────────────────────────────────────────────────────────
UPDATE users u
SET wallet_balance = t.closing_balance
FROM tmp_manager_balances t
WHERE u.id = t.manager_id;

-- ────────────────────────────────────────────────────────────────
-- STEP 7: Final verification
-- ────────────────────────────────────────────────────────────────
SELECT 'UPDATED SHOP BALANCES' AS info;
SELECT shop_name, wallet_balance FROM shops ORDER BY shop_name;

SELECT 'UPDATED MANAGER WALLETS' AS info;
SELECT name, mobile, wallet_balance FROM users WHERE role = 'manager' ORDER BY name;

SELECT 'REMAINING DAILY ENTRIES' AS info;
SELECT MIN(date) AS oldest, MAX(date) AS newest, COUNT(*) AS total_rows
FROM daily_entries;

-- ────────────────────────────────────────────────────────────────
-- IF EVERYTHING LOOKS CORRECT → run COMMIT
-- IF SOMETHING IS WRONG       → run ROLLBACK
-- ────────────────────────────────────────────────────────────────
-- COMMIT;   ← uncomment this line after verifying the preview above
-- ROLLBACK; ← uncomment this to cancel everything
