import { test, expect } from '@playwright/test';

const TABS = [
  'Faollik',
  'Darslar',
  'Filiallar',
  'Cohort',
  'Funnel',
  'Lifecycle',
  'Failures',
  'Markazlar',
];

test.describe('Superadmin analytics 8-tab dashboard', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !process.env.E2E_SUPERADMIN_LOGIN,
      'No superadmin test creds — set E2E_SUPERADMIN_LOGIN/PASSWORD',
    );
    await page.goto('/login');
    await page.fill(
      'input[placeholder*="login"], input[name="login"]',
      process.env.E2E_SUPERADMIN_LOGIN!,
    );
    await page.fill('input[type="password"]', process.env.E2E_SUPERADMIN_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/superadmin**', { timeout: 10_000 });
    await page.goto('/superadmin/analytics');
  });

  for (const tab of TABS) {
    test(`renders ${tab} tab without console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      await page.click(`button:has-text("${tab}")`);
      await page.waitForLoadState('networkidle');
      const hasChart = await page.locator('svg, table').count();
      expect(hasChart).toBeGreaterThan(0);
      expect(
        errors,
        `Console errors on ${tab} tab: ${errors.join(', ')}`,
      ).toHaveLength(0);
    });
  }

  test('filadmin gets 403 on comparison endpoint', async ({ request }) => {
    test.skip(!process.env.E2E_FILADMIN_TOKEN, 'No filadmin test token');
    const apiBase = process.env.E2E_API_BASE ?? 'http://localhost:3001';
    const res = await request.get(`${apiBase}/analytics/comparison`, {
      headers: { Authorization: `Bearer ${process.env.E2E_FILADMIN_TOKEN}` },
    });
    expect(res.status()).toBe(403);
  });
});
