-- erp-system/backend/db/schema.sql
-- Run once to create the base schema. Use init_db.js for automated setup.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    mobile VARCHAR(15) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'shop_user')),
    name VARCHAR(100),
    is_approved BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS states (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    state_id INT REFERENCES states(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(state_id, name)
);

CREATE TABLE IF NOT EXISTS shops (
    id SERIAL PRIMARY KEY,
    state_id INT REFERENCES states(id),
    city_id INT REFERENCES cities(id),
    shop_name VARCHAR(150) NOT NULL,
    gst_number VARCHAR(15),
    shop_address TEXT,
    manager_name VARCHAR(100),
    mobile_number VARCHAR(15),
    document_type VARCHAR(50) CHECK (document_type IN ('aadhaar', 'pan', 'voter')),
    document_number VARCHAR(50),
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_entries (
    id SERIAL PRIMARY KEY,
    shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    -- total_sale is AUTO-CALCULATED: cash + online + razorpay. Never set manually.
    total_sale DECIMAL(12, 2) DEFAULT 0,
    cash DECIMAL(12, 2) DEFAULT 0,
    -- online = QR / Card / Bank payments (formerly `paytm`)
    online DECIMAL(12, 2) DEFAULT 0,
    -- legacy column kept for backward compatibility; use `online` for new records
    paytm DECIMAL(12, 2) DEFAULT 0,
    razorpay DECIMAL(12, 2) DEFAULT 0,
    locked BOOLEAN DEFAULT false,
    edit_enabled_till TIMESTAMP,
    photo_url TEXT,
    submitted_lat DECIMAL(10,7),
    submitted_lng DECIMAL(10,7),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, date)
);

CREATE TABLE IF NOT EXISTS cash_flows (
    id SERIAL PRIMARY KEY,
    shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('deposit', 'expense')),
    done_by VARCHAR(100),
    note TEXT,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    edited_by INT REFERENCES users(id),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS excel_uploads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    shop_id INTEGER REFERENCES shops(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    upload_date DATE NOT NULL,
    total_sale NUMERIC(14, 2) NOT NULL DEFAULT 0,
    row_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shops_user_id ON shops(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_entries_shop_date ON daily_entries(shop_id, date);
CREATE INDEX IF NOT EXISTS idx_cash_flows_shop_date ON cash_flows(shop_id, date);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_excel_uploads_user ON excel_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_excel_uploads_date ON excel_uploads(upload_date DESC);
