import { canonicalSha256, deepFreeze } from './shared.mjs';
import { LinearPolicyRuntime } from './linear-policy-runtime.mjs';
import { SUPPORTED_BOOTSTRAP_SPECIALISTS } from './bootstrap-specialist-suite-dataset.mjs';

const INPUT_BY_SPECIALIST = Object.freeze({
  'context-scorer': 'context',
  'test-selector': 'test',
  'patch-ranker': 'patch',
  'risk-classifier': 'risk',
});

export class SpecialistDecisionSupport {
  constructor({ artifactRegistry, abstainThreshold = 0.5 } = {}) {
    if (!artifactRegistry || typeof artifactRegistry.active !== 'function') throw new TypeError('artifactRegistry is required');
    this.artifactRegistry = artifactRegistry;
    this.abstainThreshold = abstainThreshold;
  }

  decide(input = {}) {
    const decisions = {};
    for (const specialist of SUPPORTED_BOOTSTRAP_SPECIALISTS) {
      const artifact = this.artifactRegistry.active(specialist);
      if (!artifact) throw new Error(`An active promoted artifact is required for ${specialist}`);
      const key = INPUT_BY_SPECIALIST[specialist];
      const state = input[key];
      if (!state || typeof state !== 'object') throw new TypeError(`${key} state is required`);
      const result = new LinearPolicyRuntime({ artifact, abstainThreshold: this.abstainThreshold }).infer(state, { topK: artifact.model.labels.length });
      if (result.status !== 'predicted' || !result.action) throw new Error(`${specialist} abstained; decision support fails closed`);
      decisions[key] = result;
    }

    const risk = decisions.risk.action;
    const patch = decisions.patch.action;
    const critical = risk === 'critical' || risk === 'high' || patch === 'reject' || patch === 'rollback';
    const requiresApproval = critical || risk === 'medium' || patch === 'review';
    const allowed = !requiresApproval && risk === 'low' && patch === 'accept';
    const status = allowed ? 'allow' : critical ? 'blocked' : 'review-required';
    const base = {
      schema: 'nolane.small-model.specialist-decision-support.v1',
      status,
      allowed,
      requiresApproval,
      decisions,
      policy: {
        failClosedOnMissingArtifact: true,
        failClosedOnAbstention: true,
        highOrCriticalRiskBlocked: true,
        rejectOrRollbackPatchBlocked: true,
      },
      hiddenChainOfThoughtStored: false,
      claims: { boundedDecisionSupport: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
