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

export class Checkpoint7DecisionSupport {
  constructor({ artifactRegistry, abstainThreshold = 0.5 } = {}) {
    if (!artifactRegistry || typeof artifactRegistry.activeTransferEligible !== 'function' || typeof artifactRegistry.activeAblationEligible !== 'function') {
      throw new TypeError('transfer-governed artifactRegistry is required');
    }
    this.artifactRegistry = artifactRegistry;
    this.abstainThreshold = abstainThreshold;
  }

  #infer(artifact, state, specialist) {
    if (!state || typeof state !== 'object') throw new TypeError(`${specialist} state is required`);
    const result = new LinearPolicyRuntime({ artifact, abstainThreshold: this.abstainThreshold }).infer(state, {
      topK: artifact.model.labels.length,
      abstainThreshold: this.abstainThreshold,
    });
    if (result.status !== 'predicted' || !result.action) throw new Error(`${specialist} abstained; checkpoint 7 decision support fails closed`);
    return result;
  }

  decide(input = {}) {
    const decisions = {};
    for (const specialist of CHECKPOINT_6_SPECIALISTS) {
      const artifact = this.artifactRegistry.activeTransferEligible(specialist);
      if (!artifact) throw new Error(`An active transfer-governed artifact is required for ${specialist}`);
      const key = INPUT_BY_SPECIALIST[specialist];
      decisions[key] = this.#infer(artifact, input[key], specialist);
    }
    const processArtifact = this.artifactRegistry.activeAblationEligible('process-reward');
    if (!processArtifact) throw new Error('An active ablation-governed process-reward artifact is required');
    const process = this.#infer(processArtifact, input.process, 'process-reward');

    const tool = decisions.tool.action;
    const context = decisions.context.action;
    const patch = decisions.patch.action;
    const risk = decisions.risk.action;
    const processAction = process.action;
    const blocked = processAction === 'regression'
      || ['high', 'critical'].includes(risk)
      || ['reject', 'rollback'].includes(patch)
      || ['stop', 'rollback'].includes(tool)
      || context === 'exclude';
    const reviewRequired = blocked
      || processAction === 'neutral'
      || risk === 'medium'
      || patch === 'review'
      || context === 'counter-evidence';
    const allowed = !reviewRequired
      && processAction === 'progress'
      && risk === 'low'
      && patch === 'accept'
      && ['read', 'search', 'test', 'patch'].includes(tool)
      && ['support', 'pin'].includes(context);
    const status = allowed ? 'allow' : blocked ? 'blocked' : 'review-required';
    const base = {
      schema: 'nolane.small-model.checkpoint-7-decision-support.v1',
      status,
      allowed,
      requiresApproval: !allowed,
      decisions,
      process,
      policy: {
        transferGovernedSpecialistArtifactsRequired: true,
        ablationGovernedProcessRewardRequired: true,
        failClosedOnMissingArtifact: true,
        failClosedOnAbstention: true,
        regressionProcessBlocked: true,
        neutralProcessRequiresReview: true,
        highOrCriticalRiskBlocked: true,
        rejectOrRollbackPatchBlocked: true,
        stopOrRollbackToolBlocked: true,
        excludedContextBlocked: true,
      },
      hiddenChainOfThoughtStored: false,
      claims: {
        boundedLongHorizonDecisionSupport: true,
        generalCodingIntelligence: false,
        frontierParity: false,
        competitorSuperiority: false,
      },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
