import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { auditUiQuality } from '../scripts/audit-ui-quality-alpha5.mjs';

test('UI v3 static quality audit certifies keyboard, focus, live region, reduced motion and responsive contracts', async () => {
  const report = await auditUiQuality({ root: process.cwd() });
  assert.deepEqual(report.accessibilityFindings, []);
  assert.deepEqual(report.responsiveFindings, []);
  assert.deepEqual(report.offlineFindings, []);
  assert.equal(report.breakpoints.includes(1440), true);
  assert.equal(report.breakpoints.includes(1180), true);
  assert.equal(report.breakpoints.includes(900), true);
  assert.equal(report.breakpoints.includes(640), true);
  assert.equal(report.staticCertification, true);
  assert.equal(report.runtimeCertification, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});

test('artifact dock exposes connected tabs and tabpanels and shell announces route changes', async () => {
  const [dock, shell, app] = await Promise.all([
    readFile('ui-v3/views/mission/artifact-dock.mjs', 'utf8'),
    readFile('ui-v3/shell/app-shell.mjs', 'utf8'),
    readFile('ui-v3/app.mjs', 'utf8'),
  ]);
  assert.match(dock, /aria-controls=/);
  assert.match(dock, /role="tabpanel"/);
  assert.match(dock, /aria-labelledby=/);
  assert.match(shell, /aria-live="polite"/);
  assert.match(shell, /aria-atomic="true"/);
  assert.match(app, /routeTitle:/);
});

test('Windows 8 GB real-machine validation is deferred to 0.0.1 without shipping pending checkpoint artifacts', async () => {
  const roadmap = await readFile('docs/ROADMAP.md', 'utf8');
  assert.match(roadmap, /0\.0\.1:[^\n]*real-machine validation/i);
  assert.match(roadmap, /8 GB Windows/i);
  await assert.rejects(readFile('docs/ui-v3/windows-8gb-baseline.pending.json', 'utf8'), /ENOENT/);
});
