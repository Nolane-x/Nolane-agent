import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NolaneNativeRuntimeService } from '../src/nolane-native/runtime-service.mjs';

test('native runtime contract verifies the offline Nolane protocol manifest and dependency lock', async () => {
  const runtime = new NolaneNativeRuntimeService({ projectRoot: process.cwd() });
  const preflight = await runtime.preflight();
  assert.equal(preflight.ready, true);
  assert.equal(preflight.protocol, 'nolane-agent-runtime/1');
  assert.match(preflight.workerSha256, /^[a-f0-9]{64}$/);
  assert.match(preflight.dependencyLockSha256, /^[a-f0-9]{64}$/);
  assert.match(runtime.status().lifecycleReceipt.receiptSha256, /^[a-f0-9]{64}$/);
});

test('native runtime contract rejects path escape tampering and requests before start', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-runtime-contract-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'config'), { recursive: true });
  await writeFile(path.join(root, 'config', 'nolane-native-runtime.json'), JSON.stringify({ schema: 'nolane.agent.native-runtime.v1', protocol: 'nolane-agent-runtime/1', worker: '../escape.mjs', dependencyLock: 'package-lock.json', workerSha256: '0'.repeat(64) }));
  const runtime = new NolaneNativeRuntimeService({ projectRoot: root });
  await assert.rejects(() => runtime.preflight(), /escapes project root/);
  await assert.rejects(() => runtime.ping(), /not running/);
});
