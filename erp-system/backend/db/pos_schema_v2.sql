-- ═══════════════════════════════════════════════════════════════
-- SIZE24 ERP — Billing & POS Phase 2 Schema
-- Exchange billing, advances, offers, warehouse stock,
-- product batches, cash counter, customer pricing
-- ═══════════════════════════════════════════════════════════════

-- ── Customer credit limit ──────────────────────────────────────────
ALTER TABLE inv_customers ADD COLUMN IF NOT EXISTS credit_limit    DECIMAL(12,2) DEFAULT 0;
ALTER TABLE inv_customers ADD COLUMN IF NOT EXISTS credit_days     INT DEFAULT 0;

-- ── Invoice: exchange + advance columns ───────────────────────────
ALTER TABLE inv_sales_invoices ADD COLUMN IF NOT EXISTS exchange_amount   DECIMAL(12,2) DEFAULT 0;
ALTER TABLE inv_sales_invoices ADD COLUMN IF NOT EXISTS advance_adjusted  DECIMAL(12,2) DEFAULT 0;
ALTER TABLE inv_sales_invoices ADD COLUMN IF NOT EXISTS warehouse_id      INT REFERENCES rm_warehouses(id) ON DELETE SET NULL;
ALTER TABLE inv_sales_invoices ADD COLUMN IF NOT EXISTS invoice_type      VARCHAR(20) DEFAULT 'sale'
    CHECK (invoice_type IN ('sale','exchange','credit'));

-- ── Invoice items: warehouse + batch columns ──────────────────────
ALTER TABLE inv_sales_invoice_items ADD COLUMN IF NOT EXISTS warehouse_id INT REFERENCES rm_warehouses(id) ON DELETE SET NULL;
ALTER TABLE inv_sales_invoice_items ADD COLUMN IF NOT EXISTS batch_id     INT;
ALTER TABLE inv_sales_invoice_items ADD COLUMN IF NOT EXISTS lot_number   VARCHAR(100);

-- ── Exchange Items (items returned as part of an exchange bill) ────
CREATE TABLE IF NOT EXISTS pos_exchange_items (
    id                  SERIAL PRIMARY KEY,
    invoice_id          INT NOT NULL REFERENCES inv_sales_invoices(id) ON DELETE CASCADE,
    variant_id          INT NOT NULL REFERENCES inv_variants(id),
    qty                 DECIMAL(12,3) NOT NULL,
    unit_price          DECIMAL(12,2) NOT NULL,
    total_price         DECIMAL(12,2) NOT NULL,
    original_invoice_id INT REFERENCES inv_sales_invoices(id) ON DELETE SET NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Customer Advances ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_advances (
    id               SERIAL PRIMARY KEY,
    customer_id      INT NOT NULL REFERENCES inv_customers(id) ON DELETE CASCADE,
    amount           DECIMAL(12,2) NOT NULL,
    adjusted_amount  DECIMAL(12,2) DEFAULT 0,
    balance          DECIMAL(12,2) GENERATED ALWAYS AS (amount - adjusted_amount) STORED,
    received_date    DATE NOT NULL,
    payment_mode     VARCHAR(30) DEFAULT 'cash',
    reference        VARCHAR(100),
    notes            TEXT,
    created_by       INT REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pos_advance_adjustments (
    id          SERIAL PRIMARY KEY,
    advance_id  INT NOT NULL REFERENCES pos_advances(id) ON DELETE CASCADE,
    invoice_id  INT REFERENCES inv_sales_invoices(id) ON DELETE SET NULL,
    amount      DECIMAL(12,2) NOT NULL,
    adjusted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by  INT REFERENCES users(id) ON DELETE SET NULL
);

-- ── Offers & Promotions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_offers (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    type            VARCHAR(30) NOT NULL
                      CHECK (type IN ('buy_x_get_y','combo','bulk_discount','percentage','flat','school_contract','wholesale','customer_specific')),
    is_active       BOOLEAN DEFAULT true,
    start_date      DATE,
    end_date        DATE,
    -- Buy X Get Y
    buy_product_id  INT REFERENCES inv_products(id) ON DELETE CASCADE,
    buy_qty         DECIMAL(12,3) DEFAULT 0,
    get_product_id  INT REFERENCES inv_products(id) ON DELETE SET NULL,
    get_qty         DECIMAL(12,3) DEFAULT 0,
    -- Bulk / threshold
    min_qty         DECIMAL(12,3) DEFAULT 0,
    min_amount      DECIMAL(12,2) DEFAULT 0,
    -- Discount
    discount_type   VARCHAR(20) CHECK (discount_type IN ('percentage','flat','free_item')),
    discount_value  DECIMAL(12,4) DEFAULT 0,
    -- Scope filters (null = applies to all)
    school_id       INT REFERENCES inv_schools(id) ON DELETE SET NULL,
    customer_id     INT REFERENCES inv_customers(id) ON DELETE SET NULL,
    category_id     INT REFERENCES inv_categories(id) ON DELETE SET NULL,
    product_id      INT REFERENCES inv_products(id) ON DELETE SET NULL,
    created_by      INT REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Customer / School Custom Pricing ──────────────────────────────
CREATE TABLE IF NOT EXISTS pos_customer_pricing (
    id           SERIAL PRIMARY KEY,
    customer_id  INT REFERENCES inv_customers(id) ON DELETE CASCADE,
    school_id    INT REFERENCES inv_schools(id) ON DELETE CASCADE,
    variant_id   INT REFERENCES inv_variants(id) ON DELETE CASCADE,
    product_id   INT REFERENCES inv_products(id) ON DELETE CASCADE,
    price_type   VARCHAR(30) NOT NULL
                   CHECK (price_type IN ('fixed','percentage_off','wholesale','school_contract','bulk')),
    fixed_price  DECIMAL(12,2),
    discount_pct DECIMAL(5,2),
    min_qty      DECIMAL(12,3) DEFAULT 1,
    is_active    BOOLEAN DEFAULT true,
    notes        TEXT,
    created_by   INT REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- At least one scope required
    CONSTRAINT cp_scope CHECK (customer_id IS NOT NULL OR school_id IS NOT NULL)
);

-- ── Per-Warehouse Stock ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_warehouse_stock (
    id           SERIAL PRIMARY KEY,
    variant_id   INT NOT NULL REFERENCES inv_variants(id) ON DELETE CASCADE,
    warehouse_id INT NOT NULL REFERENCES rm_warehouses(id) ON DELETE CASCADE,
    qty          DECIMAL(12,3) DEFAULT 0,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(variant_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS pos_warehouse_ledger (
    id           SERIAL PRIMARY KEY,
    variant_id   INT NOT NULL REFERENCES inv_variants(id) ON DELETE CASCADE,
    warehouse_id INT NOT NULL REFERENCES rm_warehouses(id) ON DELETE CASCADE,
    txn_type     VARCHAR(30) NOT NULL,
    qty_change   DECIMAL(12,3) NOT NULL,
    qty_after    DECIMAL(12,3) NOT NULL,
    ref_type     VARCHAR(30),
    ref_id       INT,
    note         TEXT,
    created_by   INT REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Product Batches (finished goods lot tracking) ──────────────────
CREATE TABLE IF NOT EXISTS pos_product_batches (
    id           SERIAL PRIMARY KEY,
    variant_id   INT NOT NULL REFERENCES inv_variants(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) NOT NULL,
    lot_number   VARCHAR(100),
    mfg_date     DATE,
    exp_date     DATE,
    qty          DECIMAL(12,3) DEFAULT 0,
    used_qty     DECIMAL(12,3) DEFAULT 0,
    cost_price   DECIMAL(12,2),
    warehouse_id INT REFERENCES rm_warehouses(id) ON DELETE SET NULL,
    notes        TEXT,
    is_active    BOOLEAN DEFAULT true,
    created_by   INT REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Cash Counter Sessions ──────────────────────────────────────────
ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS closed_by     INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS expected_cash DECIMAL(12,2);
ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS physical_cash DECIMAL(12,2);
ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS difference    DECIMAL(12,2);
ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS warehouse_id  INT REFERENCES rm_warehouses(id) ON DELETE SET NULL;
ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS notes         TEXT;
ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS total_sales   DECIMAL(12,2) DEFAULT 0;
ALTER TABLE pos_sessions ADD COLUMN IF NOT EXISTS total_orders  INT DEFAULT 0;

-- ── Cash Movements (Cash In / Cash Out during shift) ──────────────
CREATE TABLE IF NOT EXISTS pos_cash_movements (
    id         SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES pos_sessions(id) ON DELETE CASCADE,
    type       VARCHAR(20) NOT NULL CHECK (type IN ('cash_in','cash_out','opening','closing')),
    amount     DECIMAL(12,2) NOT NULL,
    reason     TEXT,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Counters for Phase 2 ──────────────────────────────────────────
INSERT INTO inv_counters (key, value) VALUES
    ('advance', 0),
    ('offer',   0),
    ('batch',   0)
ON CONFLICT DO NOTHING;

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pos_advances_customer     ON pos_advances(customer_id);
CREATE INDEX IF NOT EXISTS idx_pos_adv_adj_advance       ON pos_advance_adjustments(advance_id);
CREATE INDEX IF NOT EXISTS idx_pos_offers_active         ON pos_offers(is_active);
CREATE INDEX IF NOT EXISTS idx_pos_cust_pricing_customer ON pos_customer_pricing(customer_id);
CREATE INDEX IF NOT EXISTS idx_pos_cust_pricing_school   ON pos_customer_pricing(school_id);
CREATE INDEX IF NOT EXISTS idx_pos_wh_stock_variant      ON pos_warehouse_stock(variant_id);
CREATE INDEX IF NOT EXISTS idx_pos_wh_stock_warehouse    ON pos_warehouse_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_pos_wh_ledger_variant     ON pos_warehouse_ledger(variant_id);
CREATE INDEX IF NOT EXISTS idx_pos_batches_variant       ON pos_product_batches(variant_id);
CREATE INDEX IF NOT EXISTS idx_pos_exchange_invoice      ON pos_exchange_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_pos_cash_movements        ON pos_cash_movements(session_id);
CREATE INDEX IF NOT EXISTS idx_inv_sales_inv_type        ON inv_sales_invoices(invoice_type);
