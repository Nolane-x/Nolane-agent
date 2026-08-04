import assert from 'node:assert/strict';
import test from 'node:test';

import { OutcomeMetricsStore } from '../src/providers/outcome-aware-router.mjs';
import { ProviderOutcomeFeedbackService } from '../src/providers/provider-outcome-feedback-service.mjs';

function task() {
  return {
    id: 'task-1',
    role: 'builder',
    metadata: { handoff: { providerId: 'deep' }, taskKind: 'debug' },
  };
}

test('ProviderOutcomeFeedbackService records commit-bound verification and authenticated retention feedback idempotently', () => {
  const metrics = new OutcomeMetricsStore({ file: ':memory:' });
  const service = new ProviderOutcomeFeedbackService({ metrics, taskResolver: (id) => id === 'task-1' ? task() : null });

  const verification = service.recordVerification({ taskId: 'task-1', verified: true, evidenceReceiptSha256: 'a'.repeat(64), costUsd: 0.2, latencyMs: 1200 });
  const duplicate = service.recordVerification({ taskId: 'task-1', verified: true, evidenceReceiptSha256: 'a'.repeat(64) });
  assert.equal(verification.recorded, true);
  assert.equal(duplicate.recorded, false);

  assert.throws(() => service.recordUserFeedback({ taskId: 'task-1', accepted: true, evidenceReceiptSha256: 'b'.repeat(64) }, null), /authenticated principal/i);
  const feedback = service.recordUserFeedback({ taskId: 'task-1', accepted: true, retainedLines: 90, generatedLines: 100, correctionCount: 1, evidenceReceiptSha256: 'b'.repeat(64) }, { subject: 'alice' });
  assert.equal(feedback.recorded, true);
  assert.equal(feedback.providerId, 'deep');
  assert.equal(feedback.actor, 'alice');
  assert.equal(Object.hasOwn(feedback, 'prompt'), false);
  assert.equal(metrics.summary('deep', 'debug').retentionRate, 0.9);
  metrics.close();
});

test('ProviderOutcomeFeedbackService rejects unknown tasks, missing provider provenance, and invalid evidence hashes', () => {
  const metrics = new OutcomeMetricsStore({ file: ':memory:' });
  const missing = new ProviderOutcomeFeedbackService({ metrics, taskResolver: () => null });
  assert.throws(() => missing.recordVerification({ taskId: 'missing', verified: true, evidenceReceiptSha256: 'a'.repeat(64) }), /unknown task/i);
  const noProvider = new ProviderOutcomeFeedbackService({ metrics, taskResolver: () => ({ id: 'task-2', role: 'builder', metadata: {} }) });
  assert.throws(() => noProvider.recordVerification({ taskId: 'task-2', verified: true, evidenceReceiptSha256: 'a'.repeat(64) }), /provider provenance/i);
  const service = new ProviderOutcomeFeedbackService({ metrics, taskResolver: () => task() });
  assert.throws(() => service.recordVerification({ taskId: 'task-1', verified: true, evidenceReceiptSha256: 'bad' }), /receipt/i);
  metrics.close();
});
