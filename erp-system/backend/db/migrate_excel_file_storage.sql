-- Add file_data column to store actual Excel binary
ALTER TABLE excel_uploads ADD COLUMN IF NOT EXISTS file_data BYTEA;
