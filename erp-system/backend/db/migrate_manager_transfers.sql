-- Migration: Manager Transfers (Manager → Admin | Manager → Bank)
-- Run via: node backend/scripts/run_migration.js backend/db/migrate_manager_transfers.sql

CREATE TABLE IF NOT EXISTS manager_transfers (
    id             SERIAL PRIMARY KEY,
    manager_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount         DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    type           VARCHAR(30) NOT NULL CHECK (type IN ('manager_to_admin', 'manager_to_bank')),
    note           TEXT,
    receipt_url    TEXT,
    status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by    INT REFERENCES users(id) ON DELETE SET NULL,
    approved_at    TIMESTAMP,
    rejection_note TEXT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_manager_transfers_manager ON manager_transfers(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_transfers_status  ON manager_transfers(status);
CREATE INDEX IF NOT EXISTS idx_manager_transfers_type    ON manager_transfers(type);
