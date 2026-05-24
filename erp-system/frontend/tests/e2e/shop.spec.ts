import { test, expect, Page } from '@playwright/test';

const SHOP_USER = { mobile: '9975444449', password: 'user@123' };

async function loginAsShopUser(page: Page) {
  await page.goto('/login');
  await page.locator('input[type="tel"], input[name="mobile"], input[placeholder*="mobile" i], input[placeholder*="phone" i]').first().fill(SHOP_USER.mobile);
  await page.locator('input[type="password"]').fill(SHOP_USER.password);
  await page.getByRole('button', { name: /login|sign in|submit/i }).click();
  await expect(page).toHaveURL(/\/shop/, { timeout: 10000 });
}

test.describe('Shop User — Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsShopUser(page);
  });

  test('shop dashboard loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/shop');
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    expect(errors.filter(e => !e.includes('favicon') && !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('shop dashboard renders content', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const hasContent = await page.locator('h1, h2, h3, [class*="card"], [class*="balance"]').first().isVisible({ timeout: 8000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('shop user cannot access admin routes', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login|\/shop/);
  });

  test('excel upload page loads for shop_user', async ({ page }) => {
    const failedRequests: string[] = [];
    page.on('response', res => {
      if (res.status() >= 500) failedRequests.push(`${res.status()} ${res.url()}`);
    });
    await page.goto('/admin/excel');
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    expect(failedRequests).toHaveLength(0);
    expect(page.url()).not.toContain('/login');
  });
});
