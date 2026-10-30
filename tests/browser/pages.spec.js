// Every page, in day and night, from a desktop down to a small phone.
const { test, expect } = require('@playwright/test');
const { watch } = require('./helpers');

const PAGES = ['/', '/learn', '/lab', '/codebreaking', '/terms', '/privacy', '/signin', '/reset', '/no-such-page'];
const SIZES = [{ width: 1280, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 640 }];

for (const size of SIZES) {
  for (const theme of ['day', 'night']) {
    test(`pages load cleanly at ${size.width}px in ${theme}`, async ({ page, baseURL }) => {
      await page.setViewportSize(size);
      await page.addInitScript(t => localStorage.setItem('cryptex-theme', t), theme);
      const problems = watch(page, baseURL);
      for (const path of PAGES) {
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        expect(sideways, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
      }
      expect(problems).toEqual([]);
    });
  }
}

test('an unknown address gets the 404 page', async ({ page }) => {
  const response = await page.goto('/no-such-page');
  expect(response.status()).toBe(404);
  await expect(page).toHaveTitle(/not found/i);
});
