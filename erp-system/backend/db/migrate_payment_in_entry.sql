-- Migration: add payment_in fields to daily_entries
ALTER TABLE daily_entries
  ADD COLUMN IF NOT EXISTS payment_in          DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_in_admin_id INT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_de_payment_in_admin
  ON daily_entries(payment_in_admin_id)
  WHERE payment_in > 0;
