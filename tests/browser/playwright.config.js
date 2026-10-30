// The site in Chromium, served by tools/serve.py with the headers from
// vercel.json, so the security policy is the one visitors get.
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
    command: `python3 tools/serve.py . ${PORT}`,
    cwd: '../..',
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    // Requests cut short by the next page show up as broken pipes; that's noise.
    stderr: 'ignore',
  },
});
