import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { OperatingPlaneToolGateway } from '../src/agent/operating-plane-tool-gateway.mjs';

test('agent.runGraph is explicit-only, schema-bounded, and delegates to adaptive graph execution', async () => {
  const calls = [];
  const gateway = new OperatingPlaneToolGateway({
    projectResolver: () => ({ id: 'p1', workspaceRoot: '/workspace' }),
    subagentFactory: async () => ({
      async runAdaptiveGraph(input) { calls.push(input); return { schema: 'forge.subagent-adaptive-graph.v1', completed: [] }; },
    }),
  });
  const denied = { id: 't0', projectId: 'p1', metadata: {} };
  assert.equal(gateway.schemasForTask(denied).some((schema) => schema.function.name === 'agent.runGraph'), false);
  const task = { id: 't1', projectId: 'p1', metadata: { operatingPlaneAllowedTools: ['agent.runGraph'] } };
  const schema = gateway.schemasForTask(task).find((item) => item.function.name === 'agent.runGraph');
  assert.equal(schema.function.parameters.properties.jobs.maxItems, 64);
  const jobs = [{ id: 'review', profileId: 'worker', objective: 'Review', ownedPaths: ['src/app.mjs'] }];
  const result = await gateway.execute(task, 'agent.runGraph', { jobs, policy: { maxWaves: 8 } });
  assert.equal(result.output.schema, 'forge.subagent-adaptive-graph.v1');
  assert.deepEqual(calls[0].jobs, jobs);
  assert.equal(calls[0].policy.maxWaves, 8);
});

test('application exposes governor-aware adaptive graph execution through the subagent factory', async () => {
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /new SubagentOrchestrator\(\{[^}]*governor:\s*resourceGovernor/s);
  assert.match(app, /runAdaptiveGraph:\s*\(input\)\s*=>\s*orchestrator\.runAdaptiveGraph/);
});
