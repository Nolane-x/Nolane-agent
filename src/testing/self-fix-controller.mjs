import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

function boundedInteger(value, fallback, min, max, label) {
  const number = value == null ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new TypeError(`${label} must be between ${min} and ${max}`);
  return number;
}

function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}

function assertActive(signal) {
  if (signal?.aborted) throw Object.assign(new Error('Self-fix run cancelled'), { code: 'SELF_FIX_CANCELLED' });
}

function outputText(result) {
  return [String(result?.output?.stdout ?? ''), String(result?.output?.stderr ?? '')].filter(Boolean).join('\n');
}

function diagnosticState(delta, workspaceSha256) {
  return canonicalSha256({
    workspaceSha256,
    current: [...(delta.newDiagnostics ?? []), ...(delta.persistingDiagnostics ?? [])].map((item) => item.fingerprint).sort(),
  });
}

export class SelfFixController {
  constructor({ testEngine, diagnostics, repair, workspaceFingerprint, maxAttempts = 3, maxStagnantAttempts = 1, eventSink = null } = {}) {
    if (!testEngine?.run || !diagnostics?.compare || typeof repair !== 'function' || typeof workspaceFingerprint !== 'function') {
      throw new TypeError('SelfFixController testEngine, diagnostics, repair, and workspaceFingerprint are required');
    }
    this.testEngine = testEngine;
    this.diagnostics = diagnostics;
    this.repair = repair;
    this.workspaceFingerprint = workspaceFingerprint;
    this.maxAttempts = boundedInteger(maxAttempts, 3, 1, 20, 'maxAttempts');
    this.maxStagnantAttempts = boundedInteger(maxStagnantAttempts, 1, 0, 10, 'maxStagnantAttempts');
    this.eventSink = typeof eventSink === 'function' ? eventSink : null;
  }

  #emit(type, payload) { this.eventSink?.(freeze({ type, ...payload })); }

  #result({ status, reason = null, attempts, history, delta = null }) {
    const base = {
      schema: 'forge.self-fix-result.v1',
      status,
      reason,
      attempts,
      finalDiagnosticReceiptSha256: delta?.receipt?.receiptSha256 ?? null,
      history: history.map((item) => ({ kind: item.kind, status: item.status, receiptSha256: item.receiptSha256, strategyId: item.strategyId ?? null, stateSha256: item.stateSha256 ?? null })),
    };
    return freeze({ ...base, history: freeze(history), receipt: { schema: 'forge.self-fix-receipt.v1', receiptSha256: canonicalSha256(base) } });
  }

  async run({ test = {}, baselineOutput = '', secretValues = [], signal = null } = {}) {
    assertActive(signal);
    const history = [];
    const seenStates = new Map();
    let attempts = 0;
    let stagnantAttempts = 0;
    let previousStrategyId = null;
    let result = await this.testEngine.run({ ...test, signal });
    history.push(freeze({ kind: 'test', status: result.status, receiptSha256: result.receipt?.receiptSha256 ?? canonicalSha256(result) }));
    this.#emit('self-fix.test-completed', { attempt: attempts, status: result.status });
    if (result.status === 'pass') return this.#result({ status: 'pass', attempts, history });

    let delta = this.diagnostics.compare({ baseline: baselineOutput, current: outputText(result), secretValues });
    if (String(baselineOutput).trim() && delta.newDiagnostics.length === 0) {
      return this.#result({ status: 'blocked', reason: 'pre-existing-failures-only', attempts, history, delta });
    }

    while (attempts < this.maxAttempts) {
      assertActive(signal);
      const workspaceSha256 = String(await this.workspaceFingerprint());
      const stateSha256 = diagnosticState(delta, workspaceSha256);
      const priorVisits = seenStates.get(stateSha256) ?? 0;
      seenStates.set(stateSha256, priorVisits + 1);
      stagnantAttempts = priorVisits > 0 ? stagnantAttempts + 1 : 0;
      if (stagnantAttempts > this.maxStagnantAttempts) {
        this.#emit('self-fix.blocked', { reason: 'no-progress', attempts, stateSha256 });
        return this.#result({ status: 'blocked', reason: 'no-progress', attempts, history, delta });
      }

      const requiredStrategyChange = stagnantAttempts > 0;
      const repair = await this.repair(freeze({
        schema: 'forge.self-fix-request.v1',
        attempt: attempts + 1,
        requiredStrategyChange,
        previousStrategyId,
        test: structuredClone(test),
        delta,
        failingTestReceiptSha256: result.receipt?.receiptSha256 ?? null,
        workspaceSha256,
        stateSha256,
        signal,
      }));
      attempts += 1;
      const strategyId = String(repair?.strategyId ?? '').trim();
      if (repair?.status !== 'applied' || !strategyId || !/^[a-f0-9]{64}$/i.test(String(repair?.receiptSha256 ?? ''))) {
        return this.#result({ status: 'blocked', reason: 'repair-not-applied', attempts, history, delta });
      }
      if (requiredStrategyChange && strategyId === previousStrategyId) {
        return this.#result({ status: 'blocked', reason: 'strategy-not-changed', attempts, history, delta });
      }
      previousStrategyId = strategyId;
      history.push(freeze({ kind: 'repair', status: 'applied', strategyId, receiptSha256: repair.receiptSha256, stateSha256 }));
      this.#emit('self-fix.repair-applied', { attempt: attempts, strategyId, stateSha256 });

      assertActive(signal);
      result = await this.testEngine.run({ ...test, signal });
      history.push(freeze({ kind: 'test', status: result.status, receiptSha256: result.receipt?.receiptSha256 ?? canonicalSha256(result) }));
      this.#emit('self-fix.test-completed', { attempt: attempts, status: result.status });
      if (result.status === 'pass') return this.#result({ status: 'pass', attempts, history });

      delta = this.diagnostics.compare({ baseline: baselineOutput, current: outputText(result), secretValues });
      if (String(baselineOutput).trim() && delta.newDiagnostics.length === 0) {
        return this.#result({ status: 'blocked', reason: 'pre-existing-failures-only', attempts, history, delta });
      }
    }
    return this.#result({ status: 'failed', reason: 'attempt-limit', attempts, history, delta });
  }
}
