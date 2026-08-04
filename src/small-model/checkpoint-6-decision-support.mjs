import { canonicalSha256, deepFreeze } from './shared.mjs';
import { LinearPolicyRuntime } from './linear-policy-runtime.mjs';
import { CHECKPOINT_6_SPECIALISTS } from './checkpoint-6-specialist-dataset.mjs';

const INPUT_BY_SPECIALIST = Object.freeze({
  'tool-router': 'tool',
  'context-scorer': 'context',
  'test-selector': 'test',
  'patch-ranker': 'patch',
  'risk-classifier': 'risk',
});

export class Checkpoint6DecisionSupport {
  constructor({ artifactRegistry, abstainThreshold = 0.5 } = {}) {
    if (!artifactRegistry || typeof artifactRegistry.activeAblationEligible !== 'function') throw new TypeError('ablation-aware artifactRegistry is required');
    this.artifactRegistry = artifactRegistry;
    this.abstainThreshold = abstainThreshold;
  }

  decide(input = {}) {
    const decisions = {};
    for (const specialist of CHECKPOINT_6_SPECIALISTS) {
      const artifact = this.artifactRegistry.activeAblationEligible(specialist);
      if (!artifact) throw new Error(`An active ablation-governed artifact is required for ${specialist}`);
      const inputKey = INPUT_BY_SPECIALIST[specialist];
      const state = input[inputKey];
      if (!state || typeof state !== 'object') throw new TypeError(`${inputKey} state is required`);
      const result = new LinearPolicyRuntime({ artifact, abstainThreshold: this.abstainThreshold }).infer(state, {
        topK: artifact.model.labels.length,
        abstainThreshold: this.abstainThreshold,
      });
      if (result.status !== 'predicted' || !result.action) throw new Error(`${specialist} abstained; checkpoint 6 decision support fails closed`);
      decisions[inputKey] = result;
    }
    const tool = decisions.tool.action;
    const context = decisions.context.action;
    const patch = decisions.patch.action;
    const risk = decisions.risk.action;
    const blocked = ['high', 'critical'].includes(risk) || ['reject', 'rollback'].includes(patch) || ['stop', 'rollback'].includes(tool) || context === 'exclude';
    const reviewRequired = blocked || risk === 'medium' || patch === 'review' || context === 'counter-evidence';
    const allowed = !reviewRequired && risk === 'low' && patch === 'accept' && ['read', 'search', 'test', 'patch'].includes(tool) && ['support', 'pin'].includes(context);
    const status = allowed ? 'allow' : blocked ? 'blocked' : 'review-required';
    const base = {
      schema: 'nolane.small-model.checkpoint-6-decision-support.v1', status, allowed, requiresApproval: !allowed, decisions,
      policy: { ablationGovernedArtifactsRequired: true, failClosedOnMissingArtifact: true, failClosedOnAbstention: true, highOrCriticalRiskBlocked: true, rejectOrRollbackPatchBlocked: true, stopOrRollbackToolBlocked: true, excludedContextBlocked: true },
      hiddenChainOfThoughtStored: false,
      claims: { boundedMultiRuntimeDecisionSupport: true, generalCodingIntelligence: false, frontierParity: false, competitorSuperiority: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
