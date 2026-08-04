import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { verifySemanticDependencyIntelligence } from '../src/release/semantic-dependency-verifier.mjs';

test('semantic dependency release verifier proves local search, topology, API, UI, audit, and matrix evidence', async (t) => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'forge-semantic-dependency-gate-'));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const outputFile = path.join(outputDirectory, 'report.json');
  const report = await verifySemanticDependencyIntelligence({ rootDirectory: path.resolve('.'), version: '2.3.0', outputFile });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.requiredCapabilities, [
    'local-semantic-embedding','semantic-ranking-and-bounded-preview','principal-bound-authenticated-api',
    'dependency-traversal','cycle-detection','bounded-topology','observable-control-center',
    'item-level-feature-audit','full-release-matrix-gate',
  ]);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(await readFile(outputFile, 'utf8')).receiptSha256, report.receiptSha256);
});
