-- READ-ONLY — no INSERT/UPDATE/DELETE/ALTER/DROP. Just re-runs the same
-- mismatch predicate from diagnose_total_sale_mismatch.sql, scoped to show
-- full row detail for inspection before any decision is made about fixing it.

SELECT
    de.id,
    de.shop_id,
    s.shop_name,
    de.date,
    de.created_by,
    de.approval_status,
    de.total_sale,
    COALESCE(de.cash, 0)       AS cash,
    COALESCE(de.online, 0)     AS online,
    COALESCE(de.razorpay, 0)   AS razorpay,
    COALESCE(de.cheque, 0)     AS cheque,
    COALESCE(de.payment_in, 0) AS payment_in,
    de.payment_in_admin_id,
    (COALESCE(de.cash, 0) + COALESCE(de.online, 0) + COALESCE(de.razorpay, 0)
        + COALESCE(de.cheque, 0) + COALESCE(de.payment_in, 0))   AS calculated_breakdown_total,
    (de.total_sale - (COALESCE(de.cash, 0) + COALESCE(de.online, 0) + COALESCE(de.razorpay, 0)
        + COALESCE(de.cheque, 0) + COALESCE(de.payment_in, 0))) AS difference,
    de.created_at,
    de.excel_total_sale
FROM daily_entries de
LEFT JOIN shops s ON s.id = de.shop_id
WHERE de.approval_status = 'APPROVED'
  AND de.total_sale IS DISTINCT FROM
      (COALESCE(de.cash, 0) + COALESCE(de.online, 0) + COALESCE(de.razorpay, 0)
        + COALESCE(de.cheque, 0) + COALESCE(de.payment_in, 0));
