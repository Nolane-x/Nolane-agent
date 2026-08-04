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

async function fixture(t, metadata = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-construction-loop-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'Construction', workspaceRoot: root });
  const task = store.createTask({ projectId: project.id, title: 'Build', objective: 'Build safely.', metadata });
  let calls = 0;
  const providers = new ProviderRegistry();
  providers.register({ id: 'fake', publicView() { return { id: 'fake' }; }, async complete() { calls += 1; return { text: 'Completed.', toolCalls: [], usage: { totalTokens: 5 }, finishReason: 'stop' }; } });
  const forge = { async buildContextPack(input) { return { routePlan: { routePlanSha256: 'a'.repeat(64), steps: [] }, skills: [], compiled: { context: { system: [{ id: 's', text: 'system' }], task: [{ id: 't', text: input.task }], skills: [], code: [], artifacts: [], memory: [], toolOutput: [], references: [] }, omissions: [], contextReceiptSha256: 'b'.repeat(64) }, contextPackSha256: 'c'.repeat(64) }; }, async recordEvidence() { return { status: 'unverified' }; } };
  const decisionPlane = new DecisionPlane({ construction: { capsuleRoot: path.join(root, 'capsules') } });
  const loop = new AgentLoop({ forge, providers, decisionPlane, broker: new ToolBroker({ workspaceRoot: root, allowedCommands: [] }), store, contextBuilder: new ContextBuilder() });
  return { loop, task, decisionPlane, calls: () => calls };
}

test('simple AgentLoop task does not load construction services', async (t) => {
  const f = await fixture(t);
  const result = await f.loop.run(f.task, { providerId: 'fake', tools: [], budgets: { maxTurns: 2, maxToolCalls: 0, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.equal(result.construction, null);
  assert.equal(f.decisionPlane.snapshot().lifecycle.constructionLoaded, false);
});

test('long-horizon task is blocked before provider execution when specification conflicts', async (t) => {
  const f = await fixture(t, { constructionMode: true, constructionSpecification: {
    specificationId: 'blocked', goal: 'Rename API', criteria: [{ criterionId: 'c1', statement: 'Rename', weight: 1 }],
    constraints: [{ constraintId: 'stable', kind: 'hard', statement: 'Preserve', rule: 'preserve-public-api' }, { constraintId: 'rename', kind: 'hard', statement: 'Rename', rule: 'rename-public-api-without-adapter' }],
    verificationPlan: [{ verificationId: 'v1', criterionIds: ['c1'], kind: 'test' }],
  } });
  await assert.rejects(() => f.loop.run(f.task, { providerId: 'fake', tools: [], budgets: { maxTurns: 2, maxToolCalls: 0, maxEstimatedTokens: 20, maxElapsedMs: 1000 } }), /construction specification is blocked/i);
  assert.equal(f.calls(), 0);
});

test('valid long-horizon task returns only bounded construction receipts', async (t) => {
  const f = await fixture(t, { constructionMode: true, constructionSpecification: { specificationId: 'ready', goal: 'Safe change', criteria: [{ criterionId: 'c1', statement: 'Works', weight: 1 }], verificationPlan: [{ verificationId: 'v1', criterionIds: ['c1'], kind: 'test' }] } });
  const result = await f.loop.run(f.task, { providerId: 'fake', tools: [], budgets: { maxTurns: 2, maxToolCalls: 0, maxEstimatedTokens: 20, maxElapsedMs: 1000 } });
  assert.equal(result.construction.active, true);
  assert.equal(result.construction.specificationId, 'ready');
  assert.match(result.construction.specificationReceiptSha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(result.construction), /prompt|rawOutput|chainOfThought|rationale/i);
});
