# Production DB repair runbook — permissions schema + performance fix

Run in order, on the VPS, from `~/Size24_erp/erp-system/backend`. Everything here is
additive/idempotent — no drops, no truncates, no data loss. Your existing backup
(`/home/ubuntu/size24_backup_20260901_070737.sql`) already covers this.

## 1. Pull latest

```bash
cd ~/Size24_erp && git pull origin main
cd erp-system/backend
```

## 2. Apply the new performance-index migration

```bash
sudo -u postgres psql -d size24 -f db/migrate_report_perf_indexes.sql
```

Expect three `CREATE INDEX` lines, no errors. This is the fix for the Reports 30s
timeout (see ROOT CAUSE below) — safe to run now even though `fix_action_permissions_schema.sql`,
`migrate_attendance_action_permissions.sql`, `attendance_schema.sql`, and
`attendance_payroll_schema.sql` are already applied per your last update.

## 3. Verify schema (read-only)

```bash
sudo -u postgres psql -d size24 -c "\di daily_entries" 
sudo -u postgres psql -d size24 -c "\di attendance"
sudo -u postgres psql -d size24 -c "SELECT conname FROM pg_constraint WHERE conrelid='permission_actions'::regclass;"
sudo -u postgres psql -d size24 -c "SELECT to_regclass('user_action_permissions');"
sudo -u postgres psql -d size24 -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='daily_entries' AND column_name='cheque';"
```

Expect: `idx_daily_entries_date`, `idx_daily_entries_created_at` present on `daily_entries`;
`idx_attendance_user_date` present on `attendance`; `permission_actions_action_key_key` in
the constraint list; `user_action_permissions` resolves; `cheque | numeric`.

## 4. Restart backend (picks up the new `config/db.js` pool/timeout settings)

```bash
pm2 restart backend
pm2 status
```

Confirm `backend` is `online` and stays up for ~30s without restart-looping.

## 5. Check logs for anything unexpected

```bash
pm2 logs backend --lines 100 --nostream
```

Look for `relation does not exist`, `column does not exist`, or `statement timeout` — the
last one is now expected/intentional if a query genuinely still needs >25s; if you see it,
report which endpoint so we can add a targeted date-range default rather than raising the
timeout blindly.

## 6. Smoke test (replace TOKEN with a valid admin JWT)

```bash
for ep in \
  "attendance/assignments" \
  "attendance/payroll?month=2026-09" \
  "attendance/me/monthly" \
  "dashboard/admin?period=monthly"; do
  echo -n "$ep -> "
  curl -s -o /dev/null -w "%{http_code}  %{time_total}s\n" -H "Authorization: Bearer TOKEN" "http://localhost:5000/api/$ep"
done
```

All should return `200` well under a few seconds (previously the Reports page alone was
taking 30s+; the new indexes should bring a full unfiltered `daily_entries` scan down from
a sequential scan to an index scan).

Then in the browser: reload Admin Dashboard, Reports (try it with **no date filter**, the
worst case that was previously timing out), Attendance → Assignments, Payroll, and your own
Monthly Attendance tab.

---

Paste back the output of steps 3, 5, and the smoke-test timings — if the Reports page (no
filter) is still slow after this, the next step is capping/defaulting its date range in
`reportController.js` rather than adding more indexes, and I've already identified exactly
where that change goes (`buildQuery` in `reportController.js`).
