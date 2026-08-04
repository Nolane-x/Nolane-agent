import test from 'node:test';
import assert from 'node:assert/strict';

import { ActionGuardrailPipeline } from '../src/security/action-guardrail-pipeline.mjs';
import { CapabilityGrantLedger } from '../src/security/capability-registry.mjs';
import { normalizeTaskContract } from '../src/orchestration/task-contract.mjs';

function contract(overrides = {}) {
  return normalizeTaskContract({
    objective: 'Implement and verify one guarded external action with zero scope expansion.',
    successCriteria: [{ id: 'guard', description: 'Guard decision has a receipt', verification: { command: 'node', args: ['--test'] } }],
    scope: { allowedPaths: ['src/**'], deniedPaths: ['secrets/**'] },
    allowedCommands: ['node'],
    networkPolicy: { mode: 'allowlist', domains: ['api.example.com'], ports: [443] },
    testCriteria: ['node --test'], performanceCriteria: ['decision < 100 ms'], securityCriteria: ['deny by default'], compatibilityCriteria: ['Node.js 22'],
    outputContract: { kind: 'receipt', requiredArtifacts: ['verification-report.md'] },
    allowCommit: false, allowDeploy: true, allowInternet: true, autonomy: 'guided', tokenBudget: 10000,
    deadline: '2027-01-01T00:00:00.000Z', riskLevel: 'high', stopConditions: ['guard-denied'], ...overrides,
  });
}

function grant(ledger, capabilities, scope = {}) {
  return ledger.grant({ principalId: 'agent-1', capabilities, effect: 'allow', mode: 'session', sessionId: 's1', scope, reason: 'Task owner approved this narrow action.', expectedImpact: 'Only the declared resource may be accessed.', approvedBy: 'user-1' });
}

test('ActionGuardrailPipeline authorizes scoped network, deploy, database, and secret actions with receipts', () => {
  const ledger = new CapabilityGrantLedger();
  grant(ledger, ['network.use'], { domains: ['api.example.com'] });
  grant(ledger, ['deploy.execute'], { domains: ['deploy.example.com'] });
  grant(ledger, ['database.mutate']);
  grant(ledger, ['secret.read'], { tools: ['vault'] });
  const pipeline = new ActionGuardrailPipeline({ capabilityLedger: ledger });
  const taskContract = contract();
  const cases = [
    { kind: 'network.request', url: 'https://api.example.com/v1', capability: 'network.use', resource: { domain: 'api.example.com' } },
    { kind: 'deploy', environment: 'staging', domain: 'deploy.example.com', capability: 'deploy.execute', resource: { domain: 'deploy.example.com' } },
    { kind: 'database.mutate', database: 'app', operation: 'migrate', capability: 'database.mutate', resource: {} },
    { kind: 'secret.read', provider: 'vault', name: 'api-key', capability: 'secret.read', resource: { tool: 'vault' } },
  ];
  for (const action of cases) {
    const decision = pipeline.authorize({ principalId: 'agent-1', sessionId: 's1', taskContract, action });
    assert.equal(decision.decision, 'allow');
    assert.equal(decision.capability, action.capability);
    assert.match(decision.receiptSha256, /^[a-f0-9]{64}$/);
  }
});

test('ActionGuardrailPipeline is deny-first and returns a stable recovery path without running the action', () => {
  const ledger = new CapabilityGrantLedger();
  grant(ledger, ['network.use'], { domains: ['api.example.com'] });
  ledger.grant({ principalId: 'agent-1', capabilities: ['network.use'], effect: 'deny', mode: 'session', sessionId: 's1', scope: { domains: ['blocked.api.example.com'] }, reason: 'Explicitly blocked host.', expectedImpact: 'No request is sent.', approvedBy: 'security-admin' });
  const pipeline = new ActionGuardrailPipeline({ capabilityLedger: ledger });
  assert.throws(() => pipeline.authorize({ principalId: 'agent-1', sessionId: 's1', taskContract: contract(), action: { kind: 'network.request', url: 'https://blocked.api.example.com' } }), (error) => {
    assert.equal(error.code, 'ACTION_GUARDRAIL_DENIED');
    assert.equal(error.guardrail.capability, 'network.use');
    assert.equal(error.guardrail.recovery.kind, 'request-capability');
    assert.match(error.guardrail.receiptSha256, /^[a-f0-9]{64}$/);
    return true;
  });
});

test('ActionGuardrailPipeline enforces task contract before capability grants', () => {
  const ledger = new CapabilityGrantLedger();
  grant(ledger, ['network.use'], { domains: ['other.example.com'] });
  grant(ledger, ['deploy.execute'], { domains: ['deploy.example.com'] });
  const pipeline = new ActionGuardrailPipeline({ capabilityLedger: ledger });
  assert.throws(() => pipeline.authorize({ principalId: 'agent-1', sessionId: 's1', taskContract: contract(), action: { kind: 'network.request', url: 'https://other.example.com' } }), (error) => error.code === 'ACTION_CONTRACT_DENIED');
  assert.throws(() => pipeline.authorize({ principalId: 'agent-1', sessionId: 's1', taskContract: contract({ allowDeploy: false }), action: { kind: 'deploy', environment: 'staging', domain: 'deploy.example.com' } }), (error) => error.code === 'ACTION_CONTRACT_DENIED');
});
