const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const source = readFileSync(join(__dirname, '../public/assets/js/main.js'), 'utf8');
const start = source.indexOf('  function printActiveReport() {');
const end = source.indexOf('  function loading() {', start);
assert.ok(start >= 0 && end > start);

test('patient printing fetches the authorized report without a frame or new tab', async () => {
  const helperStart = source.indexOf('  async function printInPlace(');
  assert.ok(helperStart >= 0 && helperStart < start);
  let printed = false;
  let removed = false;
  let afterprint;
  let requestedUrl;
  let requestedOptions;
  const root = {
    id: '', append(report) { this.report = report; }, remove() { removed = true; },
  };
  const styles = { id: '', textContent: '', remove() {} };
  const document = {
    title: 'Clinic', fonts: { ready: Promise.resolve() },
    querySelector() { return null; },
    createElement(tag) { assert.notEqual(tag, 'iframe'); return tag === 'style' ? styles : root; },
    importNode(report) { return report; },
    body: { append() {} }, head: { append() {} },
  };
  const window = {
    addEventListener(name, callback) { if (name === 'afterprint') afterprint = callback; },
    print() { printed = true; afterprint(); },
  };
  const fetch = async (url, options) => {
    requestedUrl = url; requestedOptions = options;
    return { ok: true, text: async () => '<main class="sheet">Authorized result</main>' };
  };
  class DOMParser {
    parseFromString() { return { title: 'Laboratory Result', querySelector() { return { textContent: 'Authorized result' }; } }; }
  }
  const print = new Function('document', 'window', 'fetch', 'DOMParser', `${source.slice(helperStart, start)}; return printInPlace;`)(document, window, fetch, DOMParser);
  await print({ url: '/api/index.php?action=download_result_details&id=7', selector: 'main.sheet' });
  assert.match(requestedUrl, /download_result_details/);
  assert.equal(requestedOptions.credentials, 'same-origin');
  assert.equal(printed, true);
  assert.equal(removed, true);
  assert.equal(root.report.textContent, 'Authorized result');
  assert.match(styles.textContent, /main\.print-sheet\.reports-workspace,#clinic-print-root #report-view/);
  assert.match(styles.textContent, /\.utilization-chart-scroll,#clinic-print-root \.report-data>div\{overflow:visible!important/);
});

test('the reports export opens printable HTML for the selected view', () => {
  let printJob;
  const report = {
    querySelectorAll() { return []; },
    cloneNode() { return { innerHTML: '<section><h2>Laboratory Utilization</h2><table><tr><td>7 requests</td></tr></table></section>', querySelectorAll() { return []; } }; },
  };
  const print = new Function('$', 'currentUser', 'state', 'location', 'reportViews', 'document', 'ASSET_BASE', 'h', 'appName', 'toast', 'printInPlace', `${source.slice(start, end)}; return printActiveReport;`)(
    () => report,
    { role: 'Admin' },
    { page: 'reports' },
    { search: '?report=utilization' },
    [['trends', 'Trend Analysis'], ['utilization', 'Laboratory Utilization']],
    { baseURI: 'http://127.0.0.1:8000/public/admin/reports.php' },
    '../assets',
    (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
    () => 'Clinic',
    () => {},
    async (job) => { printJob = job; },
  );
  print();
  assert.equal(printJob.selector, 'main.print-sheet');
  assert.match(printJob.html, /<title>Laboratory Utilization \| Laboratory Report<\/title>/);
  assert.match(printJob.html, /<table><tr><td>7 requests<\/td><\/tr><\/table>/);
  assert.doesNotMatch(printJob.html, /window\.open|application\/json|clinic-records.*\.json/);
});
