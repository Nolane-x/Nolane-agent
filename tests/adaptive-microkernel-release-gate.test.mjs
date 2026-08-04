import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { verifyAdaptiveMicrokernel } from '../src/release/adaptive-microkernel-verifier.mjs';

test('adaptive microkernel release gate proves lazy startup, system-aware brownout, event-driven SSE, Lite UI, and optional packs', async (t) => {
  const output = await mkdtemp(path.join(os.tmpdir(), 'forge-216-microkernel-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const report = await verifyAdaptiveMicrokernel({ rootDirectory: path.resolve('.'), version: '2.16.0', outputFile: path.join(output, 'receipt.json') });
  assert.equal(report.status, 'pass');
  assert.equal(report.auditCounts.verified_source_test, 734);
  assert.equal(report.auditCounts.partial, 0);
  assert.equal(report.auditCounts.external_gate, 56);
  assert.equal(report.auditCounts.not_implemented, 0);
  assert.ok(report.metrics.appStaticImports <= 160);
  assert.ok(report.metrics.appConstructors <= 180);
  assert.equal(report.boundaries.enterpriseEagerAtLocalStartup, false);
  assert.equal(report.boundaries.sqliteSsePolling250ms, false);
  assert.equal(report.boundaries.externalRuntimeBundledInCore, false);
  assert.match(report.receiptSha256, /^[a-f0-9]{64}$/);
});
