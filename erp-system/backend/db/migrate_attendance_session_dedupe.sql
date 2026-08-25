-- Migration: prevent two concurrently-open attendance sessions for the same
-- attendance_id. Without this, two near-simultaneous punch-in requests for a
-- user's 2nd/3rd/... session of the day can both pass the app-level "no open
-- session" check and both insert — causing duplicate DB rows and duplicate
-- admin WhatsApp punch-in alerts. This index makes the second concurrent
-- INSERT fail with a unique_violation instead, which the app now catches.
CREATE UNIQUE INDEX IF NOT EXISTS uq_att_sessions_open
  ON attendance_sessions(attendance_id)
  WHERE punch_out_at IS NULL;
