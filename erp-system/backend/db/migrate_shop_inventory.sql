-- ═══════════════════════════════════════════════════════════════
-- Shop-wise Inventory — additive, backward-compatible migration
-- Adds per-shop stock on top of existing inv_* tables. Does NOT
-- drop/alter/delete any existing table, column, or row.
-- ═══════════════════════════════════════════════════════════════

-- Per-shop stock for each variant (parallel to global inv_stock)
CREATE TABLE IF NOT EXISTS inv_shop_stock (
    id             SERIAL PRIMARY KEY,
    shop_id        INT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    variant_id     INT NOT NULL REFERENCES inv_variants(id) ON DELETE CASCADE,
    qty            DECIMAL(12,3) NOT NULL DEFAULT 0,
    purchase_price DECIMAL(12,2),
    sale_price     DECIMAL(12,2),
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, variant_id)
);

-- Per-shop stock movement ledger (parallel to inv_stock_ledger)
CREATE TABLE IF NOT EXISTS inv_shop_stock_ledger (
    id         SERIAL PRIMARY KEY,
    shop_id    INT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    variant_id INT NOT NULL REFERENCES inv_variants(id) ON DELETE CASCADE,
    txn_type   VARCHAR(30) NOT NULL
                 CHECK (txn_type IN ('purchase','sale','purchase_return','sale_return','adjustment','opening','import')),
    qty_change DECIMAL(12,3) NOT NULL,
    qty_after  DECIMAL(12,3) NOT NULL,
    ref_type   VARCHAR(30),
    ref_id     INT,
    note       TEXT,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Excel import run history/summary
CREATE TABLE IF NOT EXISTS inv_stock_imports (
    id                   SERIAL PRIMARY KEY,
    filename             VARCHAR(255),
    total_rows           INT DEFAULT 0,
    processed            INT DEFAULT 0,
    products_created     INT DEFAULT 0,
    products_updated     INT DEFAULT 0,
    shop_stock_upserts   INT DEFAULT 0,
    rows_skipped         INT DEFAULT 0,
    error_count          INT DEFAULT 0,
    errors               JSONB,
    created_by           INT REFERENCES users(id) ON DELETE SET NULL,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track which shop/product/variant a sale line came from (nullable —
-- existing invoices without a shop keep working exactly as before)
ALTER TABLE inv_sales_invoices      ADD COLUMN IF NOT EXISTS shop_id INT REFERENCES shops(id) ON DELETE SET NULL;
ALTER TABLE inv_sales_invoice_items ADD COLUMN IF NOT EXISTS shop_id INT REFERENCES shops(id) ON DELETE SET NULL;
ALTER TABLE inv_sales_returns       ADD COLUMN IF NOT EXISTS shop_id INT REFERENCES shops(id) ON DELETE SET NULL;
ALTER TABLE inv_sales_return_items  ADD COLUMN IF NOT EXISTS shop_id INT REFERENCES shops(id) ON DELETE SET NULL;

-- Pre-existing bug (unrelated to shop-wise inventory, surfaced while
-- testing it): inv_sales_payments.customer_id was NOT NULL, so a
-- walk-in sale (no customer selected) could never record its payment
-- and every such bill failed. Safe to relax — no data is dropped.
ALTER TABLE inv_sales_payments ALTER COLUMN customer_id DROP NOT NULL;

-- The global ledger predates 'import' as a txn_type — widen its check
-- constraint (additive) so shop-stock imports can also log to it via
-- updateStock()'s aggregate sync, without touching any existing rows.
ALTER TABLE inv_stock_ledger DROP CONSTRAINT IF EXISTS inv_stock_ledger_txn_type_check;
ALTER TABLE inv_stock_ledger ADD CONSTRAINT inv_stock_ledger_txn_type_check
    CHECK (txn_type IN ('purchase','sale','purchase_return','sale_return','adjustment','opening','import'));

CREATE INDEX IF NOT EXISTS idx_inv_shop_stock_shop        ON inv_shop_stock(shop_id);
CREATE INDEX IF NOT EXISTS idx_inv_shop_stock_variant     ON inv_shop_stock(variant_id);
CREATE INDEX IF NOT EXISTS idx_inv_shop_ledger_shop_var   ON inv_shop_stock_ledger(shop_id, variant_id);
CREATE INDEX IF NOT EXISTS idx_inv_invoices_shop          ON inv_sales_invoices(shop_id);
CREATE INDEX IF NOT EXISTS idx_inv_invoice_items_shop     ON inv_sales_invoice_items(shop_id);
