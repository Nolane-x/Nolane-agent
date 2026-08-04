import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { HarnessFailureStore } from '../src/providers/harness-failure-store.mjs';

function event(overrides = {}) {
  return {
    providerId: 'codex', harnessFamily: 'codex-cli', profileId: 'codex-cli-v1', profileRevision: 1,
    taskKind: 'bugfix', failureClass: 'provider-timeout', retryable: true,
    fingerprint: 'a'.repeat(64), missionId: 'mission-1', taskId: 'task-1',
    evidenceReceiptSha256: 'b'.repeat(64), occurredAt: 1_722_000_000_000,
    ...overrides,
  };
}

test('store rejects non-allowlisted fields so raw prompts, output, and secrets cannot be persisted', () => {
  const store = new HarnessFailureStore({ file: ':memory:' });
  assert.throws(() => store.record({ ...event(), rawPrompt: 'secret' }), /unsupported telemetry field: rawPrompt/);
  assert.throws(() => store.record({ ...event(), modelOutput: 'secret' }), /unsupported telemetry field: modelOutput/);
  assert.throws(() => store.record({ ...event(), environment: { API_KEY: 'secret' } }), /unsupported telemetry field: environment/);
  store.close();
});

test('store records idempotent bounded failures and aggregates clusters', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-harness-failure-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'failures.db');
  const store = new HarnessFailureStore({ file });
  const first = store.record(event());
  const duplicate = store.record(event());
  store.record(event({ taskId: 'task-2', fingerprint: 'c'.repeat(64), failureClass: 'patch-conflict', retryable: true, occurredAt: 1_722_000_001_000 }));
  store.record(event({ providerId: 'claude', harnessFamily: 'claude-code', profileId: 'claude-code-v1', taskId: 'task-3', fingerprint: 'd'.repeat(64), failureClass: 'loop-no-progress', retryable: false, occurredAt: 1_722_000_002_000 }));

  assert.equal(first.recorded, true);
  assert.equal(duplicate.recorded, false);
  assert.equal(store.summary({ providerId: 'codex' }).total, 2);
  assert.equal(store.summary({ providerId: 'codex' }).retryable, 2);
  const clusters = store.clusters({ providerId: 'codex' });
  assert.deepEqual(clusters.map((item) => [item.failureClass, item.count]), [['patch-conflict', 1], ['provider-timeout', 1]]);
  assert.doesNotMatch(JSON.stringify(store.summary({})), /prompt|output|secret|API_KEY/i);
  store.close();

  const reopened = new HarnessFailureStore({ file });
  assert.equal(reopened.summary({}).total, 3);
  reopened.close();
});
