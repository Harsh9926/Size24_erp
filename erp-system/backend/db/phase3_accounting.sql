-- ============================================================
-- PHASE 3: ACCOUNTING MODULE
-- Chart of Accounts, Journal Entries, Vouchers, Financial Statements
-- ============================================================

-- Financial Years
CREATE TABLE IF NOT EXISTS acc_financial_years (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(20) NOT NULL,          -- e.g. "2024-25"
    start_date    DATE NOT NULL,
    end_date      DATE NOT NULL,
    is_active     BOOLEAN DEFAULT false,
    locked        BOOLEAN DEFAULT false,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS acc_accounts (
    id            SERIAL PRIMARY KEY,
    code          VARCHAR(20) UNIQUE NOT NULL,
    name          VARCHAR(120) NOT NULL,
    type          VARCHAR(30) NOT NULL CHECK (type IN (
                    'asset','liability','equity','revenue','expense','contra')),
    sub_type      VARCHAR(50),                   -- cash, bank, receivable, payable, etc.
    parent_id     INT REFERENCES acc_accounts(id),
    is_group      BOOLEAN DEFAULT false,
    is_system     BOOLEAN DEFAULT false,         -- auto-created, cannot delete
    opening_dr    DECIMAL(14,2) DEFAULT 0,
    opening_cr    DECIMAL(14,2) DEFAULT 0,
    gst_applicable BOOLEAN DEFAULT false,
    description   TEXT,
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Journal Entry Headers
CREATE TABLE IF NOT EXISTS acc_journal_entries (
    id            SERIAL PRIMARY KEY,
    entry_number  VARCHAR(30) UNIQUE NOT NULL,
    entry_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    entry_type    VARCHAR(30) NOT NULL CHECK (entry_type IN (
                    'journal','payment','receipt','contra',
                    'sales_auto','purchase_auto','expense_auto',
                    'inventory_auto','manufacturing_auto','wallet_auto')),
    narration     TEXT,
    ref_type      VARCHAR(40),   -- invoice, purchase, payment_in, expense, wallet, etc.
    ref_id        INT,
    financial_year_id INT REFERENCES acc_financial_years(id),
    created_by    INT REFERENCES users(id),
    is_posted     BOOLEAN DEFAULT true,
    is_reversed   BOOLEAN DEFAULT false,
    reversed_by   INT REFERENCES acc_journal_entries(id),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Journal Entry Lines (double-entry)
CREATE TABLE IF NOT EXISTS acc_journal_lines (
    id            SERIAL PRIMARY KEY,
    entry_id      INT NOT NULL REFERENCES acc_journal_entries(id) ON DELETE CASCADE,
    account_id    INT NOT NULL REFERENCES acc_accounts(id),
    dr_amount     DECIMAL(14,2) DEFAULT 0,
    cr_amount     DECIMAL(14,2) DEFAULT 0,
    narration     TEXT,
    cost_center   VARCHAR(50),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT    chk_dr_cr CHECK (
        (dr_amount > 0 AND cr_amount = 0) OR (cr_amount > 0 AND dr_amount = 0)
    )
);

-- Vouchers (Payment / Receipt / Contra)
CREATE TABLE IF NOT EXISTS acc_vouchers (
    id            SERIAL PRIMARY KEY,
    voucher_number VARCHAR(30) UNIQUE NOT NULL,
    voucher_type  VARCHAR(20) NOT NULL CHECK (voucher_type IN ('payment','receipt','contra')),
    voucher_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    party_type    VARCHAR(20),                   -- customer, supplier, employee, other
    party_id      INT,
    party_name    VARCHAR(120),
    amount        DECIMAL(14,2) NOT NULL,
    payment_mode  VARCHAR(20),                   -- cash, bank, upi, cheque
    bank_account  VARCHAR(120),
    cheque_number VARCHAR(30),
    cheque_date   DATE,
    narration     TEXT,
    journal_entry_id INT REFERENCES acc_journal_entries(id),
    created_by    INT REFERENCES users(id),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- GST Ledger entries
CREATE TABLE IF NOT EXISTS acc_gst_ledger (
    id            SERIAL PRIMARY KEY,
    entry_date    DATE NOT NULL,
    ref_type      VARCHAR(40),
    ref_id        INT,
    ref_number    VARCHAR(50),
    party_name    VARCHAR(120),
    gstin         VARCHAR(20),
    taxable_amount DECIMAL(14,2) DEFAULT 0,
    cgst          DECIMAL(14,2) DEFAULT 0,
    sgst          DECIMAL(14,2) DEFAULT 0,
    igst          DECIMAL(14,2) DEFAULT 0,
    total_gst     DECIMAL(14,2) DEFAULT 0,
    gst_type      VARCHAR(10) CHECK (gst_type IN ('collected','paid')),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create default chart of accounts
INSERT INTO acc_accounts (code, name, type, sub_type, is_group, is_system) VALUES
-- Assets
('1000','Assets',                    'asset',     NULL,          true,  true),
('1100','Current Assets',            'asset',     NULL,          true,  true),
('1110','Cash in Hand',              'asset',     'cash',        false, true),
('1120','Bank Accounts',             'asset',     'bank',        true,  true),
('1121','Main Bank Account',         'asset',     'bank',        false, true),
('1130','Trade Receivables',         'asset',     'receivable',  false, true),
('1140','Advance to Suppliers',      'asset',     'advance',     false, true),
('1150','GST Input Credit',          'asset',     'gst',         false, true),
('1151','CGST Input',                'asset',     'gst',         false, true),
('1152','SGST Input',                'asset',     'gst',         false, true),
('1153','IGST Input',                'asset',     'gst',         false, true),
('1160','Inventory - Stock',         'asset',     'inventory',   false, true),
('1170','Advance Payments Received', 'asset',     'advance',     false, true),
('1200','Fixed Assets',              'asset',     NULL,          true,  true),
('1210','Furniture & Fixtures',      'asset',     'fixed',       false, true),
('1220','Computer & Equipment',      'asset',     'fixed',       false, true),
-- Liabilities
('2000','Liabilities',               'liability', NULL,          true,  true),
('2100','Current Liabilities',       'liability', NULL,          true,  true),
('2110','Trade Payables',            'liability', 'payable',     false, true),
('2120','GST Output',                'liability', 'gst',         true,  true),
('2121','CGST Output',               'liability', 'gst',         false, true),
('2122','SGST Output',               'liability', 'gst',         false, true),
('2123','IGST Output',               'liability', 'gst',         false, true),
('2130','Customer Advance Deposits', 'liability', 'advance',     false, true),
('2140','Salary Payable',            'liability', 'payable',     false, true),
('2150','PF Payable',                'liability', 'payable',     false, true),
('2160','ESI Payable',               'liability', 'payable',     false, true),
-- Equity
('3000','Equity',                    'equity',    NULL,          true,  true),
('3100','Capital',                   'equity',    'capital',     false, true),
('3200','Retained Earnings',         'equity',    'retained',    false, true),
('3300','Current Year Profit/Loss',  'equity',    'retained',    false, true),
-- Revenue
('4000','Revenue',                   'revenue',   NULL,          true,  true),
('4100','Sales Revenue',             'revenue',   'sales',       false, true),
('4110','Sales Returns',             'revenue',   'contra_sales',false, true),
('4200','Service Revenue',           'revenue',   'service',     false, true),
('4300','Other Income',              'revenue',   'other',       false, true),
-- Expenses
('5000','Expenses',                  'expense',   NULL,          true,  true),
('5100','Cost of Goods Sold',        'expense',   'cogs',        false, true),
('5110','Purchase',                  'expense',   'purchase',    false, true),
('5120','Purchase Returns',          'expense',   'contra_purchase',false,true),
('5200','Operating Expenses',        'expense',   NULL,          true,  true),
('5210','Salary Expense',            'expense',   'salary',      false, true),
('5220','Rent Expense',              'expense',   'rent',        false, true),
('5230','Electricity Expense',       'expense',   'utility',     false, true),
('5240','Transport Expense',         'expense',   'transport',   false, true),
('5250','Marketing Expense',         'expense',   'marketing',   false, true),
('5260','Miscellaneous Expense',     'expense',   'misc',        false, true),
('5270','Tailor Payments',           'expense',   'tailor',      false, true),
('5300','Manufacturing Expense',     'expense',   'manufacturing',false,true),
('5310','Raw Material Consumed',     'expense',   'raw_material',false,true),
('5320','Fabric Cost',               'expense',   'fabric',      false, true),
('5400','Depreciation',              'expense',   'depreciation',false,true),
('5500','Bank Charges',              'expense',   'bank',        false, true),
('5600','Wallet Expense',            'expense',   'wallet',      false, true)
ON CONFLICT (code) DO NOTHING;

-- Sequence for journal entry numbers
INSERT INTO inv_counters (counter_name, last_number) VALUES
    ('journal_entry', 0),
    ('voucher_payment', 0),
    ('voucher_receipt', 0),
    ('voucher_contra', 0)
ON CONFLICT (counter_name) DO NOTHING;

-- Auto-create default financial year
INSERT INTO acc_financial_years (name, start_date, end_date, is_active)
SELECT '2024-25', '2024-04-01', '2025-03-31', true
WHERE NOT EXISTS (SELECT 1 FROM acc_financial_years WHERE is_active = true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_acc_jl_entry   ON acc_journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_acc_jl_account ON acc_journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_acc_je_date    ON acc_journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_acc_je_ref     ON acc_journal_entries(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_acc_gst_date   ON acc_gst_ledger(entry_date);
