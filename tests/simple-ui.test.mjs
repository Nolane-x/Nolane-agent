import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('default UI is an outcome-first Obsidian-style agent workspace', async () => {
  const html = await read('ui/index.html');
  const css = await read('ui/style.css');
  assert.match(html, /id="agent-composer"/);
  assert.match(html, /id="home-view"/);
  assert.match(html, /id="task-view"/);
  assert.match(html, /id="activity-stream"/);
  assert.match(html, /id="inspector-panel"/);
  assert.match(html, /id="advanced-drawer"[^>]*hidden/);
  assert.match(html, /aria-label="Gửi nhiệm vụ cho Nolane Agent"/);
  assert.doesNotMatch(html, /id="events"|Mission intelligence|Evidence & events|id="repository-intelligence-center"/);
  assert.equal((html.match(/class="composer-input"/g) ?? []).length, 2, 'one home composer and one follow-up composer');
  assert.match(css, /--background-primary:\s*#1e1e1e/i);
  assert.match(css, /--interactive-accent:/i);
  assert.match(css, /\.activity-timeline/);
  assert.match(css, /@media\s*\(max-width:/);
});

test('simple UI wires outcome APIs and lazy-loads technical workroom', async () => {
  const app = await read('ui/app.js');
  for (const endpoint of ['/api/agent/runs', '/messages', '/pause', '/resume', '/stop', '/retry', '/autonomy']) {
    assert.match(app, new RegExp(endpoint.replaceAll('/', '\\/')));
  }
  assert.match(app, /import\(['"]\.\/workroom\.js['"]\)/);
  assert.doesNotMatch(app, /^import .*workroom\.js/m);
  assert.match(app, /EventSource/);
  assert.match(app, /requestAnimationFrame|setTimeout/);
  assert.doesNotMatch(app, /TODO|coming soon|fake button/i);
});

test('result UI offers concise review and a real managed rollback action', async () => {
  const html = await read('ui/index.html');
  const app = await read('ui/app.js');
  assert.match(html, /id="rollback-run"/);
  assert.match(app, /\/review/);
  assert.match(app, /\/rollback/);
  assert.match(app, /renderReview/);
});

test('default UI includes a first-class AI connection center instead of hiding provider setup in technical tools', async () => {
  const [html, app, css, providerUi, providerCss] = await Promise.all([read('ui/index.html'), read('ui/app.js'), read('ui/style.css'), read('ui/provider-connections.js'), read('ui/provider-connections.css')]);
  assert.match(html, /id="provider-dialog"/);
  assert.match(html, /id="provider-summary"/);
  assert.match(html, /id="api-provider-form"/);
  assert.match(html, /Đăng nhập ChatGPT/);
  assert.match(html, /Claude Pro\/Max/);
  assert.match(html, /API key/);
  for (const endpoint of ['/api/provider-connections', '/api/provider-connections/readiness', '/configure', '/login', '/logout']) {
    assert.match(providerUi, new RegExp(endpoint.replaceAll('/', '\\/')));
  }
  assert.match(app, /provider_setup_required/);
  assert.match(app, /import\(['"]\.\/provider-connections\.js['"]\)/);
  assert.match(providerUi, /window\.open/);
  assert.doesNotMatch(`${app}\n${providerUi}`, /localStorage\.setItem\([^\n]*(?:apiKey|token)|sessionStorage\.setItem\([^\n]*apiKey/i);
  assert.match(providerCss, /\.provider-card/);
  assert.match(providerCss, /\.provider-status/);
});

test('failed runs render a visible recovery card with the real reason and automatic continue behavior', async () => {
  const html = await read('ui/index.html');
  const app = await read('ui/app.js');
  const css = await read('ui/style.css');
  assert.match(html, /id="failure-card"/);
  assert.match(html, /id="failure-reason"/);
  assert.match(html, /id="failure-stage"/);
  assert.match(app, /renderFailure/);
  assert.match(app, /follow-up-after-failure|Tự tiếp tục từ checkpoint/i);
  assert.match(css, /\.failure-card/);
});

test('activity timeline exposes provider, target, tokens, and duration without raw JSON', async () => {
  const app = await read('ui/app.js');
  const css = await read('ui/style.css');
  assert.match(app, /activity-meta/);
  assert.match(app, /item\.target/);
  assert.match(app, /item\.providerId/);
  assert.match(app, /item\.tokenUsage/);
  assert.match(app, /durationMs/);
  assert.match(css, /\.activity-meta/);
});

test('live work card exposes the current provider, target, action, and last progress in plain language', async () => {
  const html = await readFile('ui/index.html', 'utf8');
  const app = await readFile('ui/app.js', 'utf8');
  for (const id of ['live-provider', 'live-target', 'live-action', 'live-progress-time']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /renderLiveOperation/);
  assert.match(app, /latestActiveActivity/);
});
