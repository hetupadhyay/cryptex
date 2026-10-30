// What every page shares: the lamp, the phone menu, secret links and
// working offline.
const { test, expect } = require('@playwright/test');
const { secret } = require('./helpers');

test('the lamp switches to night and remembers it', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('seen')) { localStorage.setItem('cryptex-theme', 'day'); sessionStorage.setItem('seen', '1'); } });
  await page.goto('/');
  await page.click('.mast .lamp');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await expect(page.locator('.mast .lamp')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', '#0e1418');
  await page.goto('/learn');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
});

test('the phone menu opens, and closes with Escape or by tabbing out', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/learn');
  const button = page.locator('.menu-btn');
  const menu = page.locator('#menu');

  await button.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(button).toBeFocused();

  await button.click();
  await menu.locator('a').last().focus();
  await page.keyboard.press('Tab');
  await expect(menu).toBeHidden();
});

test('a secret link opens and decrypts in the lab', async ({ page }) => {
  // An old link to Home is sent on to the lab, which clears it from the
  // address once it's read.
  await page.goto('/' + secret({ c: 'caesar', t: 'KHOOR ZRUOG', k: '3' }));
  await page.waitForURL(/\/lab$/);
  const dialog = page.locator('.secret-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.secret-text')).toHaveText('KHOOR ZRUOG');
  await dialog.locator('[data-act="secret-lab"]').click();
  await page.click('[data-act="end"]');
  await expect(page.locator('.result-text')).toHaveText('HELLO WORLD');
});

test('a tampered secret link is refused', async ({ page }) => {
  await page.goto('/lab#secret=not-a-real-link');
  await expect(page.locator('.secret-dialog')).toBeHidden();
  await expect(page).not.toHaveURL(/secret=/);
});

test('after one visit every page opens offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Wait until the whole release is in the cache.
  await expect.poll(() => page.evaluate(async () => {
    const [name] = await caches.keys();
    return name ? (await (await caches.open(name)).keys()).length : 0;
  }), { timeout: 20000 }).toBeGreaterThan(40);

  await context.setOffline(true);
  for (const [path, title] of [['/learn', /History of ciphers/], ['/lab', /lab/i], ['/codebreaking#desk', /Codebreaking/], ['/no-such-page', /not found/i]]) {
    await page.goto(path);
    await expect(page, path).toHaveTitle(title);
    // Styled, so the stylesheet came from the cache too.
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Hanken Grotesk');
  }
  await context.setOffline(false);
});
