import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { AgentLoop } from '../src/agent/agent-loop.mjs';
import { ContextBuilder } from '../src/agent/context-builder.mjs';
import { ToolBroker } from '../src/execution/tool-broker.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

function forge() {
  return {
    async buildContextPack(input) { return { routePlan: { routePlanSha256: 'a'.repeat(64), steps: [] }, skills: [], compiled: { context: { system: [], task: [{ text: input.task }], skills: [], code: [], artifacts: [], memory: [], toolOutput: [], references: [] }, omissions: [], contextReceiptSha256: 'b'.repeat(64) }, contextPackSha256: 'c'.repeat(64) }; },
    async recordEvidence() { return { status: 'unverified' }; },
  };
}

test('AgentLoop automatically records successful and failed provider observations without exposing prompts', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-model-observation-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'store.db')); t.after(() => store.close());
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const task = store.createTask({ projectId: project.id, title: 'T', objective: 'Observe provider execution.' });
  const providers = new ProviderRegistry();
  let attempt = 0;
  providers.register({ id: 'provider-a', publicView: () => ({ id: 'provider-a' }), async complete() { attempt += 1; if (attempt === 1) throw Object.assign(new Error('temporary'), { code: 'HTTP_503' }); return { providerId: 'provider-a', model: 'model-a', text: 'done', toolCalls: [], finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 4 } }; } });
  const observations = [];
  const loop = new AgentLoop({ forge: forge(), providers, broker: new ToolBroker({ workspaceRoot: root, allowedCommands: [] }), store, contextBuilder: new ContextBuilder(), modelObservationSink: (entry) => observations.push(entry) });
  await loop.run(task, { providerId: 'provider-a', model: 'requested-model', retryDelaysMs: [1], budgets: { maxTurns: 2, maxToolCalls: 0, maxEstimatedTokens: 100, maxElapsedMs: 2_000 } });
  assert.equal(observations.length, 2);
  assert.equal(observations[0].observation.success, false);
  assert.equal(observations[0].observation.errorCode, 'HTTP_503');
  assert.equal(observations[1].observation.success, true);
  assert.equal(observations[1].modelId, 'model-a');
  assert.equal(observations[1].observation.inputTokens, 10);
  assert.equal(observations[1].observation.outputTokens, 4);
  assert.equal(JSON.stringify(observations).includes('Observe provider execution'), false);
});
