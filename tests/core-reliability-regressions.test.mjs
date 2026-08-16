import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { AgentLoop } from '../src/agent/agent-loop.mjs';
import { ContextBuilder } from '../src/agent/context-builder.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { ToolBroker } from '../src/execution/tool-broker.mjs';
import { SubagentOrchestrator } from '../src/agents/subagent-orchestrator.mjs';

async function createLoopFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-core-reliability-'));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = store.createProject({ name: 'Core reliability', workspaceRoot: root });
  const task = store.createTask({ projectId: project.id, title: 'Observe model turn', objective: 'Return one answer.' });
  const forge = {
    async buildContextPack(input) {
      return {
        routePlan: { routePlanSha256: 'a'.repeat(64), steps: [] },
        skills: [],
        compiled: {
          context: {
            system: [{ text: 'Nolane authority' }],
            task: [{ text: input.task }],
            skills: [], code: [], artifacts: [], memory: [], toolOutput: [], references: [],
          },
          omissions: [],
          contextReceiptSha256: 'b'.repeat(64),
        },
        contextPackSha256: 'c'.repeat(64),
      };
    },
    async recordEvidence() { return { status: 'unverified' }; },
  };
  const providers = new ProviderRegistry();
  providers.register({
    id: 'single-turn-provider',
    publicView: () => ({ id: 'single-turn-provider' }),
    async complete() {
      return { text: 'One model turn.', toolCalls: [], usage: { totalTokens: 1 } };
    },
  });
  const loop = new AgentLoop({
    forge,
    providers,
    broker: new ToolBroker({ workspaceRoot: root, allowedCommands: [] }),
    store,
    contextBuilder: new ContextBuilder(),
  });
  return { loop, task, store };
}

test('AgentLoop emits exactly one model-completed event for each completed model turn', async (t) => {
  const fixture = await createLoopFixture(t);
  const result = await fixture.loop.run(fixture.task, {
    providerId: 'single-turn-provider',
    budgets: { maxTurns: 1, maxToolCalls: 0, maxEstimatedTokens: 20, maxElapsedMs: 1_000 },
  });
  assert.equal(result.state, 'awaiting-verification');
  const completed = fixture.store.listEvents().filter((event) => event.type === 'agent.model.completed');
  assert.equal(completed.length, 1, 'one successful provider turn must produce one lifecycle completion event');
  assert.equal(completed[0].payload.turn, 1);
});

test('SubagentOrchestrator cancels sibling work when a graph child fails', async () => {
  const profile = {
    id: 'worker', description: 'worker', prompt: '', tools: [], exclusiveTools: [], mcpServers: [], skills: [], capabilities: [],
    maxTurns: 4, budgetTokens: 1_000, allowChildAgents: false, sandboxProfile: 'workspace',
  };
  let siblingObservedAbort = false;
  const orchestrator = new SubagentOrchestrator({
    profiles: [profile],
    maxConcurrency: 2,
    runner: async (child, { signal }) => {
      if (child.jobId === 'fail-fast') {
        const error = new Error('intentional child failure');
        error.code = 'INTENTIONAL_TEST_FAILURE';
        throw error;
      }
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 250);
        const onAbort = () => {
          siblingObservedAbort = true;
          clearTimeout(timer);
          reject(signal.reason ?? new Error('sibling cancelled'));
        };
        if (signal?.aborted) onAbort();
        else signal?.addEventListener('abort', onAbort, { once: true });
      });
      return { summary: 'slow sibling completed', receipts: [] };
    },
  });
  const parentTask = {
    id: 'parent', projectId: 'project', allowedTools: [], allowedMcpServers: [], allowedSkills: [], permissions: ['agent.create'],
    maxTurns: 4, budgetTokens: 2_000,
  };

  await assert.rejects(() => orchestrator.runGraph({ parentTask, jobs: [
    { id: 'fail-fast', profileId: 'worker', objective: 'fail' },
    { id: 'slow-sibling', profileId: 'worker', objective: 'wait' },
  ] }), /intentional child failure/);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(siblingObservedAbort, true, 'graph failure must abort in-flight sibling work');
});
