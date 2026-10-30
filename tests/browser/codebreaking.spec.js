// Codebreaking: the folder tabs, a mission from start to finish, and the desk.
const { test, expect } = require('@playwright/test');
const { watch } = require('./helpers');

test('the open folder is kept in the address', async ({ page }) => {
  await page.goto('/codebreaking');
  await expect(page.locator('#tab-today')).toHaveAttribute('aria-selected', 'true');
  await page.click('#tab-missions');
  await expect(page).toHaveURL(/#missions$/);
  await page.reload();
  await expect(page.locator('#tab-missions')).toHaveAttribute('aria-selected', 'true');

  // The skip link moves focus without losing the folder.
  await page.goto('/codebreaking#desk');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#desk$/);
  await expect(page.locator('#file-desk')).toBeVisible();
});

test('the first mission can be cracked, and stays cracked', async ({ page, baseURL }) => {
  const problems = watch(page, baseURL);
  await page.goto('/codebreaking#missions');
  const answer = page.locator('#answer-input');

  await answer.fill('not the answer');
  await page.click('#file-missions .answer [type="submit"]');
  await expect(answer).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#file-missions .answer-feedback')).toHaveClass(/wrong/);

  await answer.fill('The legion marches at dawn. Hold the river until we arrive.');
  await page.click('#file-missions .answer [type="submit"]');
  await expect(page.locator('#file-missions .answer-feedback')).toHaveClass(/right/);
  await expect(page.locator('.missions-count')).toContainText('1 of 8');

  await page.reload();
  await expect(page.locator('.missions-count')).toContainText('1 of 8');
  expect(problems).toEqual([]);
});

test('a mission sent to the desk opens the letter counts', async ({ page }) => {
  await page.goto('/codebreaking#missions');
  await page.click('#file-missions [data-act="to-desk"]');
  await expect(page).toHaveURL(/#desk$/);
  await expect(page.locator('.attack-tab[aria-selected="true"]')).toHaveAttribute('data-attack', 'freq');
  await expect(page.locator('#attack-text')).not.toHaveValue('');
});
