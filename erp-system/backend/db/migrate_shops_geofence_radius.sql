-- Migration: add geofence_radius_m to shops
--
-- schema.sql's CREATE TABLE for `shops` includes geofence_radius_m, but that
-- only applies to a freshly-created table. Production's `shops` table
-- predates this column (CREATE TABLE IF NOT EXISTS is a no-op against an
-- existing table), so attendanceController's queries that select
-- `s.geofence_radius_m` (getAttendanceAssignments, getUserAttendanceShops,
-- getAssignedShopsWithGeofence) fail with "column s.geofence_radius_m does
-- not exist". Idempotent, additive, no data loss.

ALTER TABLE shops ADD COLUMN IF NOT EXISTS geofence_radius_m INT DEFAULT 50;
