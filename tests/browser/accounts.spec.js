// Accounts: optional, private until used, and progress that follows you.
const { test, expect } = require('@playwright/test');
const { watch } = require('./helpers');

const unique = () => `reader-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;

async function signUp(page, email, password = 'a strong passphrase') {
  await page.goto('/signin#signup');
  await page.fill('#auth-name', 'Ada');
  await page.fill('#auth-email', email);
  await page.fill('#auth-password', password);
  await page.click('#auth-form [type="submit"]');
  await page.waitForURL('**/account');
}

test('a visitor who never signs in makes no account requests', async ({ page }) => {
  const api = [];
  page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api/')) api.push(r.url()); });
  for (const path of ['/', '/learn', '/lab', '/codebreaking#missions', '/privacy']) await page.goto(path);
  await page.waitForTimeout(500);
  expect(api).toEqual([]);
  await expect(page.locator('.mast [data-account]')).toHaveText('Sign in');
});

test('signing up, cracking a mission, and finding it on another device', async ({ browser, baseURL }) => {
  const email = unique();
  const first = await browser.newContext();
  const page = await first.newPage();
  const problems = watch(page, baseURL);
  await signUp(page, email);
  await expect(page.locator('#account-who')).toHaveText('Ada');
  await expect(page.locator('.mast [data-account]')).toHaveText('A');

  await page.goto('/codebreaking#missions');
  await page.fill('#answer-input', 'The legion marches at dawn. Hold the river until we arrive.');
  await page.click('#file-missions .answer [type="submit"]');
  await expect(page.locator('.missions-count')).toContainText('1 of 8');
  await expect.poll(() => page.evaluate(async () => (await (await fetch('/api/progress')).json()).cracked)).toEqual(['rhine']);
  expect(problems).toEqual([]);
  await first.close();

  // A fresh browser: nothing saved here until signing in.
  const second = await browser.newContext();
  const other = await second.newPage();
  await other.goto('/signin');
  await other.fill('#auth-email', email);
  await other.fill('#auth-password', 'a strong passphrase');
  await other.click('#auth-form [type="submit"]');
  await other.waitForURL('**/account');
  await expect(other.locator('#account-progress')).toContainText('1 of 8 missions cracked');
  await other.goto('/codebreaking#missions');
  await expect(other.locator('.missions-count')).toContainText('1 of 8');
  await second.close();
});

test('a wrong password is explained and marked', async ({ page }) => {
  const email = unique();
  await signUp(page, email);
  await page.click('[data-act="logout"]');
  await page.waitForURL(url => url.pathname === '/');
  await expect(page.locator('.mast [data-account]')).toHaveText('Sign in');

  await page.goto('/signin');
  await page.fill('#auth-email', email);
  await page.fill('#auth-password', 'not the password');
  await page.click('#auth-form [type="submit"]');
  await expect(page.locator('#auth-error')).toContainText('don’t match');
  await expect(page.locator('#auth-password')).toHaveAttribute('aria-invalid', 'true');
});

test('the account page needs you to be signed in', async ({ page }) => {
  await page.goto('/account');
  await page.waitForURL('**/signin?next=/account');
  await expect(page.locator('#auth-title')).toHaveText('Sign in');
});

test('an account can be deleted from its page', async ({ page }) => {
  const email = unique();
  await signUp(page, email);
  await page.fill('#delete-confirm', 'nope');
  await page.click('#delete-form [type="submit"]');
  await expect(page.locator('#delete-error')).not.toBeEmpty();
  await page.fill('#delete-confirm', 'delete');
  await page.click('#delete-form [type="submit"]');
  await page.waitForURL(url => url.pathname === '/');
  const me = await page.evaluate(async () => (await (await fetch('/api/me')).json()).user);
  expect(me).toBeNull();
});

test('on a phone, the menu leads to signing in', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.click('.menu-btn');
  await expect(page.locator('#menu [data-account-menu]')).toContainText('Sign in');
  await page.click('#menu [data-account-menu]');
  await page.waitForURL('**/signin');
});
