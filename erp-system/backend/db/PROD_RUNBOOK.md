# Production DB repair runbook — action-permissions + attendance schema

Run these **in order**, on the VPS, from `~/Size24_erp/erp-system/backend`.
Every step is safe to re-run and none of them drop/truncate/delete anything.

## 0. Pull the fixed files first

```bash
cd ~/Size24_erp
git pull origin main
cd erp-system/backend
```

This brings in the corrected `migrate_entries_action_permissions.sql` (now includes
`UNIQUE(action_key)`) and the new `db/fix_action_permissions_schema.sql`.

## 1. Backup (do this before anything else)

```bash
mkdir -p ~/db_backups
pg_dump -U admin -h localhost -d size24 -F c -f ~/db_backups/size24_$(date +%Y%m%d_%H%M%S).dump
ls -la ~/db_backups/
```

Verify the file is non-trivial in size (should be well over a few hundred KB) before proceeding.

## 2. Inspect current state (read-only — confirms the diagnosis)

```bash
psql -U admin -d size24 -c "\d permission_actions"
psql -U admin -d size24 -c "SELECT to_regclass('user_action_permissions');"
psql -U admin -d size24 -c "SELECT to_regclass('attendance_shop_users');"
psql -U admin -d size24 -c "SELECT to_regclass('attendance_user_settings');"
psql -U admin -d size24 -c "SELECT module_name, action_key FROM permission_actions ORDER BY 1,2;"
psql -U admin -d size24 -c "SELECT action_key, COUNT(*) FROM permission_actions GROUP BY action_key HAVING COUNT(*) > 1;"
```

The last query must return **zero rows** before continuing (it should — 9 entries rows, all
distinct action_keys). If it returns any rows, stop and report back before proceeding.

## 3. Apply the schema fix (permission_actions unique constraint + user_action_permissions)

```bash
psql -U admin -d size24 -f db/fix_action_permissions_schema.sql
```

Expect to see NOTICEs confirming the constraint was added and no errors. It's wrapped in a
transaction — if anything fails, nothing is committed.

## 4. Apply the remaining action-permission phases (idempotent, ON CONFLICT-safe)

```bash
psql -U admin -d size24 -f db/migrate_manager_funds_action_permissions.sql
psql -U admin -d size24 -f db/migrate_attendance_action_permissions.sql
```

These only INSERT with `ON CONFLICT DO NOTHING` — safe now that the FK/unique issue is fixed.

## 5. Apply attendance table schemas (idempotent — needed for payroll/assignments/monthly endpoints)

Run these too — `getPayroll`, `getMyMonthly`, and `getAttendanceAssignments` query
`attendance_shop_users`, `attendance_user_settings`, `attendance_registration`, etc. If any of
this was never applied, that's the real reason those specific endpoints 500:

```bash
psql -U admin -d size24 -f db/attendance_schema.sql
psql -U admin -d size24 -f db/attendance_user_settings_schema.sql
psql -U admin -d size24 -f db/attendance_payroll_schema.sql
```

All three use `CREATE TABLE IF NOT EXISTS` — will not affect any table that already exists.

## 6. Verify schema

```bash
psql -U admin -d size24 -c "SELECT conname FROM pg_constraint WHERE conrelid = 'permission_actions'::regclass;"
psql -U admin -d size24 -c "SELECT to_regclass('user_action_permissions');"
psql -U admin -d size24 -c "SELECT module_name, COUNT(*) FROM permission_actions GROUP BY module_name ORDER BY 1;"
psql -U admin -d size24 -c "\d attendance_shop_users"
psql -U admin -d size24 -c "SELECT column_name FROM information_schema.columns WHERE table_name='daily_entries' AND column_name='cheque';"
```

You should see: `permission_actions_action_key_key` in the constraint list,
`user_action_permissions` resolving (not null), all ~28 action rows across
entries/manager_funds/attendance* modules, and `attendance_shop_users` describing successfully.

## 7. Check current backend logs for the actual 500/timeout root cause before restart

```bash
pm2 logs backend --lines 200 --nostream
```

Look specifically for stack traces tied to `/api/attendance/assignments`, `/api/attendance/payroll`,
`/api/attendance/me/monthly`, and the Reports endpoint's 30s timeout. Send me what you see if
errors persist after the steps above — a timeout (as opposed to a fast 500) points to a slow
query or connection-pool exhaustion rather than a missing table, and needs the actual query log.

## 8. Restart and confirm

```bash
pm2 restart backend
pm2 status
```

Confirm `backend` shows `online` with no immediate restart loop (watch it for ~30s:
`pm2 status` again).

## 9. Endpoint smoke test (replace TOKEN with a valid admin JWT)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer TOKEN" http://localhost:5000/api/attendance/assignments
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer TOKEN" "http://localhost:5000/api/attendance/payroll?month=2026-09"
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer TOKEN" http://localhost:5000/api/attendance/me/monthly
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer TOKEN" "http://localhost:5000/api/dashboard/admin?period=monthly"
```

All should return `200`.

---

Paste back the output of steps 2, 6, and 7 (and any curl codes that aren't 200) and I'll
diagnose further — I don't have network access to your VPS from this session, so I can't run
these myself.
