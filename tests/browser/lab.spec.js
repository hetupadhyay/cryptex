// The lab: every cipher there and back, at a desktop width and on a phone.
const { test, expect } = require('@playwright/test');
const { watch } = require('./helpers');

const MESSAGE = 'Meet me by the old mill at noon';

// What the cipher gives for this text with the keys the lab starts with.
function expected(page, id, mode, text) {
  return page.evaluate(([id, mode, text]) => {
    const c = Ciphers.byId(id);
    const keys = Object.fromEntries(c.keys.map(k => [k.id, k.value]));
    return c[mode](text, keys);
  }, [id, mode, text]);
}

async function runTo(page, mode, text) {
  if ((await page.locator('.lever').getAttribute('data-mode')) !== mode) await page.click('.lever-btn');
  await page.fill('#message', text);
  await page.click('.run');
  await page.click('[data-act="end"]');
}

test('every cipher encrypts and decrypts back', async ({ page, baseURL }) => {
  const problems = watch(page, baseURL);
  await page.goto('/lab');
  const ids = await page.evaluate(() => Ciphers.list.map(c => c.id));
  expect(ids).toHaveLength(10);
  for (const id of ids) {
    await page.click(`#codebook-list [data-id="${id}"]`);
    const cipher = await expected(page, id, 'encrypt', MESSAGE);
    await runTo(page, 'encrypt', MESSAGE);
    await expect(page.locator('.result-text'), `${id} encrypt`).toHaveText(cipher);
    const plain = await expected(page, id, 'decrypt', cipher);
    await runTo(page, 'decrypt', cipher);
    await expect(page.locator('.result-text'), `${id} decrypt`).toHaveText(plain);
  }
  expect(problems).toEqual([]);
});

test('on a phone the codebook opens as a sheet and the board fits', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/lab');
  await page.click('.cipher-btn');
  await page.click('#codebook-sheet-list [data-id="vigenere"]');
  await expect(page.locator('.stage-title')).toHaveText('Vigenère');
  await runTo(page, 'encrypt', MESSAGE);
  await expect(page.locator('.result-text')).toHaveText(await expected(page, 'vigenere', 'encrypt', MESSAGE));
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test('a bad key is marked on its own field', async ({ page }) => {
  await page.goto('/lab');
  await page.click('#codebook-list [data-id="affine"]');
  await page.fill('#key-affine-b', '99');
  await page.fill('#message', 'hello');
  await page.click('.run');
  await expect(page.locator('#key-affine-b')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#key-affine-a')).toHaveAttribute('aria-invalid', 'false');
  await expect(page.locator('#key-affine-b')).toBeFocused();
  await expect(page.locator('#lab-error')).not.toBeEmpty();
});

test('a result goes to the desk, cut to what the desk holds', async ({ page }) => {
  await page.goto('/lab');
  await page.click('#codebook-list [data-id="polybius"]');
  await runTo(page, 'encrypt', 'attack at dawn '.repeat(600));
  await page.click('[data-act="attack"]');
  await page.waitForURL('**/codebreaking#desk');
  await expect(page.locator('#attack-text')).toHaveValue(/^[1-5 /]+$/);
  expect((await page.locator('#attack-text').inputValue()).length).toBe(20000);
});
