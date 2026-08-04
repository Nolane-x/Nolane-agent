import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { verifyCodebaseKnowledge } from '../src/release/codebase-knowledge-verifier.mjs';

test('codebase knowledge release verifier proves service, API, UI, ranking, watcher, and matrix evidence', async (t) => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'forge-codebase-knowledge-gate-'));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const outputFile = path.join(outputDirectory, 'report.json');
  const report = await verifyCodebaseKnowledge({ rootDirectory: path.resolve('.'), version: '1.9.0', outputFile });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.requiredCapabilities, ['routes-and-api-endpoints','database-models','references-and-conservative-calls','git-history','bounded-regex','incremental-indexing','portable-watcher','dependency-distance-ranking','git-recency-ranking','test-relation-ranking','authenticated-api','lazy-control-center']);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
  const persisted = JSON.parse(await readFile(outputFile, 'utf8'));
  assert.equal(persisted.receiptSha256, report.receiptSha256);
});
