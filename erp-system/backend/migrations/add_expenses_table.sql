-- Expense Tracking Table
-- Run this once on the EC2 PostgreSQL database:
--   psql -U postgres -d size24 -f add_expenses_table.sql

CREATE TABLE IF NOT EXISTS expenses (
    id          SERIAL PRIMARY KEY,
    shop_id     INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    date        DATE    NOT NULL,
    amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    category    VARCHAR(50) NOT NULL DEFAULT 'General',
    note        TEXT,
    created_by  INTEGER REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_shop_id ON expenses(shop_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date    ON expenses(date);

-- Verify
SELECT 'expenses table created successfully' AS status;
