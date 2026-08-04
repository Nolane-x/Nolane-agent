import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { deepFreeze, nonEmpty, requireSha256, signed, uniqueStrings } from './superiority-utils.mjs';

function topologicalOrder(claims) {
  const byId = new Map(claims.map((claim) => [claim.claimId, claim]));
  const indegree = new Map(claims.map((claim) => [claim.claimId, 0]));
  const outgoing = new Map(claims.map((claim) => [claim.claimId, []]));
  for (const claim of claims) {
    for (const dependency of claim.dependencies) {
      if (!byId.has(dependency)) throw new Error(`Unknown dependency ${dependency} for ${claim.claimId}`);
      indegree.set(claim.claimId, indegree.get(claim.claimId) + 1);
      outgoing.get(dependency).push(claim.claimId);
    }
  }
  const queue = claims.filter((claim) => indegree.get(claim.claimId) === 0).map((claim) => claim.claimId);
  const order = [];
  while (queue.length) {
    const current = queue.shift();
    order.push(current);
    for (const next of outgoing.get(current)) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  if (order.length !== claims.length) throw new Error('Proof claim dependency cycle detected');
  return order;
}

function publicClaims(items) {
  const array = items.map((item) => deepFreeze({ ...item }));
  Object.defineProperty(array, 'hiddenReasoningStored', { value: false, enumerable: false, writable: false });
  return Object.freeze(array);
}

export class ProofMissionCompiler {
  constructor({ clock = () => Date.now(), limits = {} } = {}) {
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.maxPlans = Math.max(1, Math.floor(Number(limits.maxPlans) || 500));
    this.maxEvidencePerClaim = Math.max(1, Math.floor(Number(limits.maxEvidencePerClaim) || 100));
    this.plans = new Map();
  }

  compile(input = {}) {
    const missionId = nonEmpty(input.missionId, 'missionId');
    const goal = nonEmpty(input.goal, 'goal');
    const criteriaInput = Array.isArray(input.criteria) ? input.criteria : [];
    if (!criteriaInput.length) throw new TypeError('criteria must contain at least one claim');
    const seen = new Set();
    const criteria = criteriaInput.map((item) => {
      const claimId = nonEmpty(item?.claimId, 'claimId');
      if (seen.has(claimId)) throw new Error(`Duplicate claimId ${claimId}`);
      seen.add(claimId);
      return {
        claimId,
        kind: 'criterion',
        claim: nonEmpty(item?.claim, `claim ${claimId}`),
        proposerKey: String(item?.proposerKey ?? 'mission-author').trim() || 'mission-author',
        dependencies: uniqueStrings(item?.dependencies),
        positiveEvidenceKinds: uniqueStrings(item?.positiveEvidenceKinds).length ? uniqueStrings(item?.positiveEvidenceKinds) : ['direct-test'],
        falsificationProbeIds: uniqueStrings(item?.falsificationProbeIds),
        minIndependentVerifiers: Math.max(1, Math.floor(Number(item?.minIndependentVerifiers) || 1)),
      };
    });
    const criterionIds = criteria.map((item) => item.claimId);
    const invariants = (Array.isArray(input.invariants) ? input.invariants : []).map((item) => {
      const invariantId = nonEmpty(item?.invariantId, 'invariantId');
      const claimId = `invariant:${invariantId}`;
      if (seen.has(claimId)) throw new Error(`Duplicate claimId ${claimId}`);
      seen.add(claimId);
      return {
        claimId,
        kind: 'invariant',
        claim: nonEmpty(item?.claim, `invariant ${invariantId}`),
        proposerKey: String(item?.proposerKey ?? 'invariant-authority').trim() || 'invariant-authority',
        dependencies: uniqueStrings(item?.dependencies?.length ? item.dependencies : criterionIds),
        positiveEvidenceKinds: uniqueStrings(item?.evidenceKinds),
        falsificationProbeIds: uniqueStrings(item?.falsificationProbeIds),
        minIndependentVerifiers: Math.max(1, Math.floor(Number(item?.minIndependentVerifiers) || 1)),
      };
    });
    const claims = [...criteria, ...invariants];
    const executionOrder = topologicalOrder(claims);
    const createdAtMs = Number(this.clock());
    const planId = `proof:${missionId}:${canonicalSha256({ missionId, goal, createdAtMs, claims }).slice(0, 16)}`;
    const state = {
      planId,
      missionId,
      goal,
      createdAtMs,
      budget: deepFreeze({ maxTokens: Math.max(0, Number(input?.budget?.maxTokens) || 0), maxElapsedMs: Math.max(0, Number(input?.budget?.maxElapsedMs) || 0) }),
      rollback: deepFreeze({ required: input?.rollback?.required === true, target: input?.rollback?.target ? String(input.rollback.target) : null }),
      claims: new Map(claims.map((claim) => [claim.claimId, { ...claim, evidence: [] }])),
      executionOrder,
    };
    this.plans.set(planId, state);
    while (this.plans.size > this.maxPlans) this.plans.delete(this.plans.keys().next().value);
    return this.evaluate(planId);
  }

  recordEvidence(planId, input = {}) {
    const state = this.#plan(planId);
    const claimId = nonEmpty(input.claimId, 'claimId');
    const claim = state.claims.get(claimId);
    if (!claim) throw new Error(`Unknown claim ${claimId}`);
    if (input.observed !== true) throw new Error('Evidence must be observed');
    const evidenceType = String(input.evidenceType ?? 'positive');
    if (!['positive', 'falsification'].includes(evidenceType)) throw new TypeError('evidenceType must be positive or falsification');
    const status = String(input.status ?? '').toLowerCase();
    if (!['pass', 'fail'].includes(status)) throw new TypeError('status must be pass or fail');
    const record = deepFreeze({
      evidenceId: `evidence:${canonicalSha256({ planId, claimId, input, recordedAtMs: Number(this.clock()) }).slice(0, 20)}`,
      evidenceType,
      kind: evidenceType === 'positive' ? nonEmpty(input.kind, 'kind') : null,
      probeId: evidenceType === 'falsification' ? nonEmpty(input.probeId, 'probeId') : null,
      status,
      observed: true,
      sourceHash: requireSha256(input.sourceHash, 'sourceHash'),
      effectHash: requireSha256(input.effectHash, 'effectHash'),
      verifierId: nonEmpty(input.verifierId, 'verifierId'),
      independenceKey: nonEmpty(input.independenceKey, 'independenceKey'),
      recordedAtMs: Number(this.clock()),
    });
    claim.evidence.push(record);
    while (claim.evidence.length > this.maxEvidencePerClaim) claim.evidence.shift();
    return signed({ schema: 'nolane.superiority.proof-evidence.v1', planId, claimId, evidence: record });
  }

  evaluate(planId) {
    const state = this.#plan(planId);
    const evaluatedById = new Map();
    for (const claimId of state.executionOrder) {
      const claim = state.claims.get(claimId);
      const dependenciesSatisfied = claim.dependencies.every((dependency) => evaluatedById.get(dependency)?.verified === true);
      const positiveSatisfied = claim.positiveEvidenceKinds.every((kind) => claim.evidence.some((item) => item.evidenceType === 'positive' && item.kind === kind && item.status === 'pass' && item.observed));
      const falsificationSatisfied = claim.falsificationProbeIds.every((probeId) => claim.evidence.some((item) => item.evidenceType === 'falsification' && item.probeId === probeId && item.status === 'pass' && item.observed));
      const independent = new Set(claim.evidence.filter((item) => item.status === 'pass' && item.observed && item.independenceKey !== claim.proposerKey).map((item) => item.independenceKey));
      const independentVerifierSatisfied = independent.size >= claim.minIndependentVerifiers;
      const verified = dependenciesSatisfied && positiveSatisfied && falsificationSatisfied && independentVerifierSatisfied;
      evaluatedById.set(claimId, deepFreeze({
        claimId: claim.claimId,
        kind: claim.kind,
        claim: claim.claim,
        dependencies: [...claim.dependencies],
        positiveEvidenceKinds: [...claim.positiveEvidenceKinds],
        falsificationProbeIds: [...claim.falsificationProbeIds],
        minIndependentVerifiers: claim.minIndependentVerifiers,
        dependenciesSatisfied,
        positiveSatisfied,
        falsificationSatisfied,
        independentVerifierSatisfied,
        verified,
        evidenceCount: claim.evidence.length,
      }));
    }
    const claims = state.executionOrder.map((claimId) => evaluatedById.get(claimId));
    const blockedClaimIds = claims.filter((claim) => !claim.verified).map((claim) => claim.claimId);
    const rollbackSatisfied = !state.rollback.required || Boolean(state.rollback.target);
    const deployAllowed = blockedClaimIds.length === 0 && rollbackSatisfied;
    const base = {
      schema: 'nolane.superiority.proof-mission.v1',
      planId: state.planId,
      missionId: state.missionId,
      goal: state.goal,
      createdAtMs: state.createdAtMs,
      executionOrder: [...state.executionOrder],
      budget: state.budget,
      rollback: { ...state.rollback, satisfied: rollbackSatisfied },
      claims: publicClaims(claims),
      blockedClaimIds,
      proofCoverage: claims.length ? claims.filter((claim) => claim.verified).length / claims.length : 0,
      authorization: { deployAllowed, automaticCommitAllowed: false, humanApprovalStillRequired: true },
      boundaries: { hiddenReasoningStored: false, rawPromptStored: false, rawModelOutputStored: false, secretStored: false },
    };
    return signed(base);
  }

  snapshot(planId = null) {
    if (planId) return this.evaluate(planId);
    return signed({ schema: 'nolane.superiority.proof-mission-snapshot.v1', plans: [...this.plans.keys()].map((id) => this.evaluate(id)), claims: { hiddenReasoningStored: false, automaticDeploymentAllowed: false } });
  }

  #plan(planId) {
    const id = nonEmpty(planId, 'planId');
    const state = this.plans.get(id);
    if (!state) throw new Error(`Unknown proof plan ${id}`);
    return state;
  }
}
