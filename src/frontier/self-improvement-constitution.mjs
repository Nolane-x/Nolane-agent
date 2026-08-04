import { boundedArray, finite, sha, signed, text } from './frontier-utils.mjs';

const FORBIDDEN = new Set(['change-acceptance-criteria', 'disable-verifier', 'delete-audit', 'broaden-filesystem', 'broaden-network', 'expand-autonomy', 'remove-human-merge-gate', 'remove-rollback']);
const STAGES = ['candidate', 'sandbox', 'held-out', 'regression', 'red-team', 'shadow', 'canary'];
const TYPES = new Set(['policy', 'skill', 'memory']);

export class SelfImprovementConstitution {
  constructor({ maxCandidates = 1_000 } = {}) { this.maxCandidates = maxCandidates; this.candidates = new Map(); Object.freeze(FORBIDDEN); Object.freeze(STAGES); }

  evaluateCandidate(input = {}) {
    if (this.candidates.size >= this.maxCandidates) throw new RangeError('self-improvement candidate limit exceeded');
    const candidateId = text(input.candidateId, 'candidateId', 200); if (this.candidates.has(candidateId)) throw new TypeError(`duplicate candidate: ${candidateId}`);
    const artifactType = text(input.artifactType, 'artifactType', 40); if (!TYPES.has(artifactType)) throw new TypeError(`unsupported self-improvement artifact: ${artifactType}`);
    const irreversibility = finite(input.irreversibility, 'irreversibility', 0, 1);
    const evidenceScore = finite(input.evidenceScore, 'evidenceScore', 0, 1);
    const requiredEvidenceThreshold = Math.min(0.99, 0.65 + 0.35 * irreversibility);
    const changes = boundedArray(input.changes ?? [], 'changes', 100).map((change) => ({ kind: text(change.kind, 'change.kind', 100), scope: text(change.scope, 'change.scope', 100) }));
    const blockers = [];
    for (const change of changes) if (FORBIDDEN.has(change.kind)) blockers.push(`forbidden:${change.kind}`);
    if (evidenceScore < requiredEvidenceThreshold) blockers.push('evidence-threshold-not-met');
    if (input.viability?.withinRegion !== true) blockers.push('viability-region-failed');
    if (!input.viability?.receiptSha256) blockers.push('viability-receipt-missing');
    if (String(input.requestedAutonomy ?? '') !== 'unchanged') blockers.push('autonomy-expansion-forbidden');
    const base = {
      schema: 'forge.self-improvement-candidate.v1', candidateId, artifactType,
      version: text(input.version, 'version', 128), provenanceReceiptSha256: sha(input.provenanceReceiptSha256, 'provenanceReceiptSha256'),
      rollbackRef: text(input.rollbackRef, 'rollbackRef', 300), irreversibility, evidenceScore, requiredEvidenceThreshold,
      viabilityReceiptSha256: input.viability?.receiptSha256 ? sha(input.viability.receiptSha256, 'viability.receiptSha256') : null,
      requestedAutonomy: String(input.requestedAutonomy ?? ''), changes,
      allowed: blockers.length === 0, blockers: [...new Set(blockers)].sort(), stages: [],
      claims: { productionPromotionExecuted: false, autonomyExpanded: false, acceptanceCriteriaChanged: false, verifierDisabled: false, auditDeleted: false, filesystemOrNetworkBroadened: false },
    };
    const receipt = signed(base);
    this.candidates.set(candidateId, { ...base, receiptSha256: receipt.receiptSha256 });
    return receipt;
  }

  recordStage(candidateId, input = {}) {
    const state = this.#state(candidateId); if (!state.allowed) throw new Error('blocked candidate cannot advance');
    const stage = text(input.stage, 'stage', 40); const expected = STAGES[state.stages.length];
    if (stage !== expected) throw new Error(`expected stage ${expected ?? 'none'}, received ${stage}`);
    const status = text(input.status, 'status', 20); if (status !== 'pass') throw new Error(`stage ${stage} did not pass`);
    const event = signed({ schema: 'forge.self-improvement-stage.v1', candidateId: state.candidateId, stage, status, sourceReceiptSha256: sha(input.receiptSha256, 'receiptSha256') });
    state.stages.push(event);
    return event;
  }

  authorizePromotion(candidateId, input = {}) {
    const state = this.#state(candidateId);
    if (!state.allowed) throw new Error('candidate is constitutionally blocked');
    if (state.stages.length !== STAGES.length || state.stages.some((event, index) => event.stage !== STAGES[index] || event.status !== 'pass')) throw new Error('candidate has not passed the full constitutional pipeline');
    if (input.approved !== true) throw new Error('human approval is required');
    return signed({ schema: 'forge.self-improvement-promotion-authorization.v1', candidateId: state.candidateId, status: 'ready-for-human-controlled-promotion', actor: text(input.actor, 'actor', 160), sourceReceiptSha256: sha(input.receiptSha256, 'receiptSha256'), candidateReceiptSha256: state.receiptSha256, stageReceiptSha256: state.stages.map((event) => event.receiptSha256), claims: { productionPromotionExecuted: false, autonomyExpanded: false, humanExecutionRequired: true } });
  }

  snapshot() { return signed({ schema: 'forge.self-improvement-constitution.v1', immutableRules: { forbiddenChangeKinds: [...FORBIDDEN].sort(), requiredStages: [...STAGES] }, candidates: [...this.candidates.values()].map((state) => ({ candidateId: state.candidateId, artifactType: state.artifactType, version: state.version, allowed: state.allowed, blockers: state.blockers, stages: state.stages.map((event) => event.stage), receiptSha256: state.receiptSha256 })), claims: { productionPromotionExecuted: false, autonomyExpanded: false, superiorityClaimAllowed: false } }); }
  #state(id) { const candidateId = text(id, 'candidateId', 200); const state = this.candidates.get(candidateId); if (!state) throw new RangeError(`unknown candidate: ${candidateId}`); return state; }
}
