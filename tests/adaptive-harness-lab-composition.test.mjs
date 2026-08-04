import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createAdaptiveHarnessLab } from '../src/providers/adaptive-harness-lab.mjs';

test('adaptive harness facade owns profile, composition, failure, experiment, status, and close lifecycles', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-adaptive-harness-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const events = [];
  const lab = createAdaptiveHarnessLab({ dataDir: root, eventSink: (event) => events.push(event), minImprovement: 0.02 });
  const provider = { id: 'codex', harnessFamily: 'codex-cli' };
  const composed = lab.composer.compose({ provider, messages: [{ role: 'user', content: 'test' }], tools: [], task: { role: 'executor' } });
  assert.equal(composed.profileId, 'codex-cli-v1');
  assert.equal(lab.failureClassifier(new Error('429 rate limit')).class, 'provider-rate-limit');
  assert.equal(lab.experiments.minImprovement, 0.02);
  assert.ok(lab.publicView().profiles.length >= 7);
  assert.equal(lab.publicView().failures.total, 0);
  assert.equal(lab.publicView().experiments.mode, 'explicit-replay');
  lab.close();
  assert.throws(() => lab.failureStore.summary(), /open|closed/i);
});
