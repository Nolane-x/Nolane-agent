import test from 'node:test';
import assert from 'node:assert/strict';
import { ExfiltrationGuard } from '../src/security/exfiltration-guard.mjs';
import { MissionCapabilityTokenService } from '../src/security/mission-capability-token-service.mjs';
import { AuditHashChain } from '../src/security/audit-hash-chain.mjs';
import { ProtectedBoundaryGuard } from '../src/security/protected-boundary-guard.mjs';

const sha = (c) => c.repeat(64);

test('exfiltration guard blocks secrets across every boundary', () => {
  const guard = new ExfiltrationGuard();
  for (const boundary of ['prompt', 'context', 'memory', 'trace', 'log', 'artifact', 'error', 'network']) {
    const report = guard.inspect({ boundary, payload: 'password=supersecretvalue123', destination: 'external.example' });
    assert.equal(report.status, 'block');
    assert.equal(JSON.stringify(report).includes('supersecretvalue123'), false);
    assert.ok(report.findings.some((finding) => finding.kind === 'secret-material'));
  }
});

test('mission capability tokens expire and revoke without exposing token in receipts', () => {
  let now = 1_000;
  const service = new MissionCapabilityTokenService({ clock: () => now });
  const issued = service.issue({ missionId: 'm1', actorId: 'agent1', capabilities: ['network.use'], ttlMs: 100, maxUses: 2 });
  assert.equal(JSON.stringify(issued.grant).includes(issued.token), false);
  assert.equal(service.authorize({ token: issued.token, missionId: 'm1', capability: 'network.use' }).allowed, true);
  service.revoke({ token: issued.token, actorId: 'operator' });
  assert.equal(service.authorize({ token: issued.token, missionId: 'm1', capability: 'network.use' }).allowed, false);
  const expired = service.issue({ missionId: 'm1', actorId: 'agent1', capabilities: ['shell.run'], ttlMs: 10 });
  now += 20;
  assert.equal(service.authorize({ token: expired.token, missionId: 'm1', capability: 'shell.run' }).reason, 'expired');
});

test('audit hash chain detects tampering, deletion, and reordering', () => {
  const chain = new AuditHashChain();
  const a = chain.append({ actorId: 'a', scope: 'security', event: { type: 'deny', digest: sha('a') } });
  const b = chain.append({ actorId: 'b', scope: 'security', event: { type: 'allow', digest: sha('b') } });
  assert.equal(chain.verify([a, b]).status, 'pass');
  assert.equal(chain.verify([b, a]).status, 'tampered');
  assert.equal(chain.verify([{ ...a, actorId: 'mallory' }, b]).status, 'tampered');
  assert.equal(chain.verify([b]).status, 'tampered');
});

test('protected security boundaries require explicit human override receipt', () => {
  const guard = new ProtectedBoundaryGuard();
  const denied = guard.authorizeChange({ paths: ['src/security/autonomy-policy.mjs'], actor: { id: 'agent', type: 'agent' } });
  assert.equal(denied.allowed, false);
  const allowed = guard.authorizeChange({
    paths: ['src/security/autonomy-policy.mjs'],
    actor: { id: 'human', type: 'human' },
    overrideReceipt: { status: 'approved', receiptSha256: sha('f') },
  });
  assert.equal(allowed.allowed, true);
});
