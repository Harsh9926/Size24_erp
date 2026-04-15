-- Excel uploads tracking table
CREATE TABLE IF NOT EXISTS excel_uploads (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    shop_id      INTEGER REFERENCES shops(id) ON DELETE SET NULL,
    filename     TEXT NOT NULL,
    upload_date  DATE NOT NULL,
    total_sale   NUMERIC(14, 2) NOT NULL DEFAULT 0,
    row_data     JSONB,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_excel_uploads_user ON excel_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_excel_uploads_date ON excel_uploads(upload_date DESC);
