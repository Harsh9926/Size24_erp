import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const ADMIN = { mobile: '8817654579', password: 'admin@123' };
const SHOP_USER = { mobile: '9975444449', password: 'user@123' };

const VIEWPORTS = [
  { name: 'mobile',  width: 375,  height: 667  },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'desktop', width: 1440, height: 900  },
];

const SCREENSHOTS_DIR = path.join(process.cwd(), 'test-results', 'screenshots');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.locator('input[type="tel"], input[name="mobile"], input[placeholder*="mobile" i], input[placeholder*="phone" i]').first().fill(ADMIN.mobile);
  await page.locator('input[type="password"]').fill(ADMIN.password);
  await page.getByRole('button', { name: /login|sign in|submit/i }).click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
}

async function loginAsShopUser(page: Page) {
  await page.goto('/login');
  await page.locator('input[type="tel"], input[name="mobile"], input[placeholder*="mobile" i], input[placeholder*="phone" i]').first().fill(SHOP_USER.mobile);
  await page.locator('input[type="password"]').fill(SHOP_USER.password);
  await page.getByRole('button', { name: /login|sign in|submit/i }).click();
  await expect(page).toHaveURL(/\/shop/, { timeout: 10000 });
}

const ROUTES_TO_SCREENSHOT = [
  { path: '/login',   auth: 'none' as const },
  { path: '/signup',  auth: 'none' as const },
  { path: '/admin',   auth: 'admin' as const },
  { path: '/admin/shops',    auth: 'admin' as const },
  { path: '/admin/entries',  auth: 'admin' as const },
  { path: '/shop',    auth: 'shop' as const },
];

for (const viewport of VIEWPORTS) {
  for (const route of ROUTES_TO_SCREENSHOT) {
    test(`screenshot: ${route.path} @ ${viewport.name} (${viewport.width}×${viewport.height})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      ensureDir(SCREENSHOTS_DIR);

      if (route.auth === 'admin') {
        await loginAsAdmin(page);
      } else if (route.auth === 'shop') {
        await loginAsShopUser(page);
      }

      await page.goto(route.path);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      // small extra settle time for charts/animations
      await page.waitForTimeout(800);

      const slug = route.path.replace(/\//g, '__').replace(/^__/, '') || 'root';
      const filename = `${slug}__${viewport.name}.png`;
      const filepath = path.join(SCREENSHOTS_DIR, filename);
      await page.screenshot({ path: filepath, fullPage: true });
      expect(fs.existsSync(filepath)).toBeTruthy();
    });
  }
}
