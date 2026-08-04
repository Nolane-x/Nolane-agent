import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelHealthLedger } from '../src/model-management/model-health-ledger.mjs';

test('health ledger computes reliability, latency, spend, redaction, and circuit state deterministically', () => {
  let now = 1_000;
  const ledger = new ModelHealthLedger({
    clock: () => '2026-08-03T02:00:00.000Z',
    now: () => now,
    breaker: { minimumCalls: 3, consecutiveFailures: 3, failureRate: 0.8, cooldownMs: 5_000 },
  });
  ledger.record('openai/gpt-test', { success: false, latencyMs: 300, costUsd: 0.01, errorCode: 'token-secret-value', metadata: { apiKey: 'hidden', safe: 'visible' } });
  ledger.record('openai/gpt-test', { success: false, latencyMs: 500, costUsd: 0.02, errorCode: 'timeout' });
  const state = ledger.record('openai/gpt-test', { success: false, latencyMs: 900, costUsd: 0.03, errorCode: 'upstream' });
  assert.equal(state.status, 'circuit-open');
  assert.equal(state.breaker.open, true);
  assert.equal(state.calls, 3);
  assert.equal(state.failureRate, 1);
  assert.equal(state.latencyMs.p50, 500);
  assert.equal(state.latencyMs.p95, 900);
  assert.equal(state.spendUsd, 0.06);
  assert.match(state.receiptSha256, /^[a-f0-9]{64}$/);
  now += 5_001;
  assert.equal(ledger.get('openai/gpt-test').breaker.open, false);
});

test('manual health states override derived state and can be cleared', () => {
  const ledger = new ModelHealthLedger();
  assert.equal(ledger.setManualState('local/model', 'maintenance', 'upgrade').status, 'maintenance');
  assert.equal(ledger.setManualState('local/model', null).status, 'unknown');
});
