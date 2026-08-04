import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verifyEvidenceContextRuntime } from '../src/release/evidence-context-runtime-verifier.mjs';

test('evidence context runtime release gate verifies durable graph, hybrid retrieval, packet leases, and non-mutating recovery', async (t) => {
  const out = await mkdtemp(path.join(os.tmpdir(), 'forge-215-evidence-gate-')); t.after(() => rm(out, { recursive: true, force: true }));
  const report = await verifyEvidenceContextRuntime({ rootDirectory: path.resolve('.'), version: '2.15.0', outputFile: path.join(out, 'receipt.json') });
  assert.equal(report.status, 'pass');
  assert.equal(report.auditCounts.verified_source_test, 734);
  assert.equal(report.auditCounts.partial, 0);
  assert.equal(report.auditCounts.external_gate, 56);
  assert.equal(report.auditCounts.not_implemented, 0);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(report.boundaries.hiddenReasoningPersisted, false);
  assert.equal(report.boundaries.recoveryAutoExecutes, false);
  assert.equal(report.boundaries.remoteDependencyAdded, false);
});
