import { canonicalSha256, deepFreeze } from './shared.mjs';
import { loadModelArtifact } from './model-artifact.mjs';
import { predictLinearPolicy } from './linear-policy-trainer.mjs';
import { boundedNumber } from './shared.mjs';

export class LinearPolicyRuntime {
  #artifact; #threshold;
  constructor({ artifact, abstainThreshold = 0.5 } = {}) {
    this.#artifact = loadModelArtifact(artifact);
    this.#threshold = boundedNumber(abstainThreshold, 'abstainThreshold', { min: 0, max: 1 });
  }
  get artifact() { return this.#artifact; }
  infer(state, { topK = Math.min(3, this.#artifact.model.labels.length), abstainThreshold = this.#threshold } = {}) {
    const limit = Number(topK); if (!Number.isSafeInteger(limit) || limit < 1 || limit > this.#artifact.model.labels.length) throw new TypeError('topK is invalid');
    const threshold = boundedNumber(abstainThreshold, 'abstainThreshold', { min: 0, max: 1 });
    const prediction = predictLinearPolicy(this.#artifact.model, state); const status = prediction.confidence >= threshold ? 'predicted' : 'abstain';
    const base = {
      schema: 'nolane.small-model.linear-policy-inference.v1', specialist: this.#artifact.specialist, artifactSha256: this.#artifact.artifactSha256,
      status, action: status === 'predicted' ? prediction.label : null, confidence: prediction.confidence,
      ranking: prediction.ranking.slice(0, limit), abstainThreshold: threshold, hiddenChainOfThoughtStored: false,
      claims: { boundedSpecialistInference: true, generalCodingIntelligence: false },
    };
    return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
  snapshot() { return deepFreeze({ schema: 'nolane.small-model.linear-policy-runtime.v1', specialist: this.#artifact.specialist, artifactSha256: this.#artifact.artifactSha256, labels: this.#artifact.model.labels, dimensions: this.#artifact.model.dimensions, abstainThreshold: this.#threshold }); }
}
