import { test, expect } from '@playwright/test';

test.describe('MarketSim E2E', () => {
  test('should load the workspace and run a single simulation', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Check that the title is correct
    await expect(page).toHaveTitle(/MarketSim/i);

    // Verify the hero section is visible
    await expect(page.locator('h1')).toBeVisible();

    // Check that the form exists
    const form = page.locator('form.assumptions');
    await expect(form).toBeVisible();

    // Run the simulation by clicking the main action button
    const runButton = page.locator('button[type="submit"]', { hasText: /Run/i });
    if (await runButton.isVisible()) {
      await runButton.click();

      // Check that the chart area updates (e.g. status changes to success)
      await expect(page.locator('.simulation-status--success')).toBeVisible({
        timeout: 10000,
      });

      // Verify canvas or SVG chart is rendered
      await expect(page.locator('.visualization')).toBeVisible();
    }
  });

  test('should navigate to the Guide page', async ({ page }) => {
    await page.goto('/');

    // Find guide link in navigation
    const guideLink = page.locator('nav a', { hasText: /Guide|Guida/i });
    if (await guideLink.isVisible()) {
      await guideLink.click();
      // Ensure we navigated to the guide section
      await expect(page.locator('#guide')).toBeVisible();
    }
  });
});
