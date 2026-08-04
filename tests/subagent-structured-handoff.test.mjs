import assert from 'node:assert/strict';
import test from 'node:test';
import { SubagentOrchestrator } from '../src/agents/subagent-orchestrator.mjs';

const profile = { id: 'explorer', name: 'Explorer', description: 'Explore evidence.', prompt: 'Inspect.', tools: [], exclusiveTools: [], mcpServers: [], skills: [], capabilities: [], maxTurns: 4, budgetTokens: 1000, sandboxProfile: 'read-only', allowChildAgents: false };
const parentTask = { id: 'p1', projectId: 'project-1', permissions: ['agent.create'], allowedTools: [], allowedMcpServers: [], allowedSkills: [], maxTurns: 10, budgetTokens: 2000 };
const structuredResult = { task: 'Inspect auth', findings: ['rotation missing'], evidence: ['node-1'], filesExamined: ['src/auth.ts'], hypothesesRejected: ['storage only'], remainingUncertainty: ['multi-device'], recommendedNextAction: 'inspect tests' };

test('SubagentOrchestrator validates and preserves structured results without dumping internal history', async () => {
  const calls = [];
  const orchestrator = new SubagentOrchestrator({ profiles: [profile], runner: async () => ({ summary: 'Found issue', receipts: [], output: null, structuredResult }), resultValidator: async ({ child, result }) => { calls.push([child, result]); return { result, receiptSha256: 'a'.repeat(64) }; } });
  const output = await orchestrator.run({ parentTask, profileId: 'explorer', objective: 'Inspect auth' });
  assert.equal(calls.length, 1);
  assert.deepEqual(output.handoff.result.structuredResult, structuredResult);
  assert.equal(output.handoff.result.structuredResultReceiptSha256, 'a'.repeat(64));
  assert.equal(Object.hasOwn(output.handoff.result, 'history'), false);
});

test('SubagentOrchestrator fails closed when supplied structured evidence is invalid but remains compatible with legacy output', async () => {
  const strict = new SubagentOrchestrator({ profiles: [profile], runner: async () => ({ summary: 'bad', structuredResult }), resultValidator: async () => { const error = new Error('invalid evidence'); error.code = 'SUBAGENT_EVIDENCE_INVALID'; throw error; } });
  await assert.rejects(() => strict.run({ parentTask, profileId: 'explorer', objective: 'Inspect auth' }), /invalid evidence/);
  const legacy = new SubagentOrchestrator({ profiles: [profile], runner: async () => ({ summary: 'legacy', receipts: [], output: { ok: true } }), resultValidator: async () => { throw new Error('must not run'); } });
  const result = await legacy.run({ parentTask, profileId: 'explorer', objective: 'Legacy task' });
  assert.equal(result.handoff.result.summary, 'legacy');
  assert.equal(Object.hasOwn(result.handoff.result, 'structuredResult'), false);
});
