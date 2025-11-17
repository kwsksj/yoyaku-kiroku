/**
 * E2E tests for login functionality
 */

import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for the application to load
    await page.waitForLoadState('networkidle');
  });

  test('should display login form on initial load', async ({ page }) => {
    // Check for login form elements
    const phoneInput = page.locator('input[type="tel"]').first();
    await expect(phoneInput).toBeVisible();

    // Check for login button
    const loginButton = page.locator('button:has-text("ログイン")').first();
    await expect(loginButton).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    // Enter phone number
    const phoneInput = page.locator('input[type="tel"]').first();
    await phoneInput.fill('090-1234-5678');

    // Click login button
    const loginButton = page.locator('button:has-text("ログイン")').first();
    await loginButton.click();

    // Wait for navigation/state change
    await page.waitForTimeout(500);

    // Should see dashboard or user-specific content
    // This will depend on your actual UI implementation
    // Example: Check for user name or dashboard elements
    await expect(page.locator('text=テスト太郎')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should show error for invalid phone number', async ({ page }) => {
    // Enter invalid phone number
    const phoneInput = page.locator('input[type="tel"]').first();
    await phoneInput.fill('999-9999-9999');

    // Click login button
    const loginButton = page.locator('button:has-text("ログイン")').first();
    await loginButton.click();

    // Wait for error message
    await page.waitForTimeout(500);

    // Should see error message
    // Adjust selector based on your actual error display
    const errorMessage = page.locator('text=/ユーザーが見つかりません|登録されていません/');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should handle phone number formatting', async ({ page }) => {
    // Enter phone without hyphens
    const phoneInput = page.locator('input[type="tel"]').first();
    await phoneInput.fill('09012345678');

    // Click login button
    const loginButton = page.locator('button:has-text("ログイン")').first();
    await loginButton.click();

    // Should still login successfully
    await page.waitForTimeout(500);
    await expect(page.locator('text=テスト太郎')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should navigate to registration form', async ({ page }) => {
    // Look for registration link/button
    const registerLink = page.locator('text=/新規登録|アカウント作成/').first();

    if (await registerLink.isVisible()) {
      await registerLink.click();

      // Should see registration form
      await expect(page.locator('input[name="name"]')).toBeVisible({
        timeout: 5000,
      });
    }
  });
});

test.describe('Login - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should work on mobile viewport', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const phoneInput = page.locator('input[type="tel"]').first();
    await expect(phoneInput).toBeVisible();

    // Mobile-specific checks
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(375);
  });
});
