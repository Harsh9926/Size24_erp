-- Add entry_type to daily_entries: 'normal' | 'no_sale'
ALTER TABLE daily_entries
    ADD COLUMN IF NOT EXISTS entry_type VARCHAR(20) NOT NULL DEFAULT 'normal';

ALTER TABLE daily_entries
    DROP CONSTRAINT IF EXISTS daily_entries_entry_type_check;

ALTER TABLE daily_entries
    ADD CONSTRAINT daily_entries_entry_type_check
    CHECK (entry_type IN ('normal', 'no_sale'));

CREATE INDEX IF NOT EXISTS idx_daily_entries_entry_type ON daily_entries(entry_type);
