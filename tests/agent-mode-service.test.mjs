import test from 'node:test';
import assert from 'node:assert/strict';

import { AGENT_MODE_IDS, AgentModeRegistry } from '../src/agents/agent-mode-registry.mjs';
import { AgentModeService } from '../src/agents/agent-mode-service.mjs';

const EXPECTED = [
  'ask','read-only','plan','edit-approved','auto-edit','review','debug','test-writer','refactor','migration',
  'architecture','project-create','ci-repair','issue-resolution','background','learn-codebase','explain','fast','deep','offline',
];

test('registry exposes exactly 20 immutable enforceable modes', () => {
  const registry = new AgentModeRegistry();
  assert.deepEqual([...AGENT_MODE_IDS], EXPECTED);
  assert.deepEqual(registry.list().map((mode) => mode.id), EXPECTED);
  for (const mode of registry.list()) {
    assert.match(mode.schema, /^forge\.agent-mode\.v1$/);
    assert.ok(['guided','workspace-autopilot','sandbox-autopilot'].includes(mode.autonomyProfile));
    assert.ok(['always','state-change','risk-based'].includes(mode.approvalPolicy));
    assert.ok(['deny','allowlist'].includes(mode.networkPolicy.mode));
    assert.ok(['deny','ask','allow'].includes(mode.commitPolicy));
    assert.ok(['intelligence','balance','cost'].includes(mode.routingMode));
    assert.ok(['none','targeted','full'].includes(mode.verificationDepth));
    assert.ok(Number.isInteger(mode.maxTasks) && mode.maxTasks > 0);
    assert.ok(Number.isInteger(mode.maxTurns) && mode.maxTurns > 0);
    assert.ok(Number.isInteger(mode.budgetTokens) && mode.budgetTokens >= 256);
    assert.ok(Object.isFrozen(mode));
  }
});

test('resolver produces a canonical receipt and narrowing-only policy', () => {
  const service = new AgentModeService();
  const resolved = service.resolve({ modeId: 'deep', overrides: { maxTasks: 12, maxTurns: 40, budgetTokens: 80_000, allowChildAgents: false, networkPolicy: { mode: 'deny' }, commitPolicy: 'ask', toolGroups: ['read','search','edit','test'] } });
  assert.equal(resolved.modeId, 'deep');
  assert.equal(resolved.policy.maxTasks, 12);
  assert.equal(resolved.policy.maxTurns, 40);
  assert.equal(resolved.policy.budgetTokens, 80_000);
  assert.equal(resolved.policy.allowChildAgents, false);
  assert.equal(resolved.policy.networkPolicy.mode, 'deny');
  assert.equal(resolved.policy.commitPolicy, 'ask');
  assert.deepEqual(resolved.policy.toolGroups, ['read','search','edit','test']);
  assert.match(resolved.receiptSha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(resolved), /prompt|token-value|secret/i);
});

test('resolver rejects permission-broadening overrides', () => {
  const service = new AgentModeService();
  assert.throws(() => service.resolve({ modeId: 'read-only', overrides: { readOnly: false } }), { code: 'AGENT_MODE_OVERRIDE_BROADENS_POLICY' });
  assert.throws(() => service.resolve({ modeId: 'plan', overrides: { commitPolicy: 'allow' } }), { code: 'AGENT_MODE_OVERRIDE_BROADENS_POLICY' });
  assert.throws(() => service.resolve({ modeId: 'fast', overrides: { maxTasks: 99 } }), { code: 'AGENT_MODE_OVERRIDE_BROADENS_POLICY' });
  assert.throws(() => service.resolve({ modeId: 'offline', overrides: { localOnly: false } }), { code: 'AGENT_MODE_OVERRIDE_BROADENS_POLICY' });
  assert.throws(() => service.resolve({ modeId: 'review', overrides: { toolGroups: ['read','search','edit'] } }), { code: 'AGENT_MODE_OVERRIDE_BROADENS_POLICY' });
});

test('offline mode requires an available local provider when inventory is supplied', () => {
  const service = new AgentModeService();
  assert.throws(() => service.resolve({ modeId: 'offline', providers: [{ id: 'remote', local: false, available: true }] }), { code: 'AGENT_MODE_LOCAL_PROVIDER_REQUIRED' });
  const result = service.resolve({ modeId: 'offline', providers: [{ id: 'local', local: true, available: true, healthy: true }] });
  assert.equal(result.policy.localOnly, true);
  assert.equal(result.policy.networkPolicy.mode, 'deny');
  assert.equal(result.providerConstraint.localOnly, true);
});

test('read-only families and specialist modes have expected hard boundaries', () => {
  const service = new AgentModeService();
  for (const id of ['ask','read-only','plan','review','architecture','learn-codebase','explain']) {
    const policy = service.resolve({ modeId: id }).policy;
    assert.equal(policy.readOnly, true, id);
    assert.equal(policy.writesAllowed, false, id);
    assert.equal(policy.commitPolicy, 'deny', id);
  }
  assert.equal(service.resolve({ modeId: 'background' }).policy.backgroundAllowed, true);
  assert.equal(service.resolve({ modeId: 'test-writer' }).policy.taskKinds.includes('test'), true);
  assert.equal(service.resolve({ modeId: 'ci-repair' }).policy.taskKinds.includes('ci'), true);
  assert.equal(service.resolve({ modeId: 'migration' }).policy.verificationDepth, 'full');
});
