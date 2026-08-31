-- ============================================================
-- MIGRATION: Add `cheque` payment mode to daily_entries
-- Run this once against your PostgreSQL database.
-- ============================================================

-- 1. Add the new `cheque` column
ALTER TABLE daily_entries
    ADD COLUMN IF NOT EXISTS cheque DECIMAL(12, 2) DEFAULT 0;

-- 2. Recalculate total_sale to include cheque: cash + online + razorpay + cheque
UPDATE daily_entries
SET total_sale = COALESCE(cash, 0) + COALESCE(online, 0) + COALESCE(razorpay, 0) + COALESCE(cheque, 0);

-- 3. (Optional) Create an index on the new column if needed
CREATE INDEX IF NOT EXISTS idx_daily_entries_cheque ON daily_entries(cheque);
