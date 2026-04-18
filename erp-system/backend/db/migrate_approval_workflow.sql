-- ================================================================
-- MIGRATION: Admin Approval Workflow
-- Run ONCE against your PostgreSQL database.
-- ================================================================

-- 1. Approval status lifecycle: PENDING → APPROVED or REJECTED
ALTER TABLE daily_entries
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20)
        NOT NULL DEFAULT 'PENDING'
        CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));

-- 2. The Total Sale locked from Excel (immutable after upload)
ALTER TABLE daily_entries
    ADD COLUMN IF NOT EXISTS excel_total_sale DECIMAL(12, 2) DEFAULT 0;

-- 3. Who approved/rejected + when
ALTER TABLE daily_entries
    ADD COLUMN IF NOT EXISTS approved_by INT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE daily_entries
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- 4. Optional admin note on rejection
ALTER TABLE daily_entries
    ADD COLUMN IF NOT EXISTS rejection_note TEXT;

-- 5. Backfill existing rows so they don't get stuck as PENDING
--    Existing "locked" entries are already accepted — mark as APPROVED
UPDATE daily_entries
SET approval_status = 'APPROVED',
    excel_total_sale = total_sale
WHERE approval_status = 'PENDING';

-- 6. Index for fast pending queries
CREATE INDEX IF NOT EXISTS idx_daily_entries_approval
    ON daily_entries(approval_status);

-- Done ✓
