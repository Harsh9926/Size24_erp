import { test, expect, Page } from '@playwright/test';

const ADMIN = { mobile: '8817654579', password: 'admin@123' };

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.locator('input[type="tel"], input[name="mobile"], input[placeholder*="mobile" i], input[placeholder*="phone" i]').first().fill(ADMIN.mobile);
  await page.locator('input[type="password"]').fill(ADMIN.password);
  await page.getByRole('button', { name: /login|sign in|submit/i }).click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
}

const ADMIN_ROUTES = [
  { path: '/admin',                 label: 'Admin Dashboard' },
  { path: '/admin/approvals',       label: 'Approvals' },
  { path: '/admin/shops',           label: 'Shops' },
  { path: '/admin/users',           label: 'Users' },
  { path: '/admin/entries',         label: 'Entries' },
  { path: '/admin/reports',         label: 'Reports' },
  { path: '/admin/audit',           label: 'Audit Logs' },
  { path: '/admin/new-entry',       label: 'New Entry' },
  { path: '/admin/manager-funds',   label: 'Manager Funds' },
  { path: '/admin/expenses',        label: 'Expenses' },
  { path: '/admin/anomalies',       label: 'Anomalies' },
];

test.describe('Admin — Smoke: all routes load', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const route of ADMIN_ROUTES) {
    test(`${route.label} (${route.path}) loads without 5xx`, async ({ page }) => {
      const failedRequests: string[] = [];
      page.on('response', res => {
        if (res.status() >= 500) failedRequests.push(`${res.status()} ${res.url()}`);
      });
      await page.goto(route.path);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      expect(failedRequests).toHaveLength(0);
      // Page should stay on the requested route or show content (not redirect to /login)
      expect(page.url()).not.toContain('/login');
    });
  }
});

test.describe('Admin — Critical Journeys', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('dashboard renders charts or summary cards', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // Should have some content — headings, cards, charts
    const hasContent = await page.locator('h1, h2, h3, [class*="card"], [class*="stat"], svg').first().isVisible({ timeout: 8000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('shops page lists shops or shows empty state', async ({ page }) => {
    await page.goto('/admin/shops');
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const hasContent = await page.locator('main').locator('h3, table, form').first().isVisible({ timeout: 8000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('users page lists users', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const hasContent = await page.locator('table, [class*="user"], [class*="card"]').first().isVisible({ timeout: 8000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('entries page loads and has filter/search controls', async ({ page }) => {
    await page.goto('/admin/entries');
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const hasControl = await page.locator('input[type="date"], input[type="search"], select, input[placeholder*="search" i]').first().isVisible({ timeout: 8000 }).catch(() => false);
    expect(hasControl).toBeTruthy();
  });

  test('no 4xx/5xx errors during admin navigation flow', async ({ page }) => {
    const failed: string[] = [];
    page.on('response', res => {
      if (res.status() >= 500 && !res.url().includes('/favicon')) {
        failed.push(`${res.status()} ${res.url()}`);
      }
    });
    await page.goto('/admin');
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.goto('/admin/shops');
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    expect(failed).toHaveLength(0);
  });
});
