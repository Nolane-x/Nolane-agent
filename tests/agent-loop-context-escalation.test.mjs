import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { AgentLoop } from '../src/agent/agent-loop.mjs';
import { ContextBuilder } from '../src/agent/context-builder.mjs';
import { ContextEscalationController } from '../src/context/context-escalation-controller.mjs';
import { ToolBroker } from '../src/execution/tool-broker.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-escalation-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new StudioStore(path.join(root, 'studio.db'));
  t.after(() => store.close());
  const project = store.createProject({ name: 'P', workspaceRoot: root });
  const task = store.createTask({ projectId: project.id, title: 'Debug', objective: 'Fix validateSession.', metadata: { initialContextBudgetTokens: 100 } });
  const contextCalls = [];
  const repositoryIndex = {
    async index() { return { indexed: 2 }; },
    async contextForTask(_projectId, options) {
      contextCalls.push(options);
      const items = [{ path: 'src/auth/session.mjs', sha256: 'a'.repeat(64), score: 100, text: '// initial validateSession evidence', language: 'js' }];
      if (options.maxChars > 400) items.push({ path: 'tests/session.test.mjs', sha256: 'b'.repeat(64), score: 90, text: '// additional counter evidence', language: 'js' });
      return { items, omissions: [] };
    },
  };
  const requests = [];
  let turn = 0;
  const providers = new ProviderRegistry();
  providers.register({
    id: 'fake', publicView() { return { id: 'fake' }; },
    async complete(request) {
      requests.push(structuredClone(request));
      turn += 1;
      if (turn === 1) return { text: 'Need more evidence.', toolCalls: [], usage: { totalTokens: 5 }, confidence: 0.3, unresolvedHypotheses: ['h-cache'] };
      return { text: 'Root cause isolated.', toolCalls: [], usage: { totalTokens: 5 }, confidence: 0.9, unresolvedHypotheses: [] };
    },
  });
  const forge = {
    async buildContextPack(input) {
      return {
        routePlan: { routePlanSha256: 'a'.repeat(64), steps: [] }, skills: [],
        compiled: { context: { system: [{ id: 'system', text: 'Forge authority.' }], task: [{ id: 'task', text: input.task }], skills: [], code: input.code.map((item) => ({ id: item.id, text: item.text })), artifacts: [], memory: [], toolOutput: [], references: [] }, omissions: [], contextReceiptSha256: 'b'.repeat(64) },
        contextPackSha256: 'c'.repeat(64),
      };
    },
    async recordEvidence() { return { status: 'unverified' }; },
  };
  const loop = new AgentLoop({
    forge, providers, repositoryIndex, broker: new ToolBroker({ workspaceRoot: root, allowedCommands: [] }), store,
    contextBuilder: new ContextBuilder(), contextEscalationController: new ContextEscalationController({ budgets: { initial: 100, 'symbol-neighborhood': 200, 'targeted-expansion': 300, 'full-file-exception': 400 } }),
  });
  return { loop, task, requests, contextCalls, store };
}

test('AgentLoop sends initial bounded context then appends only newly expanded evidence', async (t) => {
  const f = await fixture(t);
  const result = await f.loop.run(f.task, { providerId: 'fake', tools: [], budgets: { maxTurns: 3, maxToolCalls: 0, maxEstimatedTokens: 50, maxElapsedMs: 2000 } });
  assert.equal(result.output, 'Root cause isolated.');
  assert.equal(f.contextCalls[0].maxChars, 400);
  assert.ok(f.contextCalls[1].maxChars > f.contextCalls[0].maxChars);
  assert.equal(f.requests.length, 2);
  assert.doesNotMatch(JSON.stringify(f.requests[0].messages), /additional counter evidence/);
  assert.match(JSON.stringify(f.requests[1].messages), /additional counter evidence/);
  assert.equal((JSON.stringify(f.requests[1].messages).match(/initial validateSession evidence/g) ?? []).length, 1);
  assert.ok(f.store.listEvents().some((event) => event.type === 'agent.context.expanded'));
});
