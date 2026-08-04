import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAPABILITY_IDS,
  CapabilityGrantLedger,
  CapabilityRegistry,
} from '../src/security/capability-registry.mjs';

test('CapabilityRegistry defines the complete canonical permission surface and prevents delegation escalation', () => {
  const registry = new CapabilityRegistry();
  assert.equal(CAPABILITY_IDS.length, 26);
  assert.ok(CAPABILITY_IDS.includes('file.read'));
  assert.ok(CAPABILITY_IDS.includes('system.admin'));
  assert.deepEqual(registry.normalize(['file.read', 'file.read', 'git.commit']), ['file.read', 'git.commit']);
  assert.deepEqual(registry.intersect(['file.read', 'git.commit'], ['file.read', 'network.use']), ['file.read']);
  assert.throws(
    () => registry.assertDelegationAllowed({ parent: ['file.read'], requested: ['file.read', 'network.use'] }),
    (error) => error.code === 'CAPABILITY_ESCALATION',
  );
  assert.throws(() => registry.normalize(['unknown.permission']), /Unknown capability/i);
  assert.equal(registry.describe('system.admin').approval, 'always');
  assert.equal(registry.describe('file.read').approval, 'policy');
});

test('CapabilityGrantLedger applies deny-first scoped grants and records auditable approval receipts', () => {
  let now = Date.parse('2026-07-28T00:00:00.000Z');
  const ledger = new CapabilityGrantLedger({ clock: () => now });
  const allow = ledger.grant({
    principalId: 'user-1',
    capabilities: ['file.read', 'network.use'],
    effect: 'allow',
    mode: 'session',
    sessionId: 'session-1',
    scope: { paths: ['src/**'], domains: ['api.example.com'], commands: [] },
    reason: 'Inspect source and call the approved API.',
    expectedImpact: 'Read-only access within the project and one domain.',
    approvedBy: 'owner-1',
  });
  assert.match(allow.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(ledger.authorize({ principalId: 'user-1', capability: 'file.read', sessionId: 'session-1', resource: { path: 'src/app.mjs' } }).decision, 'allow');
  assert.equal(ledger.authorize({ principalId: 'user-1', capability: 'file.read', sessionId: 'session-1', resource: { path: 'docs/readme.md' } }).decision, 'deny');
  assert.equal(ledger.authorize({ principalId: 'user-1', capability: 'network.use', sessionId: 'session-1', resource: { domain: 'api.example.com' } }).decision, 'allow');

  ledger.grant({
    principalId: 'user-1', capabilities: ['network.use'], effect: 'deny', mode: 'persistent',
    scope: { domains: ['api.example.com'] }, reason: 'Incident containment.', expectedImpact: 'Blocks outbound API traffic.', approvedBy: 'security-1',
  });
  const denied = ledger.authorize({ principalId: 'user-1', capability: 'network.use', sessionId: 'session-1', resource: { domain: 'api.example.com' } });
  assert.equal(denied.decision, 'deny');
  assert.equal(denied.code, 'explicit-deny');
  assert.ok(ledger.auditEvents().some((event) => event.type === 'capability.authorization' && event.decision === 'deny'));
});

test('CapabilityGrantLedger supports one-time, session, timed, persistent grants and revocation', () => {
  let now = Date.parse('2026-07-28T00:00:00.000Z');
  const ledger = new CapabilityGrantLedger({ clock: () => now });
  const common = { principalId: 'agent-1', effect: 'allow', reason: 'Approved task action.', expectedImpact: 'Bounded task execution.', approvedBy: 'user-1' };
  const once = ledger.grant({ ...common, capabilities: ['git.commit'], mode: 'once', scope: { repositories: ['repo-1'] } });
  assert.equal(ledger.authorize({ principalId: 'agent-1', capability: 'git.commit', consume: true, resource: { repository: 'repo-1' } }).decision, 'allow');
  assert.equal(ledger.authorize({ principalId: 'agent-1', capability: 'git.commit', consume: true, resource: { repository: 'repo-1' } }).decision, 'deny');

  ledger.grant({ ...common, capabilities: ['agent.spawn'], mode: 'session', sessionId: 's-1' });
  assert.equal(ledger.authorize({ principalId: 'agent-1', capability: 'agent.spawn', sessionId: 's-2' }).decision, 'deny');
  assert.equal(ledger.authorize({ principalId: 'agent-1', capability: 'agent.spawn', sessionId: 's-1' }).decision, 'allow');

  const timed = ledger.grant({ ...common, capabilities: ['network.use'], mode: 'timed', expiresAt: '2026-07-28T00:01:00.000Z', scope: { domains: ['example.com'] } });
  assert.equal(ledger.authorize({ principalId: 'agent-1', capability: 'network.use', resource: { domain: 'example.com' } }).decision, 'allow');
  now += 61_000;
  assert.equal(ledger.authorize({ principalId: 'agent-1', capability: 'network.use', resource: { domain: 'example.com' } }).decision, 'deny');

  const persistent = ledger.grant({ ...common, capabilities: ['file.read'], mode: 'persistent', scope: { paths: ['src/**'] } });
  assert.equal(ledger.authorize({ principalId: 'agent-1', capability: 'file.read', resource: { path: 'src/index.mjs' } }).decision, 'allow');
  ledger.revoke(persistent.id, { revokedBy: 'user-1', reason: 'Task ended.' });
  assert.equal(ledger.authorize({ principalId: 'agent-1', capability: 'file.read', resource: { path: 'src/index.mjs' } }).decision, 'deny');
  assert.ok(ledger.auditEvents().some((event) => event.type === 'capability.revoked' && event.grantId === persistent.id));
  assert.equal(ledger.getGrant(once.id).usesRemaining, 0);
  assert.equal(ledger.getGrant(timed.id).mode, 'timed');
});


test('CapabilityGrantLedger scopes shell permission by command arguments and allows a reviewed grant amendment', () => {
  const ledger = new CapabilityGrantLedger({ clock: () => Date.parse('2026-07-28T00:00:00.000Z') });
  const grant = ledger.grant({
    principalId: 'agent-2', capabilities: ['shell.run'], effect: 'allow', mode: 'persistent',
    scope: { commands: ['git'], arguments: ['status', 'diff', '--*'] },
    reason: 'Allow read-only Git inspection.', expectedImpact: 'Reads repository metadata only.', approvedBy: 'user-1',
  });
  assert.equal(ledger.authorize({ principalId: 'agent-2', capability: 'shell.run', resource: { command: 'git', arguments: ['status', '--short'] } }).decision, 'allow');
  assert.equal(ledger.authorize({ principalId: 'agent-2', capability: 'shell.run', resource: { command: 'git', arguments: ['push'] } }).decision, 'deny');
  const amended = ledger.amend(grant.id, {
    scope: { commands: ['git'], arguments: ['status', 'diff', 'log', '--*'] },
    reason: 'Add bounded log inspection.', expectedImpact: 'Still read-only; includes git log.', approvedBy: 'user-1',
  });
  assert.notEqual(amended.receiptSha256, grant.receiptSha256);
  assert.equal(ledger.authorize({ principalId: 'agent-2', capability: 'shell.run', resource: { command: 'git', arguments: ['log', '--oneline'] } }).decision, 'allow');
  assert.ok(ledger.auditEvents().some((event) => event.type === 'capability.amended' && event.grantId === grant.id));
});
