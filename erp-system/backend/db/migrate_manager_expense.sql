-- Migration: Add manager_expense type to manager_transfers
-- Run on the server: psql $DATABASE_URL -f this_file.sql

ALTER TABLE manager_transfers
DROP CONSTRAINT IF EXISTS manager_transfers_type_check;

ALTER TABLE manager_transfers
ADD CONSTRAINT manager_transfers_type_check
CHECK (type IN ('manager_to_admin', 'manager_to_bank', 'manager_expense'));

ALTER TABLE manager_transfers
ADD COLUMN IF NOT EXISTS category VARCHAR(50);
