-- ═══════════════════════════════════════════════════════════════
-- SIZE24 ERP — Inventory / Purchase / Sales / Accounting Schema
-- All tables prefixed inv_ to avoid conflicts with existing tables
-- ═══════════════════════════════════════════════════════════════

-- ── Schools (uniform buyers — different from shops in existing system) ──
CREATE TABLE IF NOT EXISTS inv_schools (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(150) NOT NULL,
    code       VARCHAR(20),
    address    TEXT,
    contact    VARCHAR(15),
    is_active  BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Product Categories ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_categories (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    parent_id  INT REFERENCES inv_categories(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Products (Item Master) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_products (
    id                   SERIAL PRIMARY KEY,
    name                 VARCHAR(200) NOT NULL,
    category_id          INT REFERENCES inv_categories(id) ON DELETE SET NULL,
    article_code         VARCHAR(50),
    description          TEXT,
    unit                 VARCHAR(20) DEFAULT 'pcs',
    gst_rate             DECIMAL(5,2) DEFAULT 0,
    hsn_code             VARCHAR(20),
    min_stock            INT DEFAULT 0,
    sale_price           DECIMAL(12,2),
    purchase_price       DECIMAL(12,2),
    disc_on_sale         DECIMAL(12,2) DEFAULT 0,
    sale_price_with_tax  BOOLEAN DEFAULT true,
    is_active            BOOLEAN DEFAULT true,
    created_by           INT REFERENCES users(id) ON DELETE SET NULL,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- add pricing columns to existing installs
ALTER TABLE inv_products ADD COLUMN IF NOT EXISTS sale_price          DECIMAL(12,2);
ALTER TABLE inv_products ADD COLUMN IF NOT EXISTS purchase_price      DECIMAL(12,2);
ALTER TABLE inv_products ADD COLUMN IF NOT EXISTS disc_on_sale        DECIMAL(12,2) DEFAULT 0;
ALTER TABLE inv_products ADD COLUMN IF NOT EXISTS sale_price_with_tax BOOLEAN DEFAULT true;

-- ── Product Variants (product × school × size × color) ───────────────
CREATE TABLE IF NOT EXISTS inv_variants (
    id             SERIAL PRIMARY KEY,
    product_id     INT NOT NULL REFERENCES inv_products(id) ON DELETE CASCADE,
    school_id      INT REFERENCES inv_schools(id) ON DELETE SET NULL,
    size           VARCHAR(20),
    color          VARCHAR(50),
    sku            VARCHAR(100) UNIQUE,
    barcode        VARCHAR(100) UNIQUE,
    purchase_price DECIMAL(12,2) DEFAULT 0,
    sale_price     DECIMAL(12,2) DEFAULT 0,
    mrp            DECIMAL(12,2) DEFAULT 0,
    is_active      BOOLEAN DEFAULT true,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Stock (current qty per variant) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_stock (
    id         SERIAL PRIMARY KEY,
    variant_id INT NOT NULL UNIQUE REFERENCES inv_variants(id) ON DELETE CASCADE,
    qty        DECIMAL(12,3) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Stock Ledger (every movement) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_stock_ledger (
    id         SERIAL PRIMARY KEY,
    variant_id INT NOT NULL REFERENCES inv_variants(id) ON DELETE CASCADE,
    txn_type   VARCHAR(30) NOT NULL
                 CHECK (txn_type IN ('purchase','sale','purchase_return','sale_return','adjustment','opening')),
    qty_change DECIMAL(12,3) NOT NULL,
    qty_after  DECIMAL(12,3) NOT NULL,
    ref_type   VARCHAR(30),
    ref_id     INT,
    note       TEXT,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── School → Product Mapping ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_school_products (
    id           SERIAL PRIMARY KEY,
    school_id    INT NOT NULL REFERENCES inv_schools(id) ON DELETE CASCADE,
    product_id   INT NOT NULL REFERENCES inv_products(id) ON DELETE CASCADE,
    is_mandatory BOOLEAN DEFAULT true,
    UNIQUE(school_id, product_id)
);

-- ── Suppliers ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_suppliers (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    gst_number      VARCHAR(20),
    mobile          VARCHAR(15),
    email           VARCHAR(100),
    address         TEXT,
    credit_days     INT DEFAULT 0,
    credit_limit    DECIMAL(12,2) DEFAULT 0,
    opening_balance DECIMAL(12,2) DEFAULT 0,
    current_balance DECIMAL(12,2) DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Customers ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_customers (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    mobile          VARCHAR(15),
    gst_number      VARCHAR(20),
    address         TEXT,
    school_id       INT REFERENCES inv_schools(id) ON DELETE SET NULL,
    opening_balance DECIMAL(12,2) DEFAULT 0,
    current_balance DECIMAL(12,2) DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Purchase Bills ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_purchase_bills (
    id           SERIAL PRIMARY KEY,
    supplier_id  INT REFERENCES inv_suppliers(id) ON DELETE SET NULL,
    bill_number  VARCHAR(50),
    bill_date    DATE NOT NULL,
    due_date     DATE,
    status       VARCHAR(20) DEFAULT 'unpaid'
                   CHECK (status IN ('unpaid','partial','paid','cancelled')),
    subtotal     DECIMAL(12,2) DEFAULT 0,
    discount     DECIMAL(12,2) DEFAULT 0,
    gst_amount   DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    paid_amount  DECIMAL(12,2) DEFAULT 0,
    balance      DECIMAL(12,2) DEFAULT 0,
    notes        TEXT,
    created_by   INT REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inv_purchase_bill_items (
    id          SERIAL PRIMARY KEY,
    bill_id     INT NOT NULL REFERENCES inv_purchase_bills(id) ON DELETE CASCADE,
    variant_id  INT NOT NULL REFERENCES inv_variants(id),
    qty         DECIMAL(12,3) NOT NULL,
    unit_price  DECIMAL(12,2) NOT NULL,
    gst_rate    DECIMAL(5,2) DEFAULT 0,
    gst_amount  DECIMAL(12,2) DEFAULT 0,
    total_price DECIMAL(12,2) NOT NULL
);

-- ── Purchase Payments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_purchase_payments (
    id           SERIAL PRIMARY KEY,
    bill_id      INT REFERENCES inv_purchase_bills(id) ON DELETE SET NULL,
    supplier_id  INT NOT NULL REFERENCES inv_suppliers(id) ON DELETE CASCADE,
    amount       DECIMAL(12,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_mode VARCHAR(30) DEFAULT 'cash'
                   CHECK (payment_mode IN ('cash','bank','upi','cheque')),
    reference    VARCHAR(100),
    notes        TEXT,
    created_by   INT REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Purchase Returns ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_purchase_returns (
    id            SERIAL PRIMARY KEY,
    bill_id       INT REFERENCES inv_purchase_bills(id) ON DELETE SET NULL,
    supplier_id   INT REFERENCES inv_suppliers(id) ON DELETE SET NULL,
    return_number VARCHAR(50),
    return_date   DATE NOT NULL,
    reason        TEXT,
    total_amount  DECIMAL(12,2) DEFAULT 0,
    created_by    INT REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inv_purchase_return_items (
    id          SERIAL PRIMARY KEY,
    return_id   INT NOT NULL REFERENCES inv_purchase_returns(id) ON DELETE CASCADE,
    variant_id  INT NOT NULL REFERENCES inv_variants(id),
    qty         DECIMAL(12,3) NOT NULL,
    unit_price  DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL
);

-- ── Sales Invoices ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_sales_invoices (
    id             SERIAL PRIMARY KEY,
    customer_id    INT REFERENCES inv_customers(id) ON DELETE SET NULL,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_date   DATE NOT NULL,
    due_date       DATE,
    status         VARCHAR(20) DEFAULT 'unpaid'
                     CHECK (status IN ('draft','unpaid','partial','paid','cancelled')),
    subtotal       DECIMAL(12,2) DEFAULT 0,
    discount       DECIMAL(12,2) DEFAULT 0,
    gst_amount     DECIMAL(12,2) DEFAULT 0,
    total_amount   DECIMAL(12,2) DEFAULT 0,
    paid_amount    DECIMAL(12,2) DEFAULT 0,
    balance        DECIMAL(12,2) DEFAULT 0,
    notes          TEXT,
    created_by     INT REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inv_sales_invoice_items (
    id          SERIAL PRIMARY KEY,
    invoice_id  INT NOT NULL REFERENCES inv_sales_invoices(id) ON DELETE CASCADE,
    variant_id  INT NOT NULL REFERENCES inv_variants(id),
    qty         DECIMAL(12,3) NOT NULL,
    unit_price  DECIMAL(12,2) NOT NULL,
    discount    DECIMAL(12,2) DEFAULT 0,
    gst_rate    DECIMAL(5,2) DEFAULT 0,
    gst_amount  DECIMAL(12,2) DEFAULT 0,
    total_price DECIMAL(12,2) NOT NULL
);

-- ── Sales Payments ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_sales_payments (
    id           SERIAL PRIMARY KEY,
    invoice_id   INT REFERENCES inv_sales_invoices(id) ON DELETE SET NULL,
    customer_id  INT NOT NULL REFERENCES inv_customers(id) ON DELETE CASCADE,
    amount       DECIMAL(12,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_mode VARCHAR(30) DEFAULT 'cash',
    reference    VARCHAR(100),
    notes        TEXT,
    created_by   INT REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Sales Returns ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_sales_returns (
    id            SERIAL PRIMARY KEY,
    invoice_id    INT REFERENCES inv_sales_invoices(id) ON DELETE SET NULL,
    customer_id   INT REFERENCES inv_customers(id) ON DELETE SET NULL,
    return_number VARCHAR(50),
    return_date   DATE NOT NULL,
    reason        TEXT,
    total_amount  DECIMAL(12,2) DEFAULT 0,
    created_by    INT REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inv_sales_return_items (
    id          SERIAL PRIMARY KEY,
    return_id   INT NOT NULL REFERENCES inv_sales_returns(id) ON DELETE CASCADE,
    variant_id  INT NOT NULL REFERENCES inv_variants(id),
    qty         DECIMAL(12,3) NOT NULL,
    unit_price  DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL
);

-- ── Stock Adjustments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inv_stock_adjustments (
    id                SERIAL PRIMARY KEY,
    adjustment_number VARCHAR(50),
    adjustment_date   DATE NOT NULL,
    type              VARCHAR(20) CHECK (type IN ('increase','decrease','correction')),
    reason            TEXT,
    adjusted_by       INT REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inv_stock_adjustment_items (
    id            SERIAL PRIMARY KEY,
    adjustment_id INT NOT NULL REFERENCES inv_stock_adjustments(id) ON DELETE CASCADE,
    variant_id    INT NOT NULL REFERENCES inv_variants(id),
    current_qty   DECIMAL(12,3),
    new_qty       DECIMAL(12,3),
    qty_change    DECIMAL(12,3)
);

-- ── Sequence counters for auto-numbering ─────────────────────────────
CREATE TABLE IF NOT EXISTS inv_counters (
    key        VARCHAR(50) PRIMARY KEY,
    value      INT DEFAULT 0
);
INSERT INTO inv_counters (key, value) VALUES
    ('purchase_bill', 0),
    ('sales_invoice', 0),
    ('purchase_return', 0),
    ('sales_return', 0),
    ('stock_adjustment', 0)
ON CONFLICT DO NOTHING;

-- ── Indexes ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inv_variants_product  ON inv_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_variants_school   ON inv_variants(school_id);
CREATE INDEX IF NOT EXISTS idx_inv_variants_sku      ON inv_variants(sku);
CREATE INDEX IF NOT EXISTS idx_inv_stock_variant     ON inv_stock(variant_id);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_variant    ON inv_stock_ledger(variant_id);
CREATE INDEX IF NOT EXISTS idx_inv_ledger_created    ON inv_stock_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_bills_supplier    ON inv_purchase_bills(supplier_id);
CREATE INDEX IF NOT EXISTS idx_inv_bills_date        ON inv_purchase_bills(bill_date DESC);
CREATE INDEX IF NOT EXISTS idx_inv_invoices_customer ON inv_sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_inv_invoices_date     ON inv_sales_invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_inv_sp_school         ON inv_school_products(school_id);
CREATE INDEX IF NOT EXISTS idx_inv_sp_product        ON inv_school_products(product_id);
