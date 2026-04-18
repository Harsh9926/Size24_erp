-- ============================================================
-- MIGRATION: Rename paytm → online, drop expense & difference
-- Run this once against your PostgreSQL database.
-- ============================================================

-- 1. Add the new `online` column (QR / Card / Bank)
ALTER TABLE daily_entries
    ADD COLUMN IF NOT EXISTS online DECIMAL(12, 2) DEFAULT 0;

-- 2. Copy existing paytm data into online (preserves legacy data)
UPDATE daily_entries SET online = COALESCE(paytm, 0) WHERE online = 0;

-- 3. Recalculate total_sale from the new formula: cash + online + razorpay
--    (removes expense from the equation)
UPDATE daily_entries
SET total_sale = COALESCE(cash, 0) + COALESCE(online, 0) + COALESCE(razorpay, 0);

-- NOTE: We intentionally KEEP the old `paytm`, `expense`, and `difference`
-- columns so that existing data / admin dashboards are not broken.
-- The application now reads `online` for new entries.
-- Old rows that still have paytm will fall back to it via COALESCE in the API.

-- 4. (Optional) Create an index on the new column if needed
CREATE INDEX IF NOT EXISTS idx_daily_entries_online ON daily_entries(online);
