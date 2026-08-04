import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('checkpoint 13 progressive experience verifier passes', () => {
  const result = spawnSync(process.execPath, ['scripts/verify-checkpoint-13-progressive-experience.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout.trim());
  assert.equal(report.pass, true);
  assert.equal(report.settingsCategories, 18);
  assert.ok(report.settingsFields >= 84);
  assert.equal(report.controlPlaneDomains, 14);
  assert.ok(report.backendRoutes >= 398);
});
