import { test, expect } from '@playwright/test';

const ADMIN = { mobile: '8817654579', password: 'admin@123' };
const SHOP_USER = { mobile: '9975444449', password: 'user@123' };

test.describe('Auth — Login Page', () => {
  test('login page loads with no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('root redirects to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows validation error for empty submit', async ({ page }) => {
    await page.goto('/login');
    const submitBtn = page.getByRole('button', { name: /login|sign in|submit/i });
    await submitBtn.click();
    // Either HTML5 validation or inline error message
    const invalid = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input:invalid');
      return inputs.length > 0;
    });
    const hasError = await page.locator('text=/required|invalid|enter/i').isVisible().catch(() => false);
    expect(invalid || hasError).toBeTruthy();
  });

  test('shows error for wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="tel"], input[name="mobile"], input[placeholder*="mobile" i], input[placeholder*="phone" i]').first().fill('9999999999');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.getByRole('button', { name: /login|sign in|submit/i }).click();
    await expect(page.locator('text=/invalid|incorrect|error/i')).toBeVisible({ timeout: 8000 });
  });

  test('admin login succeeds and redirects to /admin', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="tel"], input[name="mobile"], input[placeholder*="mobile" i], input[placeholder*="phone" i]').first().fill(ADMIN.mobile);
    await page.locator('input[type="password"]').fill(ADMIN.password);
    await page.getByRole('button', { name: /login|sign in|submit/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
  });

  test('shop_user login succeeds and redirects to /shop', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="tel"], input[name="mobile"], input[placeholder*="mobile" i], input[placeholder*="phone" i]').first().fill(SHOP_USER.mobile);
    await page.locator('input[type="password"]').fill(SHOP_USER.password);
    await page.getByRole('button', { name: /login|sign in|submit/i }).click();
    await expect(page).toHaveURL(/\/shop/, { timeout: 10000 });
  });

  test('protected route redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Auth — Signup Page', () => {
  test('signup page loads', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/signup');
    await expect(page).toHaveURL(/\/signup/);
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});
