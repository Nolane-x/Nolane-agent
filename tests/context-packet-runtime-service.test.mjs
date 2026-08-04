import test from 'node:test';
import assert from 'node:assert/strict';

import { ContextOrchestrationKernel } from '../src/agent/context-orchestration-kernel.mjs';
import { ContextPacketRuntimeService } from '../src/context/context-packet-runtime-service.mjs';

const H = 'c'.repeat(64);
const support = { key: 'support', nodeId: 'evn_support', path: 'src/auth/token.ts', startLine: 42, endLine: 81, text: 'rotateRefreshToken rotates the token', sourceHash: H, currentHash: H, confidence: 0.95, score: 0.2, rrfScore: 1 / 61, sources: ['lexical', 'semantic'], reason: 'defines rotation', freshness: 'fresh', lease: { validUntil: 'file_changed', sourceRef: 'src/auth/token.ts', sourceHash: H } };
const counter = { key: 'counter', nodeId: 'evn_counter', path: 'tests/auth.refresh.test.ts', startLine: 10, endLine: 25, text: 'multi-device test passes with independent sessions', sourceHash: H, currentHash: H, confidence: 0.9, score: 0.18, rrfScore: 1 / 61, sources: ['runtime'], reason: 'contradicts single-device hypothesis', freshness: 'fresh', runtime: true, lease: { validUntil: 'test_rerun', sourceRef: 'auth.refresh', sourceHash: H } };

function service({ evidence = [support], counterEvidence = [counter] } = {}) {
  const retrieval = { async retrieve() { return { schema: 'forge.hybrid-evidence-retrieval.v1', queries: [], evidence, counterEvidence, omissions: [], receiptSha256: H }; } };
  const graph = { graph() { return { nodes: [{ id: 'evn_support', status: 'active' }, { id: 'evn_counter', status: 'active' }], edges: [], receiptSha256: H }; } };
  const kernel = new ContextOrchestrationKernel({ clock: () => Date.parse('2026-07-30T00:00:00.000Z'), budgets: { executor: 1_000, debugger: 1_000, planner: 1_000, reviewer: 1_000, subagent: 1_000 } });
  return new ContextPacketRuntimeService({ version: '2.15.0', retrieval, graph, kernel, clock: () => '2026-07-30T00:00:00.000Z' });
}

test('builds a structured context packet with leases, support, counter-evidence, and a token budget', async () => {
  const runtime = service();
  const packet = await runtime.build({
    projectId: 'p1', principalId: 'u1', role: 'executor', budgetTokens: 500,
    goal: { objective: 'Fix refresh token logout' },
    currentState: { failingTests: ['auth.refresh'] }, constraints: ['Do not break multi-device sessions'],
    planStep: { id: 'step-2', objective: 'Inspect rotation logic' }, hypothesis: 'Cookie expiry is the only cause',
    relevantSymbols: ['rotateRefreshToken'], recentFailures: ['token reused'], availableTools: ['fs.read', 'code.references'], completionCriteria: ['auth.refresh passes'],
  });
  assert.equal(packet.schema, 'forge.structured-context-packet.v1');
  assert.equal(packet.goal.objective, 'Fix refresh token logout');
  assert.equal(packet.evidence[0].nodeId, 'evn_support');
  assert.equal(packet.counterEvidence[0].nodeId, 'evn_counter');
  assert.equal(packet.leaseSummary.fresh, 2);
  assert.ok(packet.budget.usedTokens <= 500);
  assert.ok(packet.availableTools.includes('fs.read'));
  assert.match(packet.receiptSha256, /^[a-f0-9]{64}$/);
});

test('packet budget omits low-priority evidence without losing required state fields', async () => {
  const huge = Array.from({ length: 20 }, (_, index) => ({ ...support, key: `support-${index}`, nodeId: `evn_${index}`, text: `code ${index} `.repeat(200), score: 0.2 - index / 1000 }));
  const runtime = service({ evidence: huge, counterEvidence: [] });
  const packet = await runtime.build({ projectId: 'p1', principalId: 'u1', role: 'executor', budgetTokens: 50, goal: { objective: 'Bound context' }, currentState: {}, constraints: [], planStep: {}, availableTools: [], completionCriteria: ['done'] });
  assert.ok(packet.omissions.some((entry) => entry.reason === 'budget-exceeded'));
  assert.equal(packet.goal.objective, 'Bound context');
  assert.deepEqual(packet.completionCriteria, ['done']);
});

test('context audit finds stale references and missing counter-evidence', async () => {
  const runtime = service({ counterEvidence: [] });
  const packet = await runtime.build({ projectId: 'p1', principalId: 'u1', role: 'executor', goal: { objective: 'Investigate' }, currentState: {}, constraints: [], planStep: {}, hypothesis: 'one cause', availableTools: [], completionCriteria: ['test passes'] });
  runtime.graph = { graph() { return { nodes: [], edges: [], receiptSha256: H }; } };
  const audit = runtime.audit({ projectId: 'p1', principalId: 'u1', packet });
  assert.ok(audit.issues.some((issue) => issue.code === 'STALE_OR_MISSING_EVIDENCE'));
  assert.ok(audit.issues.some((issue) => issue.code === 'COUNTER_EVIDENCE_MISSING'));
  assert.equal(audit.ready, false);
});

test('recovery measures state progress and recommends a new path without executing it', () => {
  const runtime = service();
  const recovery = runtime.recover({
    projectId: 'p1', principalId: 'u1',
    recentToolCalls: [
      { tool: 'fs.search', inputHash: 'x', status: 'pass' },
      { tool: 'fs.search', inputHash: 'x', status: 'pass' },
      { tool: 'fs.search', inputHash: 'x', status: 'pass' },
    ],
    testOutcomes: [
      { id: 'auth.refresh', status: 'fail', errorHash: 'e1' },
      { id: 'auth.refresh', status: 'fail', errorHash: 'e1' },
    ],
    previousState: { errorCount: 2, passingTests: 4, evidenceCount: 5, uncertaintyCount: 3 },
    currentState: { errorCount: 2, passingTests: 4, evidenceCount: 5, uncertaintyCount: 3 },
    staleContextCount: 2,
    rejectedHypotheses: [],
    dangerousActionPending: true,
  });
  assert.equal(recovery.progress.madeProgress, false);
  assert.ok(recovery.signals.includes('repeated-tool-call'));
  assert.ok(recovery.signals.includes('repeated-test-failure'));
  assert.ok(recovery.actions.some((action) => action.type === 'freeze-dangerous-action'));
  assert.ok(recovery.actions.some((action) => action.type === 'invalidate-stale-context'));
  assert.ok(recovery.actions.some((action) => action.type === 'delegate-independent-investigation'));
  assert.equal(recovery.executed, false);
  assert.match(recovery.receiptSha256, /^[a-f0-9]{64}$/);
});
