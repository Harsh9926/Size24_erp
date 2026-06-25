-- ═══════════════════════════════════════════════════════════════
-- SIZE24 ERP — Manufacturing: Product Master Extensions,
--              Raw Materials, Fabric Lots, BOM, Size Matrix
-- Prefix: pm_ (product master lookups), rm_ (raw materials), bom_
-- ═══════════════════════════════════════════════════════════════

-- ── Product Master Lookup Tables ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS pm_colors (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    hex_code   VARCHAR(10),
    is_active  BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pm_genders (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(50) NOT NULL,   -- Boys, Girls, Unisex, Men, Women
    is_active  BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS pm_houses (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,  -- Red House, Blue House, etc.
    color      VARCHAR(50),
    school_id  INT REFERENCES inv_schools(id) ON DELETE SET NULL,
    is_active  BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pm_sleeve_types (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,  -- Full Sleeve, Half Sleeve, Sleeveless
    is_active  BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS pm_fabric_types (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL, -- Cotton, Polyester, Blended, etc.
    description TEXT,
    is_active   BOOLEAN DEFAULT true
);

-- Size Master (numeric + alpha sizes)
CREATE TABLE IF NOT EXISTS pm_sizes (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(20) NOT NULL,   -- 28, 30, S, M, L, XL, XXL
    sort_order INT DEFAULT 0,
    is_active  BOOLEAN DEFAULT true
);

-- Seed standard genders (idempotent)
INSERT INTO pm_genders (name) VALUES ('Boys'),('Girls'),('Unisex'),('Men'),('Women')
ON CONFLICT DO NOTHING;

-- Seed standard sleeve types
INSERT INTO pm_sleeve_types (name) VALUES ('Full Sleeve'),('Half Sleeve'),('Sleeveless'),('3/4 Sleeve')
ON CONFLICT DO NOTHING;

-- Seed standard sizes
INSERT INTO pm_sizes (name, sort_order) VALUES
    ('26',1),('28',2),('30',3),('32',4),('34',5),('36',6),('38',7),('40',8),
    ('S',10),('M',11),('L',12),('XL',13),('XXL',14),('XXXL',15),
    ('Free Size',20)
ON CONFLICT DO NOTHING;

-- ── Extend inv_products with manufacturing attributes ─────────────────
ALTER TABLE inv_products ADD COLUMN IF NOT EXISTS gender_id      INT REFERENCES pm_genders(id) ON DELETE SET NULL;
ALTER TABLE inv_products ADD COLUMN IF NOT EXISTS sleeve_type_id INT REFERENCES pm_sleeve_types(id) ON DELETE SET NULL;
ALTER TABLE inv_products ADD COLUMN IF NOT EXISTS fabric_type_id INT REFERENCES pm_fabric_types(id) ON DELETE SET NULL;
ALTER TABLE inv_products ADD COLUMN IF NOT EXISTS image_urls     JSONB DEFAULT '[]';
ALTER TABLE inv_products ADD COLUMN IF NOT EXISTS sku            VARCHAR(100);
ALTER TABLE inv_products ADD COLUMN IF NOT EXISTS barcode        VARCHAR(100) UNIQUE;

-- ── Warehouses ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rm_warehouses (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(150) NOT NULL,
    location   TEXT,
    is_active  BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO rm_warehouses (name, location) VALUES ('Main Warehouse', 'Head Office')
ON CONFLICT DO NOTHING;

-- ── Raw Material Types ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rm_material_types (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    is_active   BOOLEAN DEFAULT true
);

INSERT INTO rm_material_types (name) VALUES
    ('Fabric'),('Thread'),('Buttons'),('Zip'),('Elastic'),
    ('Labels'),('Logo'),('Packing'),('Collar'),('Cuff')
ON CONFLICT DO NOTHING;

-- ── Raw Materials Master ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rm_materials (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    type_id         INT REFERENCES rm_material_types(id) ON DELETE SET NULL,
    supplier_id     INT REFERENCES inv_suppliers(id) ON DELETE SET NULL,
    unit            VARCHAR(20) NOT NULL DEFAULT 'meter'
                      CHECK (unit IN ('meter','piece','roll','kg','liter','gram')),
    purchase_price  DECIMAL(12,2) DEFAULT 0,  -- last purchase price
    current_cost    DECIMAL(12,2) DEFAULT 0,  -- weighted avg / current cost
    current_stock   DECIMAL(12,3) DEFAULT 0,
    reorder_level   DECIMAL(12,3) DEFAULT 0,
    barcode         VARCHAR(100) UNIQUE,
    lot_number      VARCHAR(100),
    warehouse_id    INT REFERENCES rm_warehouses(id) ON DELETE SET NULL,
    gst_rate        DECIMAL(5,2) DEFAULT 0,
    hsn_code        VARCHAR(20),
    notes           TEXT,
    is_active       BOOLEAN DEFAULT true,
    created_by      INT REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Raw Material Purchase History ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS rm_purchases (
    id              SERIAL PRIMARY KEY,
    material_id     INT NOT NULL REFERENCES rm_materials(id) ON DELETE CASCADE,
    supplier_id     INT REFERENCES inv_suppliers(id) ON DELETE SET NULL,
    purchase_date   DATE NOT NULL,
    qty             DECIMAL(12,3) NOT NULL,
    unit_price      DECIMAL(12,2) NOT NULL,
    total_cost      DECIMAL(12,2) GENERATED ALWAYS AS (qty * unit_price) STORED,
    invoice_number  VARCHAR(100),
    notes           TEXT,
    created_by      INT REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Fabric Lots ───────────────────────────────────────────────────────
-- Each purchase of fabric creates a lot; cost_per_unit is auto-calculated
CREATE TABLE IF NOT EXISTS rm_fabric_lots (
    id              SERIAL PRIMARY KEY,
    material_id     INT NOT NULL REFERENCES rm_materials(id) ON DELETE CASCADE,
    lot_number      VARCHAR(100) NOT NULL UNIQUE,
    total_qty       DECIMAL(12,3) NOT NULL,           -- total meters/kg purchased
    used_qty        DECIMAL(12,3) DEFAULT 0,
    available_qty   DECIMAL(12,3) GENERATED ALWAYS AS (total_qty - used_qty) STORED,
    total_cost      DECIMAL(12,2) NOT NULL,
    cost_per_unit   DECIMAL(12,4) GENERATED ALWAYS AS (
                        CASE WHEN total_qty > 0 THEN total_cost / total_qty ELSE 0 END
                    ) STORED,
    purchase_date   DATE NOT NULL,
    supplier_id     INT REFERENCES inv_suppliers(id) ON DELETE SET NULL,
    warehouse_id    INT REFERENCES rm_warehouses(id) ON DELETE SET NULL,
    invoice_number  VARCHAR(100),
    notes           TEXT,
    is_active       BOOLEAN DEFAULT true,
    created_by      INT REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Fabric Lot Usage ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rm_fabric_lot_usage (
    id          SERIAL PRIMARY KEY,
    lot_id      INT NOT NULL REFERENCES rm_fabric_lots(id) ON DELETE CASCADE,
    used_qty    DECIMAL(12,3) NOT NULL,
    used_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    ref_type    VARCHAR(50),   -- 'production_order', 'bom_issue', 'manual', etc.
    ref_id      INT,
    note        TEXT,
    created_by  INT REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── BOM Headers ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bom_headers (
    id          SERIAL PRIMARY KEY,
    product_id  INT NOT NULL REFERENCES inv_products(id) ON DELETE CASCADE,
    version     VARCHAR(20) DEFAULT 'v1',
    name        VARCHAR(200),
    is_active   BOOLEAN DEFAULT true,
    created_by  INT REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, version)
);

-- ── BOM Items (base quantities — applies to all sizes unless overridden) ──
CREATE TABLE IF NOT EXISTS bom_items (
    id              SERIAL PRIMARY KEY,
    bom_id          INT NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
    material_id     INT NOT NULL REFERENCES rm_materials(id) ON DELETE CASCADE,
    qty_per_unit    DECIMAL(12,4) NOT NULL DEFAULT 0,
    unit            VARCHAR(20),      -- inherits from material if null
    notes           TEXT,
    UNIQUE(bom_id, material_id)
);

-- ── BOM Size Matrix (per-size material quantity overrides) ────────────
-- If a row exists here for (product_id, size_name, material_id),
-- that qty overrides the bom_items base qty.
CREATE TABLE IF NOT EXISTS bom_size_matrix (
    id          SERIAL PRIMARY KEY,
    product_id  INT NOT NULL REFERENCES inv_products(id) ON DELETE CASCADE,
    size_name   VARCHAR(20) NOT NULL,   -- '28', '30', 'S', 'M', etc.
    material_id INT NOT NULL REFERENCES rm_materials(id) ON DELETE CASCADE,
    qty         DECIMAL(12,4) NOT NULL,
    unit        VARCHAR(20),
    notes       TEXT,
    UNIQUE(product_id, size_name, material_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rm_materials_type      ON rm_materials(type_id);
CREATE INDEX IF NOT EXISTS idx_rm_materials_supplier  ON rm_materials(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rm_purchases_material  ON rm_purchases(material_id);
CREATE INDEX IF NOT EXISTS idx_rm_purchases_date      ON rm_purchases(purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_rm_fabric_lots_mat     ON rm_fabric_lots(material_id);
CREATE INDEX IF NOT EXISTS idx_rm_lot_usage_lot       ON rm_fabric_lot_usage(lot_id);
CREATE INDEX IF NOT EXISTS idx_bom_headers_product    ON bom_headers(product_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_bom          ON bom_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_size_matrix_prod   ON bom_size_matrix(product_id);
CREATE INDEX IF NOT EXISTS idx_pm_houses_school       ON pm_houses(school_id);
