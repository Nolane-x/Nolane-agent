import test from 'node:test';
import assert from 'node:assert/strict';
import { createNolaneEnvironment } from '../src/config/nolane-environment.mjs';
import { scanProductSurfaceLeakage } from '../scripts/scan-product-surface-leakage.mjs';

test('canonical NOLANE_AGENT environment values win and legacy fallback emits value-free receipts', () => {
  const events = [];
  const canonical = createNolaneEnvironment({ NOLANE_AGENT_HOST: '127.0.0.2', FORGE_STUDIO_HOST: 'legacy-host', FORGE_STUDIO_TOKEN: 'super-secret' }, { eventSink: (event) => events.push(event) });
  assert.equal(canonical.get('HOST'), '127.0.0.2');
  assert.equal(canonical.get('TOKEN'), 'super-secret');
  assert.equal(events.length, 1);
  assert.equal(events[0].source, 'legacy');
  assert.equal(events[0].canonicalName, 'NOLANE_AGENT_TOKEN');
  assert.equal(events[0].legacyName, 'FORGE_STUDIO_TOKEN');
  assert.equal(JSON.stringify(events).includes('super-secret'), false);
  assert.match(events[0].receiptSha256, /^[a-f0-9]{64}$/);
  const compatibility = canonical.compatibilityView();
  assert.equal(compatibility.FORGE_STUDIO_HOST, '127.0.0.2');
  assert.equal(compatibility.FORGE_STUDIO_TOKEN, 'super-secret');
});

test('product-facing source contains no unapproved Forge Studio names or forge command namespaces', async () => {
  const report = await scanProductSurfaceLeakage({ projectRoot: process.cwd() });
  assert.equal(report.scannedFiles > 10, true);
  assert.deepEqual(report.violations, []);
});

test('the approved Forge OS skill catalog is not confused with the deprecated Forge Studio product', async () => {
  const report = await scanProductSurfaceLeakage({ projectRoot: process.cwd() });
  assert.equal(report.violations.some((violation) => violation.file === 'ui-v3/views/skills/skills-view.mjs' && violation.match === 'Forge OS'), false);
});

test('application bootstrap reads canonical environment through the migration resolver', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('src/app.mjs', 'utf8');
  assert.match(source, /createNolaneEnvironment/);
  assert.doesNotMatch(source, /process\.env\.FORGE_STUDIO_[A-Z0-9_]+/);
});
