import test from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityGrantLedger, CapabilityRegistry } from '../src/security/capability-registry.mjs';

test('capability governance contract normalizes permissions and authorizes only scoped grants', () => {
  const registry = new CapabilityRegistry();
  assert.deepEqual(registry.normalize(['file.read', 'file.read', 'git.commit']), ['file.read', 'git.commit']);
  const ledger = new CapabilityGrantLedger({ clock: () => 1_000 });
  ledger.grant({ principalId: 'agent', capabilities: ['file.read'], effect: 'allow', mode: 'session', sessionId: 's1', scope: { paths: ['src/**'] }, reason: 'read source', expectedImpact: 'read only', approvedBy: 'owner' });
  assert.equal(ledger.authorize({ principalId: 'agent', capability: 'file.read', sessionId: 's1', resource: { path: 'src/app.mjs' } }).decision, 'allow');
  assert.equal(ledger.authorize({ principalId: 'agent', capability: 'file.read', sessionId: 's1', resource: { path: 'docs/readme.md' } }).decision, 'deny');
});

test('capability governance contract rejects unknown permissions delegation escalation and deny overrides', () => {
  const registry = new CapabilityRegistry();
  assert.throws(() => registry.normalize(['unknown.permission']), /unknown capability/i);
  assert.throws(() => registry.assertDelegationAllowed({ parent: ['file.read'], requested: ['file.read', 'network.use'] }), (error) => error.code === 'CAPABILITY_ESCALATION');
  const ledger = new CapabilityGrantLedger({ clock: () => 1_000 });
  const common = { principalId: 'agent', capabilities: ['network.use'], mode: 'persistent', scope: { domains: ['example.com'] }, reason: 'policy', expectedImpact: 'network', approvedBy: 'owner' };
  ledger.grant({ ...common, effect: 'allow' });
  ledger.grant({ ...common, effect: 'deny' });
  assert.equal(ledger.authorize({ principalId: 'agent', capability: 'network.use', resource: { domain: 'example.com' } }).code, 'explicit-deny');
});
