import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { AgentLoop } from '../src/agent/agent-loop.mjs';
import { ContextBuilder } from '../src/agent/context-builder.mjs';
import { ToolBroker } from '../src/execution/tool-broker.mjs';
import { classifyHarnessFailure } from '../src/providers/harness-failure-classifier.mjs';
import { HarnessFailureStore } from '../src/providers/harness-failure-store.mjs';
import { HarnessProfileRegistry, createBuiltInHarnessProfiles } from '../src/providers/harness-profile-registry.mjs';
import { HarnessRequestComposer } from '../src/providers/harness-request-composer.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-loop-harness-'));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const failureStore = new HarnessFailureStore({ file: path.join(root, 'harness-failures.db') });
  t.after(() => failureStore.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = store.createProject({ name: 'Harness', workspaceRoot: root });
  const task = store.createTask({ projectId: project.id, title: 'Recover', objective: 'Recover from a provider rate limit.', role: 'executor', metadata: { taskKind: 'bugfix' } });
  const requests = [];
  let attempt = 0;
  const providers = new ProviderRegistry();
  providers.register({
    id: 'codex', kind: 'cli', harnessFamily: 'codex-cli',
    publicView() { return { id: this.id, kind: this.kind, harnessFamily: this.harnessFamily }; },
    async complete(input) {
      requests.push(input);
      attempt += 1;
      if (attempt === 1) throw Object.assign(new Error('HTTP 429 rate limit exceeded'), { code: 'HTTP_429' });
      return { text: 'Recovered safely.', toolCalls: [], usage: { totalTokens: 5 }, finishReason: 'stop' };
    },
  });
  const registry = new HarnessProfileRegistry({ profiles: createBuiltInHarnessProfiles() });
  const composer = new HarnessRequestComposer({ registry });
  const forge = {
    async buildContextPack(input) {
      return {
        routePlan: { routePlanSha256: 'a'.repeat(64), steps: [] }, skills: [],
        compiled: { context: { system: [{ id: 'system', text: 'Forge authority.' }], task: [{ id: 'task', text: input.task }], skills: [], code: [], artifacts: [], memory: [], toolOutput: [], references: [] }, omissions: [], contextReceiptSha256: 'b'.repeat(64) },
        contextPackSha256: 'c'.repeat(64),
      };
    },
    async recordEvidence() { return { id: 'evidence', status: 'unverified' }; },
  };
  const loop = new AgentLoop({
    forge, providers, broker: new ToolBroker({ workspaceRoot: root, allowedCommands: [] }), store, contextBuilder: new ContextBuilder(),
    harnessComposer: composer, harnessFailureStore: failureStore, harnessFailureClassifier: classifyHarnessFailure,
  });
  return { loop, store, task, requests, failureStore };
}

test('AgentLoop composes provider-specific requests, records classified failure, and retries with category guidance', async (t) => {
  const f = await fixture(t);
  const result = await f.loop.run(f.task, { providerId: 'codex', retryDelaysMs: [1], tools: [], budgets: { maxTurns: 2, maxToolCalls: 0, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.equal(result.state, 'awaiting-verification');
  assert.equal(result.harness.profileId, 'codex-cli-v1');
  assert.equal(f.requests.length, 2);
  assert.match(f.requests[0].messages[0].content, /Forge action contract/i);
  assert.doesNotMatch(f.requests[0].messages[0].content, /rate limit was reached/i);
  assert.match(f.requests[1].messages[0].content, /rate limit was reached/i);
  assert.equal(f.failureStore.summary({ providerId: 'codex' }).total, 1);
  assert.deepEqual(f.failureStore.clusters({ providerId: 'codex' }).map((item) => item.failureClass), ['provider-rate-limit']);

  const events = f.store.listEvents();
  const requested = events.find((event) => event.type === 'agent.model.requested');
  assert.equal(requested.payload.harnessProfileId, 'codex-cli-v1');
  assert.match(requested.payload.harnessReceiptSha256, /^[a-f0-9]{64}$/);
  assert.ok(events.some((event) => event.type === 'agent.harness.failure-classified' && event.payload.failureClass === 'provider-rate-limit'));
  assert.ok(events.some((event) => event.type === 'agent.model.retrying' && event.payload.harnessProfileId === 'codex-cli-v1'));
});
