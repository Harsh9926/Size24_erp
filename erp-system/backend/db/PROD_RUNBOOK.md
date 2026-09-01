# Production DB repair runbook — attendance date bug + schema/ownership gaps

Root cause of "Attendance unavailable" / can't mark attendance: `computeMonth()` (and two
report queries) built the month's end-date as the literal string `${month}-31` — invalid
for any month with fewer than 31 days (September has 30), so Postgres rejected it with
`date/time field value out of range: "2026-09-31"`. This has been fixed in code (now uses
an open-ended `date < (start + INTERVAL '1 month')` bound). Two more real bugs found in the
same log dump: a genuinely missing column (`shops.geofence_radius_m`) and a table-ownership
problem blocking the app's own auto-migrations. All three are fixed/scripted below.

Run in order, on the VPS, from `~/Size24_erp/erp-system/backend`. Nothing here drops,
truncates, or deletes data.

## 1. Pull latest code

```bash
cd ~/Size24_erp && git pull origin main
cd erp-system/backend
```

This brings the `computeMonth`/`getMonthlyReport`/`exportReport` date fix and the new
`migrate_shops_geofence_radius.sql` (now wired into `server.js`'s boot auto-migrations).

## 2. Fix table ownership (superuser step — this is why migrations have been silently failing)

Your logs show:
```
must be owner of table permission_actions
must be owner of table daily_entries
```
These tables were created/altered by `postgres` at some point (e.g. when we ran
`fix_action_permissions_schema.sql` via `sudo -u postgres psql`), so the app's own DB user
(`admin`, per `.env`) can't ALTER them — every boot's auto-migration against them fails
silently (caught and logged, doesn't crash the app, but never actually applies). Reassign
ownership of every table in the schema to `admin` so this stops recurring for any future
migration, not just these two:

```bash
sudo -u postgres psql -d size24 -c "
DO \$\$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I OWNER TO admin', r.tablename);
    END LOOP;
END \$\$;
"
```

This only changes ownership metadata — no data is touched. Safe to run even though most
tables are already owned by `admin`.

## 3. Apply the shops geofence column fix (also happens automatically on next restart, but run explicitly to confirm now)

```bash
sudo -u postgres psql -d size24 -f db/migrate_shops_geofence_radius.sql
```

## 4. Verify

```bash
sudo -u postgres psql -d size24 -c "SELECT column_name FROM information_schema.columns WHERE table_name='shops' AND column_name='geofence_radius_m';"
sudo -u postgres psql -d size24 -c "SELECT tableowner FROM pg_tables WHERE tablename IN ('permission_actions','daily_entries');"
```

Expect: the column row present; both tables owned by `admin`.

## 5. Restart backend

```bash
pm2 restart backend
pm2 status
```

Watch it stay `online` (not restart-looping) for ~30s.

## 6. Check logs — the two previously-failing auto-migrations should now succeed

```bash
pm2 logs backend --lines 60 --nostream
```

Expect to see `[migrate] Entries action-permissions ready`, `[migrate] Payment In fields
ready`, and `[migrate] shops.geofence_radius_m ready` — no more "must be owner of table" or
"date/time field value out of range" lines.

## 7. Test in the browser / curl

- Reload **My Attendance** — the "Attendance unavailable" error should be gone and you
  should be able to punch in.
- Admin → Attendance → Assignments and Payroll should load without the
  `geofence_radius_m does not exist` error.

```bash
for ep in "attendance/me/monthly" "attendance/assignments" "attendance/payroll?month=2026-09"; do
  echo -n "$ep -> "
  curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer TOKEN" "http://localhost:5000/api/$ep"
done
```

All should return `200`.

---

Paste back the output of steps 4 and 6 (and any non-200 curl codes) if anything still
fails — with real logs like the ones you already gave me, I can pinpoint exact bugs instead
of guessing.
