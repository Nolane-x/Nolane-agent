import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { verifyNolaneEvidenceFreshness } from '../scripts/verify-nolane-evidence-freshness.mjs';
import { evidenceFileSha256 } from '../src/release/evidence-file-hash.mjs';

test('evidence freshness verifier accepts current registry and detects stale source or tests', async (t) => {
  const current = await verifyNolaneEvidenceFreshness({ projectRoot: process.cwd() });
  assert.equal(current.status, 'pass');
  assert.equal(current.failures.length, 0);
  assert.ok(current.checked >= 60);
  assert.equal(current.releaseEvidence.masterAcceptanceLedger.status, 'pass');
  assert.equal(current.releaseEvidence.nativeCoreParity.status, 'pass');
  assert.equal(current.claims.releaseReceiptFreshnessRequired, true);
  assert.match(current.receiptSha256, /^[a-f0-9]{64}$/);

  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-evidence-freshness-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'requirements'), { recursive: true });
  await mkdir(path.join(root, 'src'), { recursive: true });
  await mkdir(path.join(root, 'tests'), { recursive: true });
  await writeFile(path.join(root, 'src', 'feature.mjs'), 'export const value = 1;\r\n');
  await writeFile(path.join(root, 'tests', 'feature.test.mjs'), 'test();\r\n');
  const crypto = await import('node:crypto');
  const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
  const entry = await readFile(path.join(root, 'src', 'feature.mjs'));
  const exactTest = await readFile(path.join(root, 'tests', 'feature.test.mjs'));
  const evidence = { environment: 'node>=22.12', entrypointSha256: evidenceFileSha256(entry), exactTestSha256: evidenceFileSha256(exactTest) };
  const replayReceiptSha256 = sha(JSON.stringify({ id: 'NOL-X-001', ...evidence }));
  await writeFile(path.join(root, 'requirements', 'nolane-agent-v5-requirements.json'), JSON.stringify({
    schema: 'nolane.agent.requirements.v5',
    requirements: [{ id: 'NOL-X-001', status: 'verified_source_test', acceptance: { entrypoint: 'src/feature.mjs', exactTest: 'tests/feature.test.mjs', evidence, replayReceiptSha256 } }],
  }));
  assert.equal((await verifyNolaneEvidenceFreshness({ projectRoot: root, verifyReleaseEvidence: false })).status, 'pass');
  await writeFile(path.join(root, 'src', 'feature.mjs'), 'export const value = 2;\n');
  const stale = await verifyNolaneEvidenceFreshness({ projectRoot: root });
  assert.equal(stale.status, 'fail');
  assert.equal(stale.failures.some((item) => item.code === 'ENTRYPOINT_SHA_MISMATCH'), true);
});
