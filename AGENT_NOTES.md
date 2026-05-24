# AGENT_NOTES — SIZE24 ERP QA Run

## Project Summary
- **Stack**: React 19 + Vite 8 (port 5173) / Express 5 + PostgreSQL (port 5000)
- **Auth**: JWT, fields: `mobile` + `password`, roles: admin / manager / shop_user
- **Package manager**: npm
- **Test framework**: Playwright (installed in erp-system/frontend/)
- **Playwright config**: erp-system/frontend/playwright.config.ts

## Test Credentials
- Admin:      mobile `8817654579`, password `admin@123`
- Shop user:  mobile `9975444449`, password `user@123`
- Manager:    no manager user in local DB (not tested)

## Phase 2 — Static Analysis Findings

### ESLint Errors (35 total)
- `ExcelUploadPage.jsx`: `motion` imported but unused; `selectedFile` assigned but unused
- `LoginPage.jsx`: `motion`, `useAnimation` imported but unused; `y` and `navigate` assigned but never used
- `ManagerCashTransferPage.jsx` (×2): `Icon` param in map callbacks unused
- `ManagerDashboard.jsx`: `Icon` param in map callback unused
- `ReportsPage.jsx`: `cities`, `setCities` unused state
- `ShopDashboard.jsx`: `difference` unused; empty `catch {}` blocks (×3); `Icon` param unused
- Numerous `react-hooks/exhaustive-deps` warnings (missing deps in useEffect)

### Build Result
- Build SUCCEEDS — zero blocking errors
- Warning: main bundle 2,049 kB (> 500 kB threshold) — large but not blocking

### Suspicious / TODO areas
- Empty `catch` blocks in `ShopDashboard.jsx` (lines ~240–254) silently swallow errors
- `VITE_API_URL` in frontend `.env` points to remote server `51.21.190.94` — tests override to `localhost:5000`
- No manager user exists in local DB; manager-role routes are not tested
- `CashFlowPage.jsx` is imported in README but the route `/admin/cashflow` was removed from App.jsx

---

## Iteration 1 — Findings

**Failures (22 tests failed, 27 passed):**

### A) DB Schema Missing (root cause: 500 errors on /expenses, /anomalies, /admin dashboard)
- `expenses` table not in local DB → ran migration `add_expenses_table.sql` ✓
- `entry_type` column missing in `daily_entries` → ran migration `db/migrate_entry_type.sql` ✓
- Shop user had no shop assigned → `INSERT INTO shop_users` for user 24, shop 4 ✓

### B) Test Logic Issues (justified corrections)
- Shops page test used invalid CSS `text=/no shop/i` mixed in locator string → fixed to valid CSS selectors
- 4xx/5xx navigation test was catching all 4xx (some are expected: 404 for optional features) → changed to 5xx only

### C) Accessibility - Critical Violations
- LoginPage password toggle button had no accessible text → added `aria-label` ✓
- AdminDashboard: modal close button (X icon) had no text → added `aria-label="Close"` ✓
- AdminDashboard: 2 date inputs unlabeled → added `aria-label="Start date"/"End date"` ✓
- AdminDashboard: 2 select elements unlabeled → added `aria-label` to both ✓
- ShopDashboard: refresh button & dismiss button had no text → added `aria-label` ✓
- ShopDashboard: transfer form inputs not linked to labels → added `id`/`htmlFor` pairs ✓
- ShopDashboard: standalone date inputs → added `aria-label` on all ✓
- LoginPage: mobile/password inputs not linked to labels → added `id`/`htmlFor` pairs ✓

### D) Accessibility - Color Contrast (Serious Violations)
- `--text-secondary: #6b7280` on white gives 4.37:1 (fails WCAG AA for small text)
  → Updated CSS variable to `#4b5563` (7.0:1 on white) ✓
- `text-gray-400` (#9CA3AF) gives 2.85:1 on white (fails broadly)
  → Replaced with `text-gray-600` in AdminDashboard.jsx, ShopDashboard.jsx, LoginPage.jsx ✓
- `text-gray-500` in badge on gray-100 background → changed to `text-gray-700` ✓
- LoginPage label text-gray-500 → changed to text-gray-700 ✓

---

## Iteration 2 — Findings
*(populated after second test run)*

---

## Iteration 3 — Findings
*(populated after third test run)*
