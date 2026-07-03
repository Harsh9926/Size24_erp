-- ═══════════════════════════════════════════════════════════════
-- SIZE24 ERP — Billing & POS Schema Extension
-- Extends inv_customers with loyalty, adds challan & discount tables
-- ═══════════════════════════════════════════════════════════════

-- ── Loyalty points column on customers ───────────────────────────
ALTER TABLE inv_customers ADD COLUMN IF NOT EXISTS loyalty_points INT DEFAULT 0;
ALTER TABLE inv_customers ADD COLUMN IF NOT EXISTS email VARCHAR(100);

-- ── Loyalty transactions log ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_loyalty_transactions (
    id           SERIAL PRIMARY KEY,
    customer_id  INT NOT NULL REFERENCES inv_customers(id) ON DELETE CASCADE,
    invoice_id   INT REFERENCES inv_sales_invoices(id) ON DELETE SET NULL,
    type         VARCHAR(20) NOT NULL CHECK (type IN ('earn','redeem','expire','adjust')),
    points       INT NOT NULL,
    balance_after INT NOT NULL,
    note         TEXT,
    created_by   INT REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Delivery Challans ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_delivery_challans (
    id              SERIAL PRIMARY KEY,
    challan_number  VARCHAR(50) UNIQUE NOT NULL,
    invoice_id      INT REFERENCES inv_sales_invoices(id) ON DELETE SET NULL,
    customer_id     INT REFERENCES inv_customers(id) ON DELETE SET NULL,
    challan_date    DATE NOT NULL,
    dispatch_date   DATE,
    courier_name    VARCHAR(100),
    tracking_number VARCHAR(100),
    status          VARCHAR(20) DEFAULT 'pending'
                      CHECK (status IN ('pending','dispatched','delivered','cancelled')),
    notes           TEXT,
    created_by      INT REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── POS Session (cash register tracking) ─────────────────────────
CREATE TABLE IF NOT EXISTS pos_sessions (
    id             SERIAL PRIMARY KEY,
    opened_by      INT REFERENCES users(id) ON DELETE SET NULL,
    opening_cash   DECIMAL(12,2) DEFAULT 0,
    closing_cash   DECIMAL(12,2),
    opened_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at      TIMESTAMP,
    status         VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','closed'))
);

-- ── Invoice payment mode column (quick lookup) ────────────────────
ALTER TABLE inv_sales_invoices ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(30);

-- ── Counters for new sequences ────────────────────────────────────
INSERT INTO inv_counters (key, value) VALUES ('delivery_challan', 0) ON CONFLICT DO NOTHING;

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pos_loyalty_customer ON pos_loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_pos_loyalty_invoice  ON pos_loyalty_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_pos_challan_invoice  ON pos_delivery_challans(invoice_id);
CREATE INDEX IF NOT EXISTS idx_pos_challan_customer ON pos_delivery_challans(customer_id);
CREATE INDEX IF NOT EXISTS idx_inv_customers_mobile ON inv_customers(mobile);
CREATE INDEX IF NOT EXISTS idx_inv_customers_name   ON inv_customers(name);
