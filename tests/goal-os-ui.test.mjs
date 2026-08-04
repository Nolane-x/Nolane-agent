import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('default shell exposes a compact Goal OS view while keeping browser and plugin controls advanced', async () => {
  const [html, app, goalUi] = await Promise.all([read('ui/index.html'), read('ui/app.js'), read('ui/goal-os.js')]);
  for (const id of ['goal-summary', 'goal-objective', 'goal-revision', 'goal-discoveries', 'goal-plan-changes', 'mission-graph-list', 'browser-url', 'browser-open', 'browser-runtime-status', 'install-browser-runtime', 'browser-permission-click', 'save-browser-permissions', 'plugin-marketplace-source', 'plugin-marketplace-add', 'plugin-list', 'plugin-review-dialog', 'plugin-review-list', 'plugin-review-activate']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /import\(['"]\.\/goal-os\.js['"]\)/);
  assert.match(app, /\/api\/goals/);
  assert.match(goalUi, /\/api\/mission-graph/);
  assert.match(goalUi, /\/api\/commands/);
  assert.match(goalUi, /\/api\/browser\/open/);
  assert.match(goalUi, /\/api\/browser\/runtime\/install/);
  assert.match(goalUi, /\/api\/permissions\/browser/);
  assert.match(goalUi, /\/api\/plugins\/marketplaces/);
  assert.match(goalUi, /\/api\/plugins\/install/);
  assert.match(goalUi, /\/review\?projectId=/);
  assert.match(goalUi, /approvedServers/);
  assert.doesNotMatch(goalUi, /TODO|coming soon|fake/i);
});

test('slash commands execute through Goal OS instead of creating an ordinary task', async () => {
  const [app, goalUi] = await Promise.all([read('ui/app.js'), read('ui/goal-os.js')]);
  assert.match(app, /objective\.startsWith\('\/'\)/);
  assert.match(app, /content\.startsWith\('\/'\)/);
  assert.match(goalUi, /executeCommand/);
});


test('default goal creation grants only read-oriented browser actions', async () => {
  const app = await read('ui/app.js');
  const match = app.match(/browserAllowedActions:\s*\[([^\]]+)\]/);
  assert.ok(match, 'goal request must declare browser permissions');
  const allowlist = match[1];
  for (const action of ['open', 'goto', 'snapshot', 'find', 'tabs', 'screenshot', 'close', 'status']) assert.match(allowlist, new RegExp(`['"]${action}['"]`));
  for (const action of ['click', 'fill', 'press']) assert.doesNotMatch(allowlist, new RegExp(`['"]${action}['"]`));
});
