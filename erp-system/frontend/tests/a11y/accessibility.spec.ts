import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ADMIN = { mobile: '8817654579', password: 'admin@123' };
const SHOP_USER = { mobile: '9975444449', password: 'user@123' };

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

async function runAxe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  if (serious.length > 0) {
    const summary = serious.map(v => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`).join('\n');
    console.log('Axe violations:\n' + summary);
  }
  return serious;
}

test.describe('Accessibility — Login Page', () => {
  test('no serious/critical axe violations on /login', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const violations = await runAxe(page);
    expect(violations).toHaveLength(0);
  });
});

test.describe('Accessibility — Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('no serious/critical axe violations on /admin', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const violations = await runAxe(page);
    expect(violations).toHaveLength(0);
  });
});

test.describe('Accessibility — Shop Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsShopUser(page);
  });

  test('no serious/critical axe violations on /shop', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const violations = await runAxe(page);
    expect(violations).toHaveLength(0);
  });
});
