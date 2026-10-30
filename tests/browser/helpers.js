// Collects anything that went wrong on a page: script errors, console
// errors, requests blocked by the security policy, and requests to any
// other site.
function watch(page, baseURL) {
  const problems = [];
  page.on('pageerror', e => problems.push(`script error: ${e.message}`));
  page.on('console', m => {
    const text = m.text();
    // The 404 page is served with a 404 status, which Chromium logs.
    if (m.type() === 'error' && !/status of 404/.test(text)) problems.push(`console: ${text}`);
  });
  page.on('request', r => {
    const url = r.url();
    if (!url.startsWith(baseURL) && !url.startsWith('data:') && !url.startsWith('blob:')) problems.push(`external request: ${url}`);
  });
  page.on('requestfailed', r => {
    // Background loads cut short by the next navigation aren't failures.
    if (!/ERR_ABORTED/.test(r.failure()?.errorText || '')) problems.push(`failed: ${r.url()}`);
  });
  return problems;
}

// A secret link's fragment, built the way js/share.js builds one.
function secret(payload) {
  return '#secret=' + Buffer.from(JSON.stringify(payload)).toString('base64url');
}

module.exports = { watch, secret };
