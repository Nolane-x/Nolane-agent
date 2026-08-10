import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentLoop } from '../src/agent/agent-loop.mjs';
import { ContextBuilder } from '../src/agent/context-builder.mjs';
import { ToolBroker } from '../src/execution/tool-broker.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { DecisionPlane } from '../src/decision/decision-plane.mjs';

async function makeFixture(t, { cognitive = false, failOnce = false } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-cognitive-loop-'));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = store.createProject({ name: 'Cognition', workspaceRoot: root });
  const metadata = cognitive ? {
    cognitiveMode: true,
    cognitiveContexts: [{ id: 'code', probability: 0.5 }, { id: 'environment', probability: 0.5 }],
    cognitiveHypotheses: [
      { id: 'h1', claim: 'provider timeout', probability: 0.55, predictions: ['retry succeeds'], falsificationCondition: 'retry also times out', testCost: 1 },
      { id: 'h2', claim: 'bad request', probability: 0.45, predictions: ['retry fails deterministically'], falsificationCondition: 'same request succeeds', testCost: 1 },
    ],
    cognitiveActions: [
      { id: 'inspect-failure', kind: 'probe', taskUtility: 0.4, informationGain: 0.9, tokenCost: 50, ramMbSeconds: 2, timeMs: 50, irreversibility: 0 },
      { id: 'rewrite-request', kind: 'patch', taskUtility: 0.7, informationGain: 0.1, tokenCost: 400, ramMbSeconds: 20, timeMs: 500, irreversibility: 0.5 },
    ],
  } : {};
  const task = store.createTask({ projectId: project.id, title: 'Run', objective: 'Complete safely.', metadata });
  let calls = 0;
  const providers = new ProviderRegistry();
  providers.register({
    id: 'fake', publicView() { return { id: 'fake' }; },
    async complete() {
      calls += 1;
      if (failOnce && calls === 1) throw Object.assign(new Error('temporary timeout'), { code: 'ETIMEDOUT' });
      return { text: 'Completed.', toolCalls: [], usage: { totalTokens: 5 }, finishReason: 'stop' };
    },
  });
  const forge = {
    async buildContextPack(input) { return { routePlan: { routePlanSha256: 'a'.repeat(64), steps: [] }, skills: [], compiled: { context: { system: [{ id: 's', text: 'system' }], task: [{ id: 't', text: input.task }], skills: [], code: [], artifacts: [], memory: [], toolOutput: [], references: [] }, omissions: [], contextReceiptSha256: 'b'.repeat(64) }, contextPackSha256: 'c'.repeat(64) }; },
    async recordEvidence() { return { status: 'unverified' }; },
  };
  const decisionPlane = new DecisionPlane();
  const loop = new AgentLoop({ forge, providers, decisionPlane, broker: new ToolBroker({ workspaceRoot: root, allowedCommands: [] }), store, contextBuilder: new ContextBuilder() });
  return { loop, task, store, decisionPlane };
}

test('low-risk AgentLoop path does not instantiate cognition', async (t) => {
  const f = await makeFixture(t);
  const result = await f.loop.run(f.task, { providerId: 'fake', tools: [], budgets: { maxTurns: 2, maxToolCalls: 0, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.equal(result.cognition, null);
  assert.equal(f.decisionPlane.snapshot().lifecycle.cognitionLoaded, false);
});

test('repeated provider failure produces a bounded cognitive recommendation', async (t) => {
  const f = await makeFixture(t, { cognitive: true, failOnce: true });
  const result = await f.loop.run(f.task, { providerId: 'fake', retryDelaysMs: [1], tools: [], budgets: { maxTurns: 2, maxToolCalls: 0, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.equal(result.cognition.active, true);
  assert.equal(result.cognition.recentRecommendation.selectedActionId, 'inspect-failure');
  assert.match(result.cognition.recentRecommendation.receiptSha256, /^[a-f0-9]{64}$/);
  const event = f.store.listEvents().find((item) => item.type === 'agent.cognition.recommendation');
  assert.equal(event.payload.selectedActionId, 'inspect-failure');
  assert.equal('rationale' in event.payload, false);
  assert.doesNotMatch(JSON.stringify(result.cognition), /prompt|rawOutput|chainOfThought/i);
});
