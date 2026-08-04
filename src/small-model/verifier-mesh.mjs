import { canonicalSha256, deepFreeze } from './shared.mjs';
import { VerifierReliabilityLedger } from './verifier-reliability-ledger.mjs';

function safeReason(value, fallback) {
  const text = String(value ?? fallback).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return text.slice(0, 500) || fallback;
}

function normalizeDecision(raw, verifierId) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { pass: false, error: true, abstain: false, reason: `Verifier ${verifierId} returned no decision` };
  }
  if (raw.abstain === true) {
    return { ...raw, pass: false, error: false, abstain: true, reason: safeReason(raw.reason, `Verifier ${verifierId} abstained`) };
  }
  if (raw.pass === true) return { ...raw, pass: true, error: false, abstain: false };
  if (raw.pass === false) return { ...raw, pass: false, error: false, abstain: false, reason: raw.reason ? safeReason(raw.reason, 'Verifier failed') : undefined };
  return { ...raw, pass: false, error: true, abstain: false, reason: `Verifier ${verifierId} returned an invalid decision shape` };
}

function aggregateStatus(decisions) {
  const hasError = decisions.some((decision) => decision.error === true);
  const hasAbstain = decisions.some((decision) => decision.abstain === true);
  const hasPass = decisions.some((decision) => decision.pass === true);
  const hasFail = decisions.some((decision) => decision.pass === false && decision.error !== true && decision.abstain !== true);
  if (hasError) return 'error';
  if (hasFail && hasPass) return 'disagreement';
  if (hasFail) return 'fail';
  if (hasAbstain) return 'abstain';
  if (hasPass && decisions.every((decision) => decision.pass === true)) return 'pass';
  return 'error';
}

export class VerifierMesh {
  #verifiers = new Map();
  #reliability = new VerifierReliabilityLedger();
  #receipts = [];

  register(definition) {
    if (!definition?.id) throw new TypeError('Verifier id is required');
    if (!Array.isArray(definition.soundnessScope) || definition.soundnessScope.length === 0) throw new TypeError('Verifier soundnessScope is required');
    if (definition.readOnly !== true) throw new TypeError('Verifier must be read-only');
    if (definition.independent !== true) throw new TypeError('Verifier independence must be explicit');
    if (typeof definition.evaluate !== 'function') throw new TypeError('Verifier evaluate function is required');
    if (this.#verifiers.has(definition.id)) throw new Error(`Verifier already registered: ${definition.id}`);
    const record = deepFreeze({ ...definition, soundnessScope: [...definition.soundnessScope] });
    this.#verifiers.set(record.id, record);
    this.#reliability.register({ id: record.id, ...(record.reliability ?? {}) });
    return record;
  }

  async verify({ candidateId, expectedEffect = {}, observations = {} } = {}) {
    if (!candidateId) throw new TypeError('candidateId is required');
    if (this.#verifiers.size === 0) throw new Error('No verifiers registered');
    const decisions = [];
    for (const verifier of this.#verifiers.values()) {
      let normalized;
      try {
        const raw = await verifier.evaluate({ candidateId, expectedEffect, observations });
        normalized = normalizeDecision(raw, verifier.id);
      } catch (error) {
        normalized = {
          pass: false,
          error: true,
          abstain: false,
          reason: safeReason(error?.message, `Verifier ${verifier.id} threw`),
          errorName: safeReason(error?.name, 'Error'),
        };
      }
      decisions.push(deepFreeze({
        verifierId: verifier.id,
        soundnessScope: verifier.soundnessScope,
        reliability: this.#reliability.get(verifier.id),
        ...normalized,
      }));
    }
    const status = aggregateStatus(decisions);
    const mutationKilled = decisions.reduce((number, decision) => number + Number(decision.mutationKilled ?? 0), 0);
    const mutationTotal = decisions.reduce((number, decision) => number + Number(decision.mutationTotal ?? 0), 0);
    const processReward = decisions.reduce((number, decision) => number + Number(decision.informationGain ?? 0) + Number(decision.criterionDelta ?? 0) - Number(decision.risk ?? 0) - Number(decision.resourceWaste ?? 0), 0);
    const base = {
      schema: 'nolane.small-model.verification-receipt.v2',
      candidateId,
      status,
      decisions,
      processReward,
      mutationStrength: mutationTotal > 0 ? mutationKilled / mutationTotal : null,
      expectedEffect,
      failClosed: true,
    };
    const receipt = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#receipts.push(receipt);
    return receipt;
  }

  snapshot() {
    return deepFreeze({ schema: 'nolane.small-model.verifier-mesh.v2', verifiers: this.#verifiers.size, receipts: this.#receipts.length, failClosed: true, reliability: this.#reliability.snapshot() });
  }
}
