-- Migration: Admin Bank Ledger
-- Records two types of transactions:
--   PAYMENT_IN          — submitted by shop user via Shop Dashboard
--   MANAGER_BANK_DEPOSIT — auto-recorded when admin approves manager_to_bank transfer

CREATE TABLE IF NOT EXISTS admin_bank_ledger (
    id               SERIAL PRIMARY KEY,
    transaction_type VARCHAR(30) NOT NULL
        CHECK (transaction_type IN ('PAYMENT_IN', 'MANAGER_BANK_DEPOSIT')),
    amount           DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    shop_id          INT REFERENCES shops(id) ON DELETE SET NULL,
    shop_name        VARCHAR(150),
    manager_id       INT REFERENCES users(id) ON DELETE SET NULL,
    manager_name     VARCHAR(100),
    admin_id         INT REFERENCES users(id) ON DELETE SET NULL,
    ref_id           INT,           -- manager_transfers.id for MANAGER_BANK_DEPOSIT
    remarks          TEXT,
    created_by       INT REFERENCES users(id) ON DELETE SET NULL,
    created_by_name  VARCHAR(100),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_abl_type    ON admin_bank_ledger(transaction_type);
CREATE INDEX IF NOT EXISTS idx_abl_shop    ON admin_bank_ledger(shop_id);
CREATE INDEX IF NOT EXISTS idx_abl_created ON admin_bank_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abl_admin   ON admin_bank_ledger(admin_id);
