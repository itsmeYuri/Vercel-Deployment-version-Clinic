const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('public/assets/js/main.js', 'utf8');
const start = source.indexOf('  async function api(');
const end = source.indexOf('\n  }', start) + 4;
function client(fetch) {
  return vm.runInNewContext(source.slice(start, end) + '\napi;', {
    fetch, AbortController, setTimeout, clearTimeout, API_URL: '/api/index.php',
    window: { CLINIC_CSRF_TOKEN: 'test' }, document: { querySelector: () => null }, location: {},
  });
}
test('timeout covers a stalled response body after headers arrive', async () => {
  const api = client(async (_url, { signal }) => ({ text: () => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  }) }));
  await assert.rejects(api('app_data', {}, 25), /took too long/);
});
test('successful response still returns data', async () => {
  const api = client(async () => ({ ok: true, text: async () => JSON.stringify({ success: true, data: { ready: true } }) }));
  assert.equal((await api('app_data')).ready, true);
});
test('HTTP errors preserve status for authentication handling', async () => {
  const api = client(async () => ({ ok: false, status: 401, text: async () => JSON.stringify({ success: false, message: 'Session expired' }) }));
  await assert.rejects(api('app_data'), error => error.status === 401);
});
