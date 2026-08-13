import test from 'node:test';
import assert from 'node:assert/strict';

import { MissionPlanner } from '../src/orchestration/mission-planner.mjs';

const validPlan = {
  summary: 'Inspect, implement, and independently verify.',
  tasks: [
    { id: 'scout', title: 'Inspect', objective: 'Map the code.', role: 'scout', dependencies: [], allowedPaths: ['**'], deniedPaths: ['.env'] },
    { id: 'builder', title: 'Build', objective: 'Implement safely.', role: 'builder', dependencies: ['scout'], allowedPaths: ['src/**'], deniedPaths: ['src/secrets/**'] },
    { id: 'reviewer', title: 'Review', objective: 'Review independently.', role: 'reviewer', dependencies: ['builder'], allowedPaths: ['**'], deniedPaths: ['.env'] },
  ],
};

test('MissionPlanner asks an eligible planning provider for a bounded structured DAG', async () => {
  const calls = [];
  const provider = {
    id: 'planner',
    async complete(input) { calls.push(input); return { text: `\n\`\`\`json\n${JSON.stringify(validPlan)}\n\`\`\`` }; },
  };
  const router = { select(input) { calls.push(input); return provider; } };
  const planner = new MissionPlanner({ router });
  const plan = await planner.plan({ projectId: 'project-1', objective: 'Add task isolation', providerId: 'auto' });
  assert.equal(plan.tasks.length, 3);
  assert.equal(plan.tasks[1].allowedPaths[0], 'src/**');
  assert.equal(calls[0].requiredCapabilities.includes('structured-output'), true);
  assert.equal(calls[1].tools.length, 0);
  assert.match(calls[1].messages[1].content, /selfFix/i);
  assert.match(calls[1].messages[1].content, /testMatrix/i);
  assert.match(calls[1].messages[1].content, /Add task isolation/);
});

test('MissionPlanner forwards the selected model and per-turn effort without collapsing them to the provider', async () => {
  let request;
  const provider = { id: 'codex-app-server', async complete(input) { request = input; return { model: 'gpt-5.6-sol', text: JSON.stringify(validPlan) }; } };
  const planner = new MissionPlanner({ router: { select: ({ providerId }) => { assert.equal(providerId, 'codex-app-server'); return provider; } } });
  const result = await planner.plan({ projectId: 'p', objective: 'Use the selected model', providerId: 'codex-app-server', modelId: 'gpt-5.6-sol', effort: 'high' });
  assert.equal(request.model, 'gpt-5.6-sol');
  assert.equal(request.effort, 'high');
  assert.equal(result.metadata.providerId, 'codex-app-server');
  assert.equal(result.metadata.modelId, 'gpt-5.6-sol');
  assert.equal(result.metadata.effort, 'high');
});

test('MissionPlanner performs one repair turn when the first response is invalid JSON', async () => {
  let attempts = 0;
  const provider = { id: 'planner', async complete() { attempts += 1; return { text: attempts === 1 ? 'not json' : JSON.stringify(validPlan) }; } };
  const planner = new MissionPlanner({ router: { select: () => provider }, maxAttempts: 2 });
  const plan = await planner.plan({ projectId: 'p', objective: 'Build' });
  assert.equal(plan.summary, validPlan.summary);
  assert.equal(attempts, 2);
});

test('MissionPlanner rejects plans outside the role and task-count safety envelope', async () => {
  const provider = { id: 'planner', async complete() { return { text: JSON.stringify({ tasks: [{ id: 'x', title: 'X', objective: 'X', role: 'admin', dependencies: [], allowedPaths: ['**'] }] }) }; } };
  const planner = new MissionPlanner({ router: { select: () => provider }, maxAttempts: 1 });
  await assert.rejects(() => planner.plan({ projectId: 'p', objective: 'Build' }), /role|planner/i);
});

test('MissionPlanner defaults omitted write scope to no paths and retains non-negotiable secret denials', async () => {
  const planWithoutScope = structuredClone(validPlan);
  delete planWithoutScope.tasks[1].allowedPaths;
  planWithoutScope.tasks[1].deniedPaths = [];
  const provider = { id: 'planner', async complete() { return { text: JSON.stringify(planWithoutScope) }; } };
  const planner = new MissionPlanner({ router: { select: () => provider } });
  const result = await planner.plan({ projectId: 'p', objective: 'Build' });
  assert.deepEqual(result.tasks[1].allowedPaths, []);
  assert.ok(result.tasks[1].deniedPaths.includes('.env'));
  assert.ok(result.tasks[1].deniedPaths.includes('**/*.key'));
});

test('MissionPlanner requests user input before provider execution when planning evidence is ambiguous', async () => {
  let providerCalls = 0;
  const evidenceGovernance = {
    async preflight(input) {
      assert.equal(input.projectId, 'p');
      return { status: 'needs-input', inputRequest: { required: true, question: 'What specific outcome?', fields: ['objective'] }, receiptSha256: 'a'.repeat(64) };
    },
    enrichPlan() { throw new Error('must not enrich when input is missing'); },
  };
  const planner = new MissionPlanner({ router: { select: () => ({ id: 'planner', async complete() { providerCalls += 1; return { text: JSON.stringify(validPlan) }; } }) }, evidenceGovernance });
  await assert.rejects(() => planner.plan({ projectId: 'p', objective: 'Fix it somehow TODO' }), (error) => {
    assert.equal(error.code, 'PLANNING_INPUT_REQUIRED');
    assert.equal(error.inputRequest.question, 'What specific outcome?');
    assert.equal(error.preflightReceiptSha256, 'a'.repeat(64));
    return true;
  });
  assert.equal(providerCalls, 0);
});

test('MissionPlanner returns evidence-enriched bounded plan metadata when governance is configured', async () => {
  const calls = [];
  const evidenceGovernance = {
    async preflight(input) { calls.push(['preflight', input]); return { status: 'ready', receiptSha256: 'b'.repeat(64) }; },
    enrichPlan(input) {
      calls.push(['enrich', input]);
      return { schema: 'forge.planning-evidence-plan.v1', ...input.plan, receiptSha256: 'c'.repeat(64), scope: { band: 'small' } };
    },
  };
  const provider = { id: 'planner', async complete() { return { text: JSON.stringify(validPlan) }; } };
  const planner = new MissionPlanner({ router: { select: () => provider }, evidenceGovernance });
  const result = await planner.plan({ projectId: 'p', objective: 'Update router behavior and verify it' });
  assert.equal(result.metadata.planningEvidenceReceiptSha256, 'c'.repeat(64));
  assert.equal(result.planningEvidence.scope.band, 'small');
  assert.equal(calls[0][0], 'preflight');
  assert.equal(calls[1][0], 'enrich');
});
