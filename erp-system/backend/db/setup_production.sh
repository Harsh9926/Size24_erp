#!/bin/bash
# ============================================================
#  Size24 ERP — Production Database Migration
#  Run once on the EC2 server: bash erp-system/backend/db/setup_production.sh
#  Uses sudo -u postgres (peer auth) — no password needed for local DB.
# ============================================================
set -e

# Load DB_NAME from .env
ENV_FILE="$(dirname "$0")/../.env"
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | grep -E '^DB_' | xargs)
fi
DB="${DB_NAME:-size24}"
APP_USER="${DB_USER:-admin}"

echo "======================================================"
echo "  Size24 ERP — Database Migration"
echo "  Database : $DB"
echo "  App user : $APP_USER"
echo "======================================================"

sudo -u postgres psql -d "$DB" <<SQL

-- ── 0. Grant schema privileges to app user ──────────────────
GRANT CREATE ON SCHEMA public TO "$APP_USER";
GRANT USAGE  ON SCHEMA public TO "$APP_USER";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES    TO "$APP_USER";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO "$APP_USER";

-- ── 1. users: status column ─────────────────────────────────
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'status'
    ) THEN
        ALTER TABLE users
            ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'
            CHECK (status IN ('active', 'inactive'));
        RAISE NOTICE 'Added status column to users';
    ELSE
        RAISE NOTICE 'users.status already exists — skipped';
    END IF;
END \$\$;

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ── 2. users: wallet_balance ─────────────────────────────────
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- ── 3. daily_entries: extra columns ──────────────────────────
ALTER TABLE daily_entries
    ADD COLUMN IF NOT EXISTS online         DECIMAL(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS expense        DECIMAL(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS difference     DECIMAL(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    ADD COLUMN IF NOT EXISTS excel_total_sale DECIMAL(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS approved_by    INT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approved_at    TIMESTAMP,
    ADD COLUMN IF NOT EXISTS rejection_note TEXT,
    ADD COLUMN IF NOT EXISTS created_by     INT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by     INT REFERENCES users(id) ON DELETE SET NULL;

UPDATE daily_entries
    SET approval_status = 'APPROVED', excel_total_sale = total_sale
    WHERE locked = true AND approval_status = 'PENDING';

-- ── 4. shops: created_by ─────────────────────────────────────
ALTER TABLE shops
    ADD COLUMN IF NOT EXISTS created_by INT REFERENCES users(id) ON DELETE SET NULL;

-- ── 5. cash_transfers table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_transfers (
    id           SERIAL PRIMARY KEY,
    from_user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    to_user_id   INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount       DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    note         TEXT,
    status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT no_self_transfer CHECK (from_user_id != to_user_id)
);

-- ── 6. manager_transfers table ────────────────────────────────
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

-- ── 7. shop_users junction table ─────────────────────────────
CREATE TABLE IF NOT EXISTS shop_users (
    id          SERIAL PRIMARY KEY,
    shop_id     INT NOT NULL REFERENCES shops(id)  ON DELETE CASCADE,
    user_id     INT NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT       REFERENCES users(id)     ON DELETE SET NULL,
    UNIQUE(shop_id, user_id)
);

INSERT INTO shop_users (shop_id, user_id)
    SELECT id, user_id FROM shops WHERE user_id IS NOT NULL
    ON CONFLICT DO NOTHING;

-- ── 8. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shop_users_shop          ON shop_users(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_users_user          ON shop_users(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_entries_approval   ON daily_entries(approval_status);
CREATE INDEX IF NOT EXISTS idx_cash_transfers_from      ON cash_transfers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_cash_transfers_to        ON cash_transfers(to_user_id);
CREATE INDEX IF NOT EXISTS idx_cash_transfers_status    ON cash_transfers(status);
CREATE INDEX IF NOT EXISTS idx_manager_transfers_manager ON manager_transfers(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_transfers_status  ON manager_transfers(status);

SQL

echo ""
echo "======================================================"
echo "  Migration complete!"
echo "  Now restart the backend: pm2 restart backend"
echo "======================================================"
