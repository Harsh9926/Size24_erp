-- Add admin_to_manager to allowed transfer types
ALTER TABLE manager_transfers DROP CONSTRAINT IF EXISTS manager_transfers_type_check;
ALTER TABLE manager_transfers ADD CONSTRAINT manager_transfers_type_check
    CHECK (type IN ('manager_to_admin', 'manager_to_bank', 'manager_expense', 'admin_to_manager'));
