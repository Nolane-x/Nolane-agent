import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const OPERATIONS = new Set(['ADD', 'UPDATE', 'DELETE', 'RETRIEVE', 'SUMMARIZE', 'NOOP']);
const HASH = /^[a-f0-9]{64}$/i;
const PRIVATE = /(?:chainOfThought|hiddenReasoning|rawPrompt|rawOutput|secret|password|credential|authorization|api[_-]?key|access[_-]?token|refresh[_-]?token)/i;

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function clamp(value) { const n = Number(value ?? 0); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0; }
function publicInput(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (PRIVATE.test(key)) throw new TypeError(`private or hidden field is not allowed: ${key}`);
    publicInput(child);
  }
}
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }

export class MemoryPolicyController {
  constructor({ consolidationThreshold = 0.55, weights = {} } = {}) {
    this.threshold = Math.max(0.1, Math.min(1, Number(consolidationThreshold) || 0.55));
    this.weights = Object.freeze({ recurrence: 0.28, surprise: 0.22, verifiedValue: 0.30, commitment: 0.20, userRequested: 1, ...weights });
  }

  decide(input = {}) {
    publicInput(input);
    const operation = String(input.operation ?? '').toUpperCase();
    if (!OPERATIONS.has(operation)) throw new TypeError(`unknown memory policy operation: ${operation}`);
    const evidence = String(input.evidenceReceiptSha256 ?? '');
    if (!HASH.test(evidence)) throw new TypeError('evidenceReceiptSha256 must be a SHA-256 hash');
    const signals = Object.freeze({
      recurrence: clamp(input.recurrence), surprise: clamp(input.surprise ?? input.predictionError), verifiedValue: clamp(input.verifiedValue),
      commitment: clamp(input.commitment), userRequested: input.userRequested === true ? 1 : 0,
    });
    const weightedScore = Object.entries(signals).reduce((sum, [key, value]) => sum + value * Number(this.weights[key] ?? 0), 0);
    const strongestGovernedSignal = Math.max(signals.recurrence, signals.surprise, signals.verifiedValue, signals.commitment);
    const triggerScore = Math.max(weightedScore, strongestGovernedSignal);
    const reasons = [];
    let allowed = false; let selectedOperation = operation; let priority = 'normal';

    if (operation === 'DELETE' && input.privacyRequest === true && input.userRequested === true) {
      allowed = true; priority = 'mandatory'; reasons.push('explicit privacy deletion request');
    } else if (operation === 'RETRIEVE' || operation === 'NOOP') {
      allowed = true; reasons.push(operation === 'RETRIEVE' ? 'read-only governed operation' : 'no state change requested');
    } else if (triggerScore >= this.threshold || input.userRequested === true) {
      allowed = true;
      const active = Object.entries(signals).filter(([, value]) => value > 0).map(([key]) => key);
      reasons.push(`governed triggers satisfied: ${active.join(', ') || 'userRequested'}`);
    } else {
      selectedOperation = 'NOOP';
      reasons.push('no governed trigger reached the consolidation threshold');
      if (input.modelReportedUseful === true) reasons.push('self-reported usefulness is not verification evidence');
    }

    const base = {
      schema: 'forge.memory-policy-decision.v1', operation, selectedOperation, allowed, priority, shadowOnly: true,
      triggerScore: Math.max(0, Math.min(1, triggerScore)), threshold: this.threshold, signals, reasons,
      evidenceReceiptSha256: evidence.toLowerCase(),
      claims: { hiddenReasoningStored: false, rawPromptsStored: false, selfReportedUsefulnessIsEvidence: false, productionPolicyChanged: false },
    };
    return signed(base);
  }
}
