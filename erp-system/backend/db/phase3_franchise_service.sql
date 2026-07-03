-- ============================================================
-- PHASE 3: FRANCHISE MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS franchise_partners (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(20) UNIQUE NOT NULL,
    name            VARCHAR(100) NOT NULL,
    owner_name      VARCHAR(100),
    mobile          VARCHAR(15),
    email           VARCHAR(100),
    address         TEXT,
    city            VARCHAR(60),
    state           VARCHAR(60),
    gstin           VARCHAR(20),
    commission_pct  DECIMAL(5,2) DEFAULT 0,
    credit_limit    DECIMAL(14,2) DEFAULT 0,
    wallet_balance  DECIMAL(14,2) DEFAULT 0,
    outstanding     DECIMAL(14,2) DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
    joined_date     DATE,
    agreement_url   TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS franchise_wallet_ledger (
    id              SERIAL PRIMARY KEY,
    franchise_id    INT NOT NULL REFERENCES franchise_partners(id),
    txn_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    txn_type        VARCHAR(20) NOT NULL CHECK (txn_type IN ('credit','debit')),
    amount          DECIMAL(14,2) NOT NULL,
    ref_type        VARCHAR(40),
    ref_id          INT,
    narration       TEXT,
    balance_after   DECIMAL(14,2),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS franchise_stock_transfers (
    id              SERIAL PRIMARY KEY,
    transfer_number VARCHAR(20) UNIQUE NOT NULL,
    franchise_id    INT NOT NULL REFERENCES franchise_partners(id),
    transfer_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    transfer_type   VARCHAR(10) CHECK (transfer_type IN ('out','return')),   -- out = to franchise
    items           JSONB DEFAULT '[]',
    total_value     DECIMAL(14,2) DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','dispatched','received','rejected')),
    approved_by     INT REFERENCES users(id),
    notes           TEXT,
    created_by      INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS franchise_orders (
    id              SERIAL PRIMARY KEY,
    order_number    VARCHAR(20) UNIQUE NOT NULL,
    franchise_id    INT NOT NULL REFERENCES franchise_partners(id),
    order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    items           JSONB DEFAULT '[]',
    total_value     DECIMAL(14,2) DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','fulfilled')),
    approved_by     INT REFERENCES users(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS franchise_settlements (
    id              SERIAL PRIMARY KEY,
    franchise_id    INT NOT NULL REFERENCES franchise_partners(id),
    settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_from     DATE NOT NULL,
    period_to       DATE NOT NULL,
    gross_sales     DECIMAL(14,2) DEFAULT 0,
    commission_amt  DECIMAL(14,2) DEFAULT 0,
    deductions      DECIMAL(14,2) DEFAULT 0,
    net_payable     DECIMAL(14,2) DEFAULT 0,
    payment_mode    VARCHAR(20),
    payment_ref     VARCHAR(60),
    status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','paid')),
    notes           TEXT,
    created_by      INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO inv_counters (counter_name, last_number) VALUES
    ('franchise_code', 0), ('franchise_transfer', 0),
    ('franchise_order', 0), ('franchise_settlement', 0)
ON CONFLICT (counter_name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_fran_wallet   ON franchise_wallet_ledger(franchise_id, txn_date);
CREATE INDEX IF NOT EXISTS idx_fran_transfers ON franchise_stock_transfers(franchise_id);

-- ============================================================
-- PHASE 3: SERVICE & ALTERATION MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS svc_orders (
    id              SERIAL PRIMARY KEY,
    order_number    VARCHAR(20) UNIQUE NOT NULL,
    order_type      VARCHAR(20) NOT NULL CHECK (order_type IN ('alteration','repair','tailoring','embroidery')),
    customer_id     INT REFERENCES inv_customers(id),
    customer_name   VARCHAR(100),
    customer_mobile VARCHAR(15),
    order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date   DATE,
    items           JSONB DEFAULT '[]',    -- [{description, qty, rate, amount}]
    total_amount    DECIMAL(10,2) DEFAULT 0,
    advance_paid    DECIMAL(10,2) DEFAULT 0,
    balance_due     DECIMAL(10,2) DEFAULT 0,
    assigned_to     INT REFERENCES hr_employees(id),
    status          VARCHAR(20) DEFAULT 'received' CHECK (status IN (
                    'received','in_progress','completed','delivered','cancelled')),
    notes           TEXT,
    created_by      INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS svc_status_log (
    id              SERIAL PRIMARY KEY,
    order_id        INT NOT NULL REFERENCES svc_orders(id),
    old_status      VARCHAR(20),
    new_status      VARCHAR(20),
    notes           TEXT,
    changed_by      INT REFERENCES users(id),
    changed_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO inv_counters (counter_name, last_number) VALUES
    ('svc_order', 0)
ON CONFLICT (counter_name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_svc_orders_date   ON svc_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_svc_orders_status ON svc_orders(status);
CREATE INDEX IF NOT EXISTS idx_svc_orders_tailor ON svc_orders(assigned_to);

-- ============================================================
-- PHASE 3: MRP / PURCHASE PLANNING
-- ============================================================

CREATE TABLE IF NOT EXISTS mrp_demand_plans (
    id              SERIAL PRIMARY KEY,
    plan_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    plan_period     VARCHAR(20),     -- month/quarter
    variant_id      INT REFERENCES inv_variants(id),
    product_name    VARCHAR(200),
    current_stock   DECIMAL(10,2) DEFAULT 0,
    reserved_stock  DECIMAL(10,2) DEFAULT 0,
    min_stock       DECIMAL(10,2) DEFAULT 0,
    forecast_demand DECIMAL(10,2) DEFAULT 0,
    suggested_qty   DECIMAL(10,2) DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','approved','po_raised')),
    created_by      INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mrp_purchase_suggestions (
    id              SERIAL PRIMARY KEY,
    suggestion_date DATE NOT NULL DEFAULT CURRENT_DATE,
    variant_id      INT REFERENCES inv_variants(id),
    product_name    VARCHAR(200),
    current_stock   DECIMAL(10,2) DEFAULT 0,
    min_stock       DECIMAL(10,2) DEFAULT 0,
    suggested_qty   DECIMAL(10,2) DEFAULT 0,
    preferred_supplier_id INT REFERENCES inv_parties(id),
    expected_delivery DATE,
    priority        VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
    status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','po_raised')),
    approved_by     INT REFERENCES users(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mrp_suggest_status ON mrp_purchase_suggestions(status);

-- ============================================================
-- PHASE 3: SYSTEM SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS sys_settings (
    key             VARCHAR(100) PRIMARY KEY,
    value           TEXT,
    description     VARCHAR(200),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sys_branches (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    address         TEXT,
    city            VARCHAR(60),
    state           VARCHAR(60),
    gstin           VARCHAR(20),
    mobile          VARCHAR(15),
    email           VARCHAR(100),
    is_head_office  BOOLEAN DEFAULT false,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sys_notification_templates (
    id              SERIAL PRIMARY KEY,
    channel         VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp','sms','email','in_app')),
    event_type      VARCHAR(60) NOT NULL,
    template_name   VARCHAR(100),
    subject         VARCHAR(200),
    body            TEXT NOT NULL,
    variables       JSONB DEFAULT '[]',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(channel, event_type)
);

CREATE TABLE IF NOT EXISTS sys_notification_log (
    id              SERIAL PRIMARY KEY,
    channel         VARCHAR(20),
    recipient       VARCHAR(100),
    event_type      VARCHAR(60),
    ref_type        VARCHAR(40),
    ref_id          INT,
    subject         VARCHAR(200),
    body            TEXT,
    status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
    error_msg       TEXT,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Default system settings
INSERT INTO sys_settings (key, value, description) VALUES
    ('company_name',      'ShopSize24',                     'Company name'),
    ('company_address',   '',                               'Company address'),
    ('company_phone',     '',                               'Company phone'),
    ('company_email',     '',                               'Company email'),
    ('company_gstin',     '',                               'GST Number'),
    ('company_logo',      '',                               'Logo URL'),
    ('currency',          'INR',                            'Default currency'),
    ('timezone',          'Asia/Kolkata',                   'System timezone'),
    ('low_stock_threshold','10',                            'Default low stock alert level'),
    ('invoice_prefix',    'INV',                            'Invoice number prefix'),
    ('po_prefix',         'PO',                             'Purchase order prefix'),
    ('financial_year_start','04-01',                        'Financial year start (MM-DD)'),
    ('gst_enabled',       'true',                           'GST computation enabled'),
    ('thermal_width',     '80',                             'Thermal printer width (mm)'),
    ('enable_franchise',  'false',                          'Franchise module enabled'),
    ('enable_crm',        'true',                           'CRM module enabled'),
    ('enable_hr',         'true',                           'HR module enabled'),
    ('smtp_host',         '',                               'SMTP host'),
    ('smtp_port',         '587',                            'SMTP port'),
    ('smtp_user',         '',                               'SMTP user'),
    ('smtp_pass',         '',                               'SMTP password (encrypted)'),
    ('whatsapp_enabled',  'false',                          'WhatsApp notifications enabled'),
    ('sms_enabled',       'false',                          'SMS notifications enabled')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_notif_log_status ON sys_notification_log(status, created_at);
