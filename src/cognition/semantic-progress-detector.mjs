import { finite, signed, text } from './cognition-utils.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
function sha(value, label) { const output = String(value ?? '').trim().toLowerCase(); if (!SHA256.test(output)) throw new TypeError(`${label} must be SHA-256`); return output; }
function count(value, label) { const output = Number(value ?? 0); if (!Number.isSafeInteger(output) || output < 0) throw new TypeError(`${label} must be a non-negative integer`); return output; }

export class SemanticProgressDetector {
  constructor({ clock = () => Date.now(), maxScopes = 10_000, maxObservationsPerScope = 128, noProgressWindow = 3 } = {}) {
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.maxScopes = Math.max(1, Math.floor(Number(maxScopes) || 10_000));
    this.maxObservationsPerScope = Math.max(2, Math.min(10_000, Math.floor(Number(maxObservationsPerScope) || 128)));
    this.noProgressWindow = Math.max(1, Math.min(this.maxObservationsPerScope, Math.floor(Number(noProgressWindow) || 3)));
    this.scopes = new Map();
    this.verificationReceipts = new Map();
  }

  observe(input = {}) {
    const scope = text(input.scope, 'scope', 256);
    const observationId = text(input.observationId, 'observationId', 256);
    const verificationReceiptSha256 = sha(input.verificationReceiptSha256, 'verificationReceiptSha256');
    const existingScope = this.verificationReceipts.get(verificationReceiptSha256);
    if (existingScope) return signed({ schema: 'forge.semantic-progress-observation.v1', scope, observationId, duplicate: true, originalScope: existingScope });
    let journal = this.scopes.get(scope);
    if (!journal) {
      if (this.scopes.size >= this.maxScopes) throw new RangeError(`progress scope capacity exceeded: ${this.maxScopes}`);
      journal = { observations: [], ids: new Set(), lastAtMs: Number.NEGATIVE_INFINITY };
      this.scopes.set(scope, journal);
    }
    if (journal.ids.has(observationId)) throw new TypeError(`duplicate progress observation: ${observationId}`);
    const atMs = input.atMs === undefined ? Math.trunc(Number(this.clock())) : Math.trunc(Number(input.atMs));
    if (!Number.isSafeInteger(atMs) || atMs < journal.lastAtMs) throw new TypeError('progress observation time must be monotonic');
    const previous = journal.observations.at(-1) ?? null;
    const verifiedCriteriaScore = finite(input.verifiedCriteriaScore ?? 0, 'verifiedCriteriaScore', { min: 0 });
    const testsPassed = count(input.testsPassed, 'testsPassed');
    const testsFailed = count(input.testsFailed, 'testsFailed');
    const semanticDiffHash = input.semanticDiffHash == null ? null : sha(input.semanticDiffHash, 'semanticDiffHash');
    const semanticDiffUnits = count(input.semanticDiffUnits, 'semanticDiffUnits');
    const informationGain = finite(input.informationGain ?? 0, 'informationGain', { min: 0, max: 1 });
    const effectVerified = input.effectVerified !== false;
    const signals = [];
    if (!previous || verifiedCriteriaScore > previous.verifiedCriteriaScore) signals.push('verified-criteria-increased');
    if (!previous || testsPassed > previous.testsPassed || testsFailed < previous.testsFailed) signals.push('tests-improved');
    if (semanticDiffUnits > 0 && semanticDiffHash && effectVerified && (!previous || semanticDiffHash !== previous.semanticDiffHash)) signals.push('semantic-change-verified');
    if (informationGain > (previous?.informationGain ?? 0)) signals.push('information-gained');
    const record = Object.freeze({
      observationId, actionFingerprint: text(input.actionFingerprint, 'actionFingerprint', 512), verificationReceiptSha256,
      verifiedCriteriaScore, testsPassed, testsFailed, semanticDiffHash, semanticDiffUnits, informationGain, effectVerified,
      signals: Object.freeze(signals), atMs,
    });
    journal.observations.push(record); journal.ids.add(observationId); journal.lastAtMs = atMs;
    while (journal.observations.length > this.maxObservationsPerScope) {
      const removed = journal.observations.shift(); journal.ids.delete(removed.observationId);
    }
    this.verificationReceipts.set(verificationReceiptSha256, scope);
    return signed({ schema: 'forge.semantic-progress-observation.v1', scope, observationId, duplicate: false, signals, progress: signals.length > 0, atMs });
  }

  evaluate(scopeValue) {
    const scope = text(scopeValue, 'scope', 256);
    const journal = this.scopes.get(scope);
    const observations = journal?.observations ?? [];
    const window = observations.slice(-this.noProgressWindow);
    const signals = [...new Set(window.flatMap((item) => item.signals))].sort();
    const fingerprintCounts = new Map();
    for (const item of window) fingerprintCounts.set(item.actionFingerprint, (fingerprintCounts.get(item.actionFingerprint) ?? 0) + 1);
    const repeatedActionFingerprint = [...fingerprintCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).find(([, count]) => count >= this.noProgressWindow)?.[0] ?? null;
    const noProgress = window.length >= this.noProgressWindow && window.every((item) => item.signals.length === 0);
    const churnOnly = noProgress && window.every((item) => item.semanticDiffUnits > 0 && item.effectVerified === false);
    return signed({
      schema: 'forge.semantic-progress-evaluation.v1', scope,
      status: noProgress ? 'stalled' : observations.length === 0 ? 'unknown' : 'progressing',
      signals, observationCount: observations.length, evaluatedWindow: window.length,
      repeatedActionFingerprint, churnOnly,
      claims: { activityEqualsProgress: false, duplicateVerificationCountsAsProgress: false, churnCountsAsProgress: false },
    });
  }

  snapshot(scopeValue) {
    const scope = text(scopeValue, 'scope', 256);
    const observations = this.scopes.get(scope)?.observations ?? [];
    return signed({ schema: 'forge.semantic-progress-snapshot.v1', scope, observations: observations.map((item) => ({ ...item, signals: [...item.signals] })), evaluation: this.evaluate(scope) });
  }
}
