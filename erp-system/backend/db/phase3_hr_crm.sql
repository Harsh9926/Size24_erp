-- ============================================================
-- PHASE 3: HR & PAYROLL MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS hr_employees (
    id              SERIAL PRIMARY KEY,
    emp_code        VARCHAR(20) UNIQUE NOT NULL,
    name            VARCHAR(100) NOT NULL,
    mobile          VARCHAR(15),
    email           VARCHAR(100),
    dob             DATE,
    gender          VARCHAR(10),
    address         TEXT,
    department      VARCHAR(60),
    designation     VARCHAR(60),
    employment_type VARCHAR(20) DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','contract','tailor','daily_wage')),
    joining_date    DATE,
    leaving_date    DATE,
    basic_salary    DECIMAL(10,2) DEFAULT 0,
    hra             DECIMAL(10,2) DEFAULT 0,
    da              DECIMAL(10,2) DEFAULT 0,
    pf_applicable   BOOLEAN DEFAULT false,
    esi_applicable  BOOLEAN DEFAULT false,
    bank_name       VARCHAR(80),
    bank_account    VARCHAR(30),
    ifsc            VARCHAR(15),
    pan             VARCHAR(15),
    aadhar          VARCHAR(20),
    photo_url       TEXT,
    is_active       BOOLEAN DEFAULT true,
    user_id         INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_attendance (
    id              SERIAL PRIMARY KEY,
    employee_id     INT NOT NULL REFERENCES hr_employees(id),
    att_date        DATE NOT NULL,
    status          VARCHAR(20) NOT NULL CHECK (status IN ('present','absent','half_day','leave','holiday','work_from_home')),
    check_in        TIME,
    check_out       TIME,
    overtime_hours  DECIMAL(4,2) DEFAULT 0,
    notes           TEXT,
    marked_by       INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, att_date)
);

CREATE TABLE IF NOT EXISTS hr_leave_types (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL,
    days_allowed INT DEFAULT 12,
    carry_forward BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS hr_leaves (
    id              SERIAL PRIMARY KEY,
    employee_id     INT NOT NULL REFERENCES hr_employees(id),
    leave_type_id   INT REFERENCES hr_leave_types(id),
    from_date       DATE NOT NULL,
    to_date         DATE NOT NULL,
    days            DECIMAL(4,1),
    reason          TEXT,
    status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    approved_by     INT REFERENCES users(id),
    applied_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_salary_slips (
    id              SERIAL PRIMARY KEY,
    employee_id     INT NOT NULL REFERENCES hr_employees(id),
    slip_month      DATE NOT NULL,   -- first day of the month
    working_days    INT,
    present_days    DECIMAL(5,1),
    basic           DECIMAL(10,2) DEFAULT 0,
    hra             DECIMAL(10,2) DEFAULT 0,
    da              DECIMAL(10,2) DEFAULT 0,
    incentive       DECIMAL(10,2) DEFAULT 0,
    other_allowance DECIMAL(10,2) DEFAULT 0,
    gross           DECIMAL(10,2) DEFAULT 0,
    pf_deduct       DECIMAL(10,2) DEFAULT 0,
    esi_deduct      DECIMAL(10,2) DEFAULT 0,
    tds_deduct      DECIMAL(10,2) DEFAULT 0,
    advance_deduct  DECIMAL(10,2) DEFAULT 0,
    other_deduct    DECIMAL(10,2) DEFAULT 0,
    net_pay         DECIMAL(10,2) DEFAULT 0,
    payment_mode    VARCHAR(20),
    payment_date    DATE,
    status          VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
    notes           TEXT,
    generated_by    INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, slip_month)
);

CREATE TABLE IF NOT EXISTS hr_incentives (
    id              SERIAL PRIMARY KEY,
    employee_id     INT NOT NULL REFERENCES hr_employees(id),
    incentive_date  DATE NOT NULL,
    amount          DECIMAL(10,2) NOT NULL,
    reason          VARCHAR(200),
    ref_type        VARCHAR(30),
    ref_id          INT,
    created_by      INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Tailor-specific work tracking
CREATE TABLE IF NOT EXISTS hr_tailor_work (
    id              SERIAL PRIMARY KEY,
    employee_id     INT NOT NULL REFERENCES hr_employees(id),
    work_date       DATE NOT NULL,
    order_ref       VARCHAR(50),
    item_desc       TEXT,
    qty             INT DEFAULT 1,
    rate_per_piece  DECIMAL(8,2) DEFAULT 0,
    amount          DECIMAL(10,2) DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','paid')),
    paid_date       DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Sequences
INSERT INTO inv_counters (counter_name, last_number) VALUES
    ('emp_code', 0), ('salary_slip', 0)
ON CONFLICT (counter_name) DO NOTHING;

-- Default leave types
INSERT INTO hr_leave_types (name, days_allowed, carry_forward) VALUES
    ('Casual Leave', 12, false),
    ('Sick Leave', 6, false),
    ('Earned Leave', 15, true),
    ('Maternity Leave', 90, false),
    ('Unpaid Leave', 0, false)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_hr_att_emp  ON hr_attendance(employee_id, att_date);
CREATE INDEX IF NOT EXISTS idx_hr_slip_emp ON hr_salary_slips(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_tailor   ON hr_tailor_work(employee_id, work_date);

-- ============================================================
-- PHASE 3: CRM MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_leads (
    id              SERIAL PRIMARY KEY,
    lead_number     VARCHAR(20) UNIQUE NOT NULL,
    name            VARCHAR(100) NOT NULL,
    mobile          VARCHAR(15),
    email           VARCHAR(100),
    address         TEXT,
    school_name     VARCHAR(120),
    source          VARCHAR(40),         -- walk_in, phone, whatsapp, reference, social_media, website
    category        VARCHAR(40),         -- school, retail, wholesale, franchise, individual
    assigned_to     INT REFERENCES users(id),
    status          VARCHAR(30) DEFAULT 'new' CHECK (status IN (
                    'new','contacted','qualified','quoted','negotiating','won','lost','hold')),
    expected_value  DECIMAL(12,2),
    expected_date   DATE,
    lost_reason     TEXT,
    notes           TEXT,
    is_converted    BOOLEAN DEFAULT false,
    customer_id     INT REFERENCES inv_customers(id),
    created_by      INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_enquiries (
    id              SERIAL PRIMARY KEY,
    lead_id         INT REFERENCES crm_leads(id),
    enquiry_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    product_interest TEXT,
    quantity_needed INT,
    budget          DECIMAL(12,2),
    requirements    TEXT,
    handled_by      INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_quotations (
    id              SERIAL PRIMARY KEY,
    quote_number    VARCHAR(20) UNIQUE NOT NULL,
    lead_id         INT REFERENCES crm_leads(id),
    customer_id     INT REFERENCES inv_customers(id),
    quote_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_till      DATE,
    items           JSONB DEFAULT '[]',
    subtotal        DECIMAL(12,2) DEFAULT 0,
    discount        DECIMAL(12,2) DEFAULT 0,
    gst             DECIMAL(12,2) DEFAULT 0,
    total           DECIMAL(12,2) DEFAULT 0,
    notes           TEXT,
    status          VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected','expired')),
    created_by      INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_followups (
    id              SERIAL PRIMARY KEY,
    lead_id         INT REFERENCES crm_leads(id),
    followup_date   DATE NOT NULL,
    followup_type   VARCHAR(30),   -- call, whatsapp, visit, email, meeting
    notes           TEXT,
    outcome         TEXT,
    next_followup   DATE,
    done_by         INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_calls (
    id              SERIAL PRIMARY KEY,
    lead_id         INT REFERENCES crm_leads(id),
    customer_id     INT REFERENCES inv_customers(id),
    call_date       TIMESTAMPTZ DEFAULT NOW(),
    direction       VARCHAR(10) DEFAULT 'outbound' CHECK (direction IN ('inbound','outbound')),
    duration_min    INT,
    summary         TEXT,
    outcome         VARCHAR(30),   -- interested, not_interested, callback, no_answer, converted
    done_by         INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_tasks (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(200) NOT NULL,
    lead_id         INT REFERENCES crm_leads(id),
    customer_id     INT REFERENCES inv_customers(id),
    assigned_to     INT REFERENCES users(id),
    due_date        DATE,
    priority        VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
    status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','cancelled')),
    notes           TEXT,
    created_by      INT REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO inv_counters (counter_name, last_number) VALUES
    ('lead_number', 0), ('quote_number', 0)
ON CONFLICT (counter_name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_crm_leads_status  ON crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned ON crm_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_followups_date ON crm_followups(followup_date);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due      ON crm_tasks(due_date, assigned_to);
