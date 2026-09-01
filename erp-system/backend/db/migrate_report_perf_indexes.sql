-- Migration: performance indexes for Reports/Dashboard/Attendance queries
--
-- Root cause of the Admin Reports 30s timeout: reportController.getReportData/
-- downloadCSV builds an empty WHERE clause when no filters are supplied
-- (the common case for a broad Reports pull) and queries
-- `daily_entries JOIN shops LEFT JOIN cities ORDER BY de.date DESC, de.id DESC
-- LIMIT 10000`. daily_entries only had a composite index on (shop_id, date)
-- and no plain index on date/created_at, forcing a full-table scan + sort
-- before the LIMIT could apply. dashboardController's recent-entries and
-- pending-entries queries have the same shape (no date bound, ORDER BY
-- created_at DESC / de.date DESC).
--
-- attendanceController's dominant query shape is `WHERE user_id = $1 AND
-- date = $2` (getMyMonthly / punch lookups), but attendance only had single-
-- column indexes on date and user_id separately, not the composite the
-- query actually needs.
--
-- All statements are additive and safe to run against a live production
-- database with existing data — CREATE INDEX IF NOT EXISTS does not lock
-- out reads/writes for longer than a normal index build, and this dataset
-- (~hundreds of daily_entries rows per the earlier cheque migration output)
-- is small enough that a plain (non-CONCURRENT) build completes in well
-- under a second. No table is dropped, altered destructively, or truncated.

CREATE INDEX IF NOT EXISTS idx_daily_entries_date        ON daily_entries(date);
CREATE INDEX IF NOT EXISTS idx_daily_entries_created_at  ON daily_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date       ON attendance(user_id, date);
