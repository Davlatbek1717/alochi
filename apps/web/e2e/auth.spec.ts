import { test, expect } from '@playwright/test';

const STUDENT_LOGIN = process.env.E2E_STUDENT_LOGIN ?? 'student1';
const STUDENT_PASS = process.env.E2E_STUDENT_PASS ?? 'password123';
const MENTOR_LOGIN = process.env.E2E_MENTOR_LOGIN ?? 'mentor1';
const MENTOR_PASS = process.env.E2E_MENTOR_PASS ?? 'password123';

test.describe('Authentication', () => {
  test('login redirects to /login when no token', async ({ page }) => {
    await page.goto('/student');
    await expect(page).toHaveURL(/login/);
  });

  test('student login → redirects to student dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder*="login"], input[name="login"]', STUDENT_LOGIN);
    await page.fill('input[type="password"]', STUDENT_PASS);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/student/, { timeout: 10_000 });
  });

  test('mentor login → redirects to mentor dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder*="login"], input[name="login"]', MENTOR_LOGIN);
    await page.fill('input[type="password"]', MENTOR_PASS);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/mentor/, { timeout: 10_000 });
  });

  test('logout clears session', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder*="login"], input[name="login"]', STUDENT_LOGIN);
    await page.fill('input[type="password"]', STUDENT_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/student/);
    await page.click('button:has-text("Chiqish")');
    await expect(page).toHaveURL(/login/);
  });
});
