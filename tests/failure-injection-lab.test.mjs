import test from 'node:test';
import assert from 'node:assert/strict';

import { FailureInjectionLab } from '../src/verification/failure-injection-lab.mjs';

const faults = ['network-loss', 'process-death', 'database-lock', 'stale-file-race', 'memory-pressure'];

for (const faultType of faults) {
  test(`proves bounded recovery for ${faultType}`, async () => {
    const events = [];
    const lab = new FailureInjectionLab({ clock: (() => { let now = 1000; return () => (now += 10); })() });
    const proof = await lab.run({
      taskId: `task-${faultType}`,
      criterionId: 'criterion-recovery',
      faultType,
      lease: { maxAttempts: 1, maxDurationMs: 1000 },
      checkpointAdapter: {
        save: async () => { events.push('checkpoint'); return { checkpointId: 'cp-1', sourceHash: 'a'.repeat(64), receiptSha256: 'b'.repeat(64) }; },
        resume: async (checkpoint) => { events.push(`resume:${checkpoint.checkpointId}`); return { status: 'pass', checkpointId: checkpoint.checkpointId, receiptSha256: 'c'.repeat(64) }; },
      },
      faultAdapter: {
        inject: async (input) => { events.push(`inject:${input.faultType}`); return { status: 'injected', reversible: true, receiptSha256: 'd'.repeat(64) }; },
        clear: async () => { events.push('clear'); return { status: 'pass', receiptSha256: 'e'.repeat(64) }; },
      },
      operation: async () => { events.push('operation'); return { status: 'degraded', irreversibleActions: 0, receiptSha256: 'f'.repeat(64) }; },
      recoveryAdapter: {
        recover: async () => { events.push('recover'); return { status: 'pass', strategy: 'resume-checkpoint', receiptSha256: '1'.repeat(64) }; },
      },
      verify: async () => { events.push('verify'); return { status: 'pass', criterionId: 'criterion-recovery', receiptSha256: '2'.repeat(64) }; },
    });
    assert.equal(proof.status, 'pass');
    assert.equal(proof.irreversibleActions, 0);
    assert.equal(proof.attempts, 1);
    assert.deepEqual(events, ['checkpoint', `inject:${faultType}`, 'operation', 'recover', 'resume:cp-1', 'clear', 'verify']);
    assert.equal(proof.claims.directOsFaultInjected, false);
  });
}

test('fails closed when recovery performs an irreversible action or criterion is not reverified', async () => {
  const lab = new FailureInjectionLab();
  const proof = await lab.run({
    taskId: 'task-fail', criterionId: 'criterion', faultType: 'network-loss', lease: { maxAttempts: 1, maxDurationMs: 1000 },
    checkpointAdapter: { save: async () => ({ checkpointId: 'cp', sourceHash: 'a'.repeat(64), receiptSha256: 'b'.repeat(64) }), resume: async () => ({ status: 'pass', checkpointId: 'cp', receiptSha256: 'c'.repeat(64) }) },
    faultAdapter: { inject: async () => ({ status: 'injected', reversible: true, receiptSha256: 'd'.repeat(64) }), clear: async () => ({ status: 'pass', receiptSha256: 'e'.repeat(64) }) },
    operation: async () => ({ status: 'degraded', irreversibleActions: 1, receiptSha256: 'f'.repeat(64) }),
    recoveryAdapter: { recover: async () => ({ status: 'pass', strategy: 'unsafe', receiptSha256: '1'.repeat(64) }) },
    verify: async () => ({ status: 'fail', criterionId: 'criterion', receiptSha256: '2'.repeat(64) }),
  });
  assert.equal(proof.status, 'fail');
  assert.ok(proof.reasons.includes('irreversible-action-during-uncertainty'));
  assert.ok(proof.reasons.includes('criterion-not-reverified'));
});
