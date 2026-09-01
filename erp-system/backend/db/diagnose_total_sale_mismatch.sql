-- READ-ONLY diagnostic — no INSERT/UPDATE/DELETE/ALTER/DROP anywhere in this file.
-- Finds daily_entries rows where total_sale doesn't equal the sum of its own
-- payment-breakdown columns (cash + online + razorpay + cheque + payment_in),
-- which the app itself is supposed to guarantee (entryController.js validates
-- this for shop-user submissions, but NOT for admin-created entries — see
-- entryController.js:69, `if (!isAdmin && ...)`).

-- ── 0. Confirm actual columns before trusting anything below ─────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'daily_entries'
ORDER BY ordinal_position;

-- ── 1. Every mismatched entry, with the exact difference ─────────────
SELECT
    de.id,
    de.shop_id,
    de.date,
    de.created_by,
    de.total_sale,
    COALESCE(de.cash, 0)      AS cash,
    COALESCE(de.online, 0)    AS online,
    COALESCE(de.razorpay, 0)  AS razorpay,
    COALESCE(de.cheque, 0)    AS cheque,
    COALESCE(de.payment_in, 0) AS payment_in,
    (COALESCE(de.cash, 0) + COALESCE(de.online, 0) + COALESCE(de.razorpay, 0)
        + COALESCE(de.cheque, 0) + COALESCE(de.payment_in, 0))            AS calculated_breakdown_total,
    (de.total_sale - (COALESCE(de.cash, 0) + COALESCE(de.online, 0) + COALESCE(de.razorpay, 0)
        + COALESCE(de.cheque, 0) + COALESCE(de.payment_in, 0)))          AS difference
FROM daily_entries de
WHERE de.approval_status = 'APPROVED'  -- matches what the dashboard/Payment Breakdown actually sum
  AND de.total_sale IS DISTINCT FROM
      (COALESCE(de.cash, 0) + COALESCE(de.online, 0) + COALESCE(de.razorpay, 0)
        + COALESCE(de.cheque, 0) + COALESCE(de.payment_in, 0))
ORDER BY ABS(de.total_sale - (COALESCE(de.cash, 0) + COALESCE(de.online, 0) + COALESCE(de.razorpay, 0)
        + COALESCE(de.cheque, 0) + COALESCE(de.payment_in, 0))) DESC;

-- ── 2. Summary ─────────────────────────────────────────────────────
SELECT
    COUNT(*) FILTER (
        WHERE de.total_sale IS DISTINCT FROM
              (COALESCE(de.cash, 0) + COALESCE(de.online, 0) + COALESCE(de.razorpay, 0)
                + COALESCE(de.cheque, 0) + COALESCE(de.payment_in, 0))
    )                                                                     AS mismatched_entry_count,
    COALESCE(SUM(de.total_sale - (COALESCE(de.cash, 0) + COALESCE(de.online, 0) + COALESCE(de.razorpay, 0)
        + COALESCE(de.cheque, 0) + COALESCE(de.payment_in, 0))) FILTER (
        WHERE de.total_sale IS DISTINCT FROM
              (COALESCE(de.cash, 0) + COALESCE(de.online, 0) + COALESCE(de.razorpay, 0)
                + COALESCE(de.cheque, 0) + COALESCE(de.payment_in, 0))
    ), 0)                                                                 AS sum_of_differences,
    COALESCE(SUM(de.total_sale), 0)                                       AS total_sale_aggregate,
    COALESCE(SUM(COALESCE(de.cash, 0) + COALESCE(de.online, 0) + COALESCE(de.razorpay, 0)
        + COALESCE(de.cheque, 0)), 0)                                     AS payment_breakdown_aggregate_excl_payment_in,
    COALESCE(SUM(COALESCE(de.payment_in, 0)), 0)                          AS payment_in_aggregate
FROM daily_entries de
WHERE de.approval_status = 'APPROVED';
