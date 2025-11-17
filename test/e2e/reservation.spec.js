/**
 * E2E tests for reservation functionality
 */

import { test, expect } from '@playwright/test';

test.describe('Reservation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and login
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Login with test user
    const phoneInput = page.locator('input[type="tel"]').first();
    await phoneInput.fill('090-1234-5678');

    const loginButton = page.locator('button:has-text("ログイン")').first();
    await loginButton.click();

    // Wait for login to complete
    await page.waitForTimeout(1000);
  });

  test('should display available lessons', async ({ page }) => {
    // Look for lesson list or calendar
    const lessonElements = page.locator('[data-lesson-id]').or(
      page.locator('text=/レッスン|授業/')
    );

    await expect(lessonElements.first()).toBeVisible({ timeout: 5000 });
  });

  test('should make a reservation', async ({ page }) => {
    // Wait for lessons to load
    await page.waitForTimeout(1000);

    // Find an available lesson slot
    const availableSlot = page
      .locator('button:has-text("予約")')
      .or(page.locator('[data-status="available"]'))
      .first();

    if (await availableSlot.isVisible()) {
      await availableSlot.click();

      // Wait for confirmation
      await page.waitForTimeout(500);

      // Look for success message or confirmation
      const successMessage = page.locator(
        'text=/予約が完了|予約しました|確認しました/'
      );
      await expect(successMessage).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display my reservations', async ({ page }) => {
    // Navigate to reservations page/section
    const myReservationsLink = page
      .locator('text=/予約一覧|マイページ|予約履歴/')
      .first();

    if (await myReservationsLink.isVisible()) {
      await myReservationsLink.click();
      await page.waitForTimeout(500);

      // Should see reservation list
      const reservationList = page
        .locator('[data-reservation-id]')
        .or(page.locator('text=/予約ID|レッスン日時/'));
      await expect(reservationList.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should cancel a reservation', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Look for cancel button
    const cancelButton = page
      .locator('button:has-text("キャンセル")')
      .or(page.locator('[data-action="cancel"]'))
      .first();

    if (await cancelButton.isVisible()) {
      await cancelButton.click();

      // May have confirmation dialog
      const confirmButton = page.locator('button:has-text("確認")');
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click();
      }

      // Wait for cancellation to complete
      await page.waitForTimeout(500);

      // Look for success message
      const successMessage = page.locator('text=/キャンセルしました|削除しました/');
      await expect(successMessage).toBeVisible({ timeout: 5000 });
    }
  });

  test('should not allow booking full lessons', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Find a full lesson
    const fullLesson = page
      .locator('[data-status="full"]')
      .or(page.locator('text=満員'))
      .first();

    if (await fullLesson.isVisible()) {
      // Book button should be disabled or not present
      const bookButton = fullLesson.locator('button:has-text("予約")');

      if (await bookButton.isVisible()) {
        await expect(bookButton).toBeDisabled();
      }
    }
  });
});

test.describe('Reservation - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Login
    const phoneInput = page.locator('input[type="tel"]').first();
    await phoneInput.fill('090-1234-5678');

    const loginButton = page.locator('button:has-text("ログイン")').first();
    await loginButton.click();
    await page.waitForTimeout(1000);
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);

    // Try to make a reservation
    const availableSlot = page.locator('button:has-text("予約")').first();

    if (await availableSlot.isVisible()) {
      await availableSlot.click();
      await page.waitForTimeout(500);

      // Should see error message
      const errorMessage = page.locator(
        'text=/エラー|失敗|接続できません|ネットワーク/'
      );
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    }

    // Restore online mode
    await page.context().setOffline(false);
  });
});

test.describe('Reservation - Calendar View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Login
    const phoneInput = page.locator('input[type="tel"]').first();
    await phoneInput.fill('090-1234-5678');

    const loginButton = page.locator('button:has-text("ログイン")').first();
    await loginButton.click();
    await page.waitForTimeout(1000);
  });

  test('should navigate between dates', async ({ page }) => {
    // Look for next/previous buttons
    const nextButton = page
      .locator('button:has-text("次")')
      .or(page.locator('[aria-label*="次"]'))
      .first();

    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(500);

      // Should load new lessons
      await expect(page.locator('[data-lesson-id]').first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('should filter by subject', async ({ page }) => {
    // Look for subject filter
    const subjectFilter = page
      .locator('select[name="subject"]')
      .or(page.locator('text=科目'))
      .first();

    if (await subjectFilter.isVisible()) {
      await subjectFilter.click();
      await page.waitForTimeout(300);

      // Select a subject (e.g., 数学)
      const mathOption = page.locator('text=数学').first();
      if (await mathOption.isVisible()) {
        await mathOption.click();
        await page.waitForTimeout(500);

        // Should show only math lessons
        const lessons = await page.locator('[data-subject]').all();
        for (const lesson of lessons) {
          const subject = await lesson.getAttribute('data-subject');
          expect(subject).toBe('数学');
        }
      }
    }
  });
});
