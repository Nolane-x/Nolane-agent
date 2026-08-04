import test from 'node:test';
import assert from 'node:assert/strict';
import { UI_CAPABILITIES, validateUiCapability, auditUiCapabilityCoverage } from '../src/ui/capability-registry.mjs';

test('UI capability contracts require route, exposure, APIs, permissions and complete states', () => {
  assert.throws(() => validateUiCapability({ id: 'runtime' }), /domain/i);
  const value = validateUiCapability({ id: 'runtime', domain: 'runtime', controlPlaneRoute: '/control-plane/runtime/processes', levelOneExposure: 'status-only', apiRoutes: ['/api/runtime'], states: ['loading','ready','empty','degraded','error'], permissions: [] });
  assert.equal(value.id, 'runtime');
  assert.throws(() => validateUiCapability({ ...value, states: ['ready'] }), /states/i);
});

test('capability inventory accounts for all 17 legacy centers and required level-one surfaces', () => {
  const report = auditUiCapabilityCoverage(UI_CAPABILITIES);
  assert.equal(report.total, 22);
  assert.deepEqual(report.missingLegacyCenters, []);
  assert.deepEqual(report.missingRequiredSurfaces, []);
  assert.equal(report.duplicateIds.length, 0);
  assert.equal(report.duplicateRoutes.length, 0);
});

test('capability and token audits are exposed as release commands', async () => {
  const { readFile } = await import('node:fs/promises');
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(pkg.scripts['audit:ui-capabilities'], 'node scripts/audit-ui-capabilities.mjs');
  assert.equal(pkg.scripts['validate:ui-tokens'], 'node scripts/validate-ui-tokens.mjs');
});
