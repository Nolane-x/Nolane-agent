import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { verifyAstIntelligence } from '../src/release/ast-intelligence-verifier.mjs';

test('AST intelligence release verifier proves parser provenance, query, guarded patch, API, UI, audit, and matrix evidence', async (t) => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'forge-ast-intelligence-gate-'));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const outputFile = path.join(outputDirectory, 'report.json');
  const report = await verifyAstIntelligence({ rootDirectory: path.resolve('.'), version: '2.4.0', outputFile });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.requiredCapabilities, [
    'vendored-typescript-parser-provenance', 'bounded-js-ts-ast-query', 'file-and-node-hash-evidence',
    'single-node-stale-guarded-patch', 'dry-run-and-syntax-reparse', 'atomic-mode-and-line-ending-preservation',
    'task-authorized-operating-plane', 'observable-knowledge-center', 'item-level-feature-audit', 'full-release-matrix-gate',
  ]);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(await readFile(outputFile, 'utf8')).receiptSha256, report.receiptSha256);
});
