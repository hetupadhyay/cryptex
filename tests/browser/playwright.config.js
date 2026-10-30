// The site in Chromium, served by tools/dev.js with the headers from
// vercel.json, so the security policy is the one visitors get, and with
// the account API on an in-memory database.
const { defineConfig } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: '.',
  timeout: 60000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: 'chromium',
    // Animations finish at once, so each check sees the end state.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node tools/dev.js ${PORT}`,
    cwd: '../..',
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    // The server's own log would only clutter the test report.
    stderr: 'ignore',
  },
});
