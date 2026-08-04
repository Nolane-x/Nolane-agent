import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { verifyCodeRelationshipIntelligence } from '../src/release/code-relationship-verifier.mjs';

test('code relationship verifier proves local inheritance, issue-to-code evidence, bounded API, UI, audit, matrix, and non-claims', async (t) => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'forge-code-relationship-gate-'));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const outputFile = path.join(outputDirectory, 'report.json');
  const report = await verifyCodeRelationshipIntelligence({ rootDirectory: path.resolve('.'), version: '2.7.0', outputFile });
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.requiredCapabilities, [
    'authenticated-principal-bound-index',
    'compiler-ast-inheritance-index',
    'same-file-relative-import-resolution',
    'explicit-ambiguous-unresolved-evidence',
    'contextual-local-issue-references',
    'git-commit-to-changed-file-links',
    'bounded-api-and-knowledge-center',
    'item-level-feature-audit',
    'full-release-matrix-gate',
  ]);
  assert.equal(report.limitations.treeSitterClaimed, false);
  assert.equal(report.limitations.remoteIssueSyncClaimed, false);
  assert.equal(report.limitations.languageGeneralClaimed, false);
  assert.equal(report.limitations.inferredIssueTruthClaimed, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(await readFile(outputFile, 'utf8')).receiptSha256, report.receiptSha256);
});
