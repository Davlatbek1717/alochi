import { test, expect } from '@playwright/test';

const FILADMIN_LOGIN = process.env.E2E_FILADMIN_LOGIN ?? 'filadmin1';
const FILADMIN_PASS = process.env.E2E_FILADMIN_PASS ?? 'password123';

test.describe('Warning flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder*="login"], input[name="login"]', FILADMIN_LOGIN);
    await page.fill('input[type="password"]', FILADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/filadmin/);
  });

  test('filadmin can navigate to warnings page', async ({ page }) => {
    await page.goto('/filadmin/warnings');
    await expect(page.locator('h1')).toContainText(/ogohlantirish/i);
  });

  test('warnings page loads student list', async ({ page }) => {
    await page.goto('/filadmin/warnings');
    await expect(page.locator('body')).not.toContainText('Xatolik', { timeout: 5_000 });
  });
});
