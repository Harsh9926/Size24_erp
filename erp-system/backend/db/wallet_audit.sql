-- ── Wallet Audit: Camp & School Supply shops ──────────────────────────
-- Run on production DB to trace where wallet cash went.

-- 1. Show current wallet balance for all shops
SELECT id, shop_name, wallet_balance
FROM shops
ORDER BY shop_name;

-- 2. Show all entries for a specific shop with wallet impact
-- Replace 'Camp' with the actual shop name or use shop id
SELECT
    de.id,
    de.date,
    de.approval_status,
    de.cash,
    de.wallet_credited,
    u.name AS submitted_by,
    de.created_at
FROM daily_entries de
JOIN shops s ON s.id = de.shop_id
LEFT JOIN users u ON u.id = de.created_by
WHERE s.shop_name ILIKE '%camp%' OR s.shop_name ILIKE '%school%'
ORDER BY de.date DESC;

-- 3. Check cash_flows (manual deposit/expense entries) for these shops
SELECT cf.*, s.shop_name
FROM cash_flows cf
JOIN shops s ON s.id = cf.shop_id
WHERE s.shop_name ILIKE '%camp%' OR s.shop_name ILIKE '%school%'
ORDER BY cf.date DESC;

-- 4. Check manager transfer records (shop_id linked transfers if any)
-- Look for wallet deductions via manager transfer system
SELECT mt.*, s.shop_name,
       u.name AS from_user
FROM manager_transfers mt
LEFT JOIN shops s ON s.id = mt.shop_id
LEFT JOIN users u ON u.id = mt.from_user_id
WHERE s.shop_name ILIKE '%camp%' OR s.shop_name ILIKE '%school%'
ORDER BY mt.created_at DESC;

-- 5. Net expected wallet = SUM of approved/pending cash credits - rejected reversals
SELECT
    s.shop_name,
    s.wallet_balance AS current_balance,
    COALESCE(SUM(CASE WHEN de.wallet_credited = true
                       AND de.approval_status != 'REJECTED'
                  THEN de.cash ELSE 0 END), 0) AS expected_balance,
    s.wallet_balance - COALESCE(SUM(CASE WHEN de.wallet_credited = true
                                          AND de.approval_status != 'REJECTED'
                                     THEN de.cash ELSE 0 END), 0) AS discrepancy
FROM shops s
LEFT JOIN daily_entries de ON de.shop_id = s.id
WHERE s.shop_name ILIKE '%camp%' OR s.shop_name ILIKE '%school%'
GROUP BY s.id, s.shop_name, s.wallet_balance;
