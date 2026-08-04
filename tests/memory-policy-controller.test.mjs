import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryPolicyController } from '../src/memory/memory-policy-controller.mjs';

const receipt = 'a'.repeat(64);

test('MemoryPolicyController governs all public operations and remains shadow-only', () => {
  const controller = new MemoryPolicyController();
  for (const operation of ['ADD', 'UPDATE', 'DELETE', 'RETRIEVE', 'SUMMARIZE', 'NOOP']) {
    const decision = controller.decide({ operation, evidenceReceiptSha256: receipt, userRequested: operation === 'DELETE', privacyRequest: operation === 'DELETE' });
    assert.equal(decision.operation, operation);
    assert.equal(decision.shadowOnly, true);
    assert.equal(decision.claims.hiddenReasoningStored, false);
  }
});

test('MemoryPolicyController denies consolidation from self-reported usefulness alone', () => {
  const controller = new MemoryPolicyController({ consolidationThreshold: 0.55 });
  const denied = controller.decide({ operation: 'ADD', modelReportedUseful: true, recurrence: 0, surprise: 0, verifiedValue: 0, commitment: 0, evidenceReceiptSha256: receipt });
  assert.equal(denied.allowed, false);
  assert.equal(denied.selectedOperation, 'NOOP');
  assert.match(denied.reasons.join(' '), /governed trigger/i);
});

test('MemoryPolicyController allows consolidation from recurrence, verified value, or commitment', () => {
  const controller = new MemoryPolicyController({ consolidationThreshold: 0.55 });
  const recurrence = controller.decide({ operation: 'ADD', recurrence: 0.9, evidenceReceiptSha256: receipt });
  const verified = controller.decide({ operation: 'SUMMARIZE', verifiedValue: 0.8, evidenceReceiptSha256: receipt });
  const commitment = controller.decide({ operation: 'UPDATE', commitment: 0.9, evidenceReceiptSha256: receipt });
  assert.equal(recurrence.allowed, true);
  assert.equal(verified.allowed, true);
  assert.equal(commitment.allowed, true);
});

test('MemoryPolicyController prioritizes privacy deletion and rejects unverified write evidence', () => {
  const controller = new MemoryPolicyController();
  const deletion = controller.decide({ operation: 'DELETE', privacyRequest: true, userRequested: true, evidenceReceiptSha256: receipt });
  assert.equal(deletion.allowed, true);
  assert.equal(deletion.selectedOperation, 'DELETE');
  assert.equal(deletion.priority, 'mandatory');
  assert.throws(() => controller.decide({ operation: 'ADD', recurrence: 1, evidenceReceiptSha256: 'bad' }), /SHA-256/);
});

test('MemoryPolicyController fails closed for unknown operations and private fields', () => {
  const controller = new MemoryPolicyController();
  assert.throws(() => controller.decide({ operation: 'PROMOTE', evidenceReceiptSha256: receipt }), /unknown/i);
  assert.throws(() => controller.decide({ operation: 'ADD', recurrence: 1, evidenceReceiptSha256: receipt, chainOfThought: 'secret' }), /private|hidden/i);
});
