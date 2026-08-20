import { finite, signed, text } from './cognition-utils.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const ATTRIBUTION_STATUSES = new Set(['verified', 'inconclusive', 'disputed']);

function sha(value, label) {
  const output = String(value ?? '').trim().toLowerCase();
  if (!SHA256.test(output)) throw new TypeError(`${label} must be SHA-256`);
  return output;
}

function timestamp(value, label) {
  const output = Math.trunc(Number(value));
  if (!Number.isSafeInteger(output) || output < 0) throw new TypeError(`${label} must be a non-negative safe integer`);
  return output;
}

function attributionStatus(value) {
  const output = String(value ?? '').trim().toLowerCase();
  if (!ATTRIBUTION_STATUSES.has(output)) throw new TypeError('causalAttributionStatus must be verified, inconclusive, or disputed');
  return output;
}

export class AgencyLedger {
  constructor({ maxEntries = 1_000 } = {}) {
    this.maxEntries = Math.max(1, Math.min(20_000, Math.floor(Number(maxEntries) || 1_000)));
    this.entries = [];
  }

  record(input = {}) {
    const base = {
      schema: 'forge.agency-record.v1',
      actionId: text(input.actionId, 'actionId', 256),
      taskId: text(input.taskId, 'taskId', 256),
      intent: text(input.intent, 'intent'),
      commandKind: text(input.commandKind, 'commandKind', 128),
      commandFingerprint: text(input.commandFingerprint, 'commandFingerprint', 256),
      expectedEffect: text(input.expectedEffect, 'expectedEffect'),
      claimedEffect: text(input.claimedEffect, 'claimedEffect'),
      verifiedEffect: text(input.verifiedEffect, 'verifiedEffect'),
      effectVerificationReceiptSha256: sha(input.effectVerificationReceiptSha256, 'effectVerificationReceiptSha256'),
      observationAtMs: timestamp(input.observationAtMs, 'observationAtMs'),
      causalAttributionStatus: attributionStatus(input.causalAttributionStatus),
      controllability: finite(input.controllability, 'controllability', { min: 0, max: 1 }),
      responsibleActor: text(input.responsibleActor, 'responsibleActor', 256),
      learningEligible: attributionStatus(input.causalAttributionStatus) === 'verified',
      claims: { rawCommandStored: false, claimedEffectStored: true, verifiedEffectStored: true, effectVerificationReceiptRequired: true, selfReportedEffectEligible: false },
    };
    const record = signed(base);
    this.entries.push(record);
    while (this.entries.length > this.maxEntries) this.entries.shift();
    return record;
  }

  snapshot() { return signed({ schema: 'forge.agency-ledger-snapshot.v1', entries: [...this.entries], count: this.entries.length }); }
}
