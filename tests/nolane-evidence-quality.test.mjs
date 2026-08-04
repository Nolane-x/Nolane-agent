import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { verifyNolaneEvidenceQuality } from '../scripts/verify-nolane-evidence-quality.mjs';

test('evidence quality passes current registry and rejects over-concentrated proof paths', async (t) => {
  const current = await verifyNolaneEvidenceQuality({ projectRoot: process.cwd() });
  assert.equal(current.status, 'pass');
  assert.equal(current.missingPaths.length, 0);
  assert.equal(current.overConcentrated.length, 0);
  assert.match(current.receiptSha256, /^[a-f0-9]{64}$/);

  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-evidence-quality-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'requirements'), { recursive: true });
  const requirements = Array.from({ length: 10 }, (_, index) => ({
    id: `R-${index}`, status: 'verified_source_test',
    acceptance: { entrypoint: 'src/shared.mjs', exactTest: 'tests/shared.test.mjs' },
  }));
  await writeFile(path.join(root, 'requirements', 'nolane-agent-v5-requirements.json'), JSON.stringify({ requirements }));
  const report = await verifyNolaneEvidenceQuality({ projectRoot: root, concentrationThreshold: 0.5 });
  assert.equal(report.status, 'fail');
  assert.equal(report.overConcentrated.some((item) => item.path === 'src/shared.mjs'), true);
  assert.equal(report.overConcentrated.some((item) => item.path === 'tests/shared.test.mjs'), true);
});
