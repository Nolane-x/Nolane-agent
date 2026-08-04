import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AgentLoop } from '../src/agent/agent-loop.mjs';
import { ContextBuilder } from '../src/agent/context-builder.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { ToolBroker } from '../src/execution/tool-broker.mjs';

test('AgentLoop injects a governed evidence packet before the first model call', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-evidence-loop-')); t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'README.md'), 'hello');
  const store = new StudioStore(path.join(root, 'studio.db')); t.after(() => store.close());
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const task = store.createTask({ projectId: project.id, title: 'Inspect', objective: 'Inspect README.', role: 'executor', metadata: { completionCriteria: ['Report content'], hypothesis: 'README contains hello', recentFailures: ['none'] } });
  const order = []; let capturedReference;
  const evidenceContextRuntime = {
    async agentReference(input) {
      order.push('evidence');
      assert.equal(input.projectId, project.id); assert.equal(input.taskId, task.id); assert.equal(input.goal.objective, task.objective);
      assert.deepEqual(input.completionCriteria, ['Report content']);
      assert.ok(input.availableTools.includes('fs.read'));
      return { id: 'evidence-context:x', text: '[governed-evidence-context-packet]\n{}', sha256: 'e'.repeat(64), priority: 995, metadata: { trust: 'governed-evidence-runtime' } };
    },
  };
  const forge = {
    async buildContextPack(input) {
      order.push('route'); capturedReference = input.references.find((item) => item.id === 'evidence-context:x');
      return { routePlan: { routePlanSha256: 'a'.repeat(64), steps: [] }, skills: [], compiled: { context: { system: [{ text: 'system' }], task: [{ text: input.task }], skills: [], code: [], artifacts: [], memory: [], toolOutput: [], references: input.references.map(({ text }) => ({ text })) }, omissions: [], contextReceiptSha256: 'b'.repeat(64) }, contextPackSha256: 'c'.repeat(64) };
    },
    async recordEvidence() { return { status: 'unverified' }; },
  };
  const providers = new ProviderRegistry(); providers.register({ id: 'fake', publicView: () => ({ id: 'fake' }), async complete() { order.push('model'); return { text: 'hello', toolCalls: [], usage: { totalTokens: 1 } }; } });
  const loop = new AgentLoop({ forge, providers, evidenceContextRuntime, broker: new ToolBroker({ workspaceRoot: root, allowedCommands: [] }), store, contextBuilder: new ContextBuilder() });
  await loop.run(task, { providerId: 'fake', budgets: { maxTurns: 1, maxToolCalls: 0, maxEstimatedTokens: 10, maxElapsedMs: 1000 } });
  assert.deepEqual(order.slice(0, 3), ['evidence','route','model']);
  assert.equal(capturedReference.sha256, 'e'.repeat(64));
  assert.ok(store.listEvents().some((event) => event.type === 'agent.evidence-context.selected'));
});
