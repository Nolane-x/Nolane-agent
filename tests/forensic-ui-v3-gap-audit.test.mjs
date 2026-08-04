import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { auditUiV3MasterPlan } from '../src/forensics/ui-v3-gap-auditor.mjs';

test('UI v3 gap audit distinguishes implemented, partial, missing, and external items', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-ui-gap-'));
  await mkdir(path.join(root, 'ui-v3', 'core'), { recursive: true });
  await writeFile(path.join(root, 'ui-v3', 'core', 'router.mjs'), 'export const router = true;\n');
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'src', 'app.mjs'), "get('UI_VERSION', 'v2');\n");
  const report = await auditUiV3MasterPlan({
    root,
    requiredArtifacts: [
      { id: 'router', title: 'Router', paths: ['ui-v3/core/router.mjs'], external: false },
      { id: 'workers', title: 'Workers', paths: ['ui-v3/workers/diff-worker.mjs', 'ui-v3/workers/search-worker.mjs'], external: false },
      { id: 'mixed', title: 'Mixed', paths: ['ui-v3/core/router.mjs', 'ui-v3/core/scheduler.mjs'], external: false },
      { id: 'windows', title: 'Windows certification', paths: [], external: true },
    ],
  });
  assert.equal(report.defaultUiVersion, 'v2');
  assert.equal(report.items.find((item) => item.id === 'router').status, 'implemented');
  assert.equal(report.items.find((item) => item.id === 'workers').status, 'missing');
  assert.equal(report.items.find((item) => item.id === 'mixed').status, 'partial');
  assert.equal(report.items.find((item) => item.id === 'windows').status, 'external-certification');
  assert.equal(report.complete, false);
});

test('UI v3 cannot be complete while v2 remains the default', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-ui-gap-'));
  await mkdir(path.join(root, 'ui-v3'), { recursive: true });
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'ui-v3', 'app.mjs'), 'export {};\n');
  await writeFile(path.join(root, 'src', 'app.mjs'), "get('UI_VERSION', 'v2');\n");
  const report = await auditUiV3MasterPlan({ root, requiredArtifacts: [{ id: 'app', title: 'App', paths: ['ui-v3/app.mjs'], external: false }] });
  assert.equal(report.summary.implemented, 1);
  assert.equal(report.complete, false);
  assert.ok(report.blockers.includes('UI v3 is not the default renderer'));
});
