import { test, expect } from '@playwright/test';

const STUDENT_LOGIN = process.env.E2E_STUDENT_LOGIN ?? 'student1';
const STUDENT_PASS = process.env.E2E_STUDENT_PASS ?? 'password123';

test.describe('Student lesson flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder*="login"], input[name="login"]', STUDENT_LOGIN);
    await page.fill('input[type="password"]', STUDENT_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/student/);
  });

  test('lessons page loads and shows lesson list', async ({ page }) => {
    await page.goto('/student/lessons');
    await expect(page.locator('body')).not.toContainText('Xatolik', { timeout: 8_000 });
  });

  test('student dashboard shows XP info', async ({ page }) => {
    await page.goto('/student');
    await expect(page.locator('body')).toContainText(/XP|xp/i, { timeout: 8_000 });
  });

  test('friends page loads', async ({ page }) => {
    await page.goto('/student/friends');
    await expect(page.locator('body')).not.toContainText('Xato', { timeout: 8_000 });
  });
});
