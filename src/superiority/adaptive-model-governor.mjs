import { boundedNumber, deepFreeze, nonEmpty, requireSha256, signed, uniqueStrings } from './superiority-utils.mjs';

const TIER_RANK = Object.freeze({ small: 0, local: 1, medium: 2, large: 3, frontier: 4 });

function posteriorMean(model, taskFamily) {
  const family = model.families.get(taskFamily);
  const alpha = family?.alpha ?? model.alpha;
  const beta = family?.beta ?? model.beta;
  return alpha / (alpha + beta);
}

export class AdaptiveModelGovernor {
  constructor({ clock = () => Date.now(), limits = {} } = {}) {
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.minimumPromotionSamples = Math.max(1, Math.floor(Number(limits.minimumPromotionSamples) || 20));
    this.maxRoutes = Math.max(1, Math.floor(Number(limits.maxRoutes) || 2_000));
    this.models = new Map();
    this.routes = new Map();
  }

  registerModel(input = {}) {
    const modelId = nonEmpty(input.modelId, 'modelId');
    const tier = String(input.tier ?? 'small').toLowerCase();
    if (!(tier in TIER_RANK)) throw new TypeError('Unsupported model tier');
    const privacy = String(input.privacy ?? 'remote').toLowerCase();
    if (!['local', 'remote'].includes(privacy)) throw new TypeError('privacy must be local or remote');
    const status = String(input.status ?? 'shadow').toLowerCase();
    if (!['shadow', 'active', 'disabled'].includes(status)) throw new TypeError('status must be shadow, active, or disabled');
    const baselineReliability = boundedNumber(input.baselineReliability, 0.5, 0.05, 0.99);
    const priorStrength = 10;
    const previous = this.models.get(modelId);
    const model = previous ?? {
      modelId,
      alpha: baselineReliability * priorStrength,
      beta: (1 - baselineReliability) * priorStrength,
      samples: 0,
      verifiedSuccesses: 0,
      failures: 0,
      criticalFailures: 0,
      totalCost: 0,
      totalLatencyMs: 0,
      families: new Map(),
      registeredAtMs: Number(this.clock()),
    };
    Object.assign(model, {
      tier, privacy, status,
      costPer1kTokens: Math.max(0, Number(input.costPer1kTokens) || 0),
      latencyMs: Math.max(0, Number(input.latencyMs) || 0),
      capabilities: uniqueStrings(input.capabilities),
      updatedAtMs: Number(this.clock()),
    });
    this.models.set(modelId, model);
    return signed({ schema: 'nolane.superiority.model-registration.v1', model: this.#publicModel(model) });
  }

  route(input = {}) {
    const taskId = nonEmpty(input.taskId, 'taskId');
    const taskFamily = nonEmpty(input.taskFamily, 'taskFamily');
    const difficulty = boundedNumber(input.difficulty, 0.5);
    const uncertainty = boundedNumber(input.uncertainty, 0.5);
    const blastRadius = boundedNumber(input.blastRadius, 0.5);
    const privacyRequired = input.privacyRequired === true;
    const risk = (difficulty + uncertainty + blastRadius) / 3;
    const independentVerificationRequired = input.verificationCritical === true || risk >= 0.65;
    const tokenBudget = Math.max(1, Math.floor(Number(input.tokenBudget) || 1));
    const active = [...this.models.values()].filter((model) => model.status === 'active' && model.capabilities.includes(taskFamily) && (!privacyRequired || model.privacy === 'local'));
    if (!active.length) throw new Error('No active model satisfies the task and privacy constraints');
    const scored = active.map((model) => {
      const reliability = posteriorMean(model, taskFamily);
      const adjustedReliability = boundedNumber(reliability - difficulty * 0.12 - uncertainty * 0.08, 0, 0, 1);
      const estimatedCost = model.costPer1kTokens * tokenBudget / 1000;
      return { model, reliability, adjustedReliability, estimatedCost };
    });
    let primary;
    if (independentVerificationRequired) {
      scored.sort((a, b) => b.adjustedReliability - a.adjustedReliability || b.reliability - a.reliability || a.estimatedCost - b.estimatedCost || a.model.modelId.localeCompare(b.model.modelId));
      primary = scored[0];
    } else {
      const threshold = 0.55 + risk * 0.15;
      const sufficient = scored.filter((item) => item.adjustedReliability >= threshold);
      const pool = sufficient.length ? sufficient : scored;
      pool.sort((a, b) => (TIER_RANK[a.model.tier] - TIER_RANK[b.model.tier]) || a.estimatedCost - b.estimatedCost || b.adjustedReliability - a.adjustedReliability || a.model.modelId.localeCompare(b.model.modelId));
      primary = pool[0];
    }
    let verifier = null;
    if (independentVerificationRequired) {
      const verifierPool = scored.filter((item) => item.model.modelId !== primary.model.modelId && item.model.capabilities.includes('verification'));
      verifierPool.sort((a, b) => b.adjustedReliability - a.adjustedReliability || a.estimatedCost - b.estimatedCost || a.model.modelId.localeCompare(b.model.modelId));
      verifier = verifierPool[0] ?? null;
      if (!verifier) throw new Error('Independent verification model is unavailable');
    }
    const base = {
      schema: 'nolane.superiority.adaptive-model-route.v1',
      taskId, taskFamily, difficulty, uncertainty, blastRadius, risk, privacyRequired, tokenBudget,
      primaryModelId: primary.model.modelId,
      verifierModelId: verifier?.model.modelId ?? null,
      independentVerificationRequired,
      estimates: {
        primaryReliability: primary.reliability,
        primaryAdjustedReliability: primary.adjustedReliability,
        primaryCost: primary.estimatedCost,
        verifierReliability: verifier?.reliability ?? null,
        verifierCost: verifier?.estimatedCost ?? 0,
      },
      routedAtMs: Number(this.clock()),
      authorization: { automaticModelPromotionAllowed: false, automaticPolicyMutationAllowed: false, humanApprovalRequiredForPromotion: true },
      claims: { rawPromptStored: false, rawModelOutputStored: false, hiddenReasoningStored: false, smallestSufficientModelPolicy: !independentVerificationRequired },
    };
    const route = signed(base);
    this.routes.set(route.receiptSha256, route);
    while (this.routes.size > this.maxRoutes) this.routes.delete(this.routes.keys().next().value);
    return route;
  }

  recordOutcome(input = {}) {
    if (input.observed !== true) throw new Error('Model outcome must be observed');
    const routeReceiptSha256 = requireSha256(input.routeReceiptSha256, 'routeReceiptSha256');
    const route = this.routes.get(routeReceiptSha256);
    if (!route) throw new Error('Unknown model route receipt');
    requireSha256(input.verifierReceiptSha256, 'verifierReceiptSha256');
    const modelId = nonEmpty(input.modelId, 'modelId');
    const model = this.models.get(modelId);
    if (!model) throw new Error(`Unknown model ${modelId}`);
    const verified = input.verified === true;
    const criticalFailure = input.criticalFailure === true;
    model.samples += 1;
    model.totalCost += Math.max(0, Number(input.cost) || 0);
    model.totalLatencyMs += Math.max(0, Number(input.latencyMs) || 0);
    if (verified) { model.alpha += 1; model.verifiedSuccesses += 1; } else { model.beta += criticalFailure ? 2 : 1; model.failures += 1; }
    if (criticalFailure) model.criticalFailures += 1;
    const family = model.families.get(route.taskFamily) ?? { alpha: 1, beta: 1, samples: 0 };
    family.samples += 1;
    if (verified) family.alpha += 1; else family.beta += criticalFailure ? 2 : 1;
    model.families.set(route.taskFamily, family);
    model.updatedAtMs = Number(this.clock());
    return signed({
      schema: 'nolane.superiority.model-outcome.v1', routeReceiptSha256, modelId, taskFamily: route.taskFamily,
      observed: true, verified, criticalFailure, posteriorReliability: posteriorMean(model, route.taskFamily), samples: model.samples,
      authorization: { promotionAllowed: false, humanApprovalRequired: true },
    });
  }

  authorizePromotion(modelId, input = {}) {
    const id = nonEmpty(modelId, 'modelId');
    const model = this.models.get(id);
    if (!model) throw new Error(`Unknown model ${id}`);
    if (input.approvedByHuman !== true) throw new Error('Model promotion requires explicit human approval');
    const actor = nonEmpty(input.actor, 'actor');
    const approvalReceiptSha256 = requireSha256(input.approvalReceiptSha256, 'approvalReceiptSha256');
    if (model.status !== 'shadow') throw new Error('Only shadow models can be promoted');
    if (model.samples < this.minimumPromotionSamples) throw new Error('Model promotion sample threshold not met');
    if (model.criticalFailures > 0) throw new Error('Model with critical failures cannot be promoted');
    model.status = 'active';
    model.updatedAtMs = Number(this.clock());
    return signed({ schema: 'nolane.superiority.model-promotion.v1', modelId: id, status: model.status, actor, approvalReceiptSha256, promotedAtMs: Number(this.clock()), claims: { automaticPromotionAllowed: false } });
  }

  snapshot() {
    return signed({
      schema: 'nolane.superiority.adaptive-model-governor.v1',
      models: [...this.models.values()].map((model) => this.#publicModel(model)).sort((a, b) => a.modelId.localeCompare(b.modelId)),
      routeCount: this.routes.size,
      minimumPromotionSamples: this.minimumPromotionSamples,
      claims: { automaticPromotionAllowed: false, automaticPolicyMutationAllowed: false, rawPromptStored: false, rawModelOutputStored: false, hiddenReasoningStored: false },
    });
  }

  #publicModel(model) {
    return deepFreeze({
      modelId: model.modelId, tier: model.tier, privacy: model.privacy, status: model.status,
      costPer1kTokens: model.costPer1kTokens, latencyMs: model.latencyMs, capabilities: [...model.capabilities],
      reliability: model.alpha / (model.alpha + model.beta), samples: model.samples,
      verifiedSuccesses: model.verifiedSuccesses, failures: model.failures, criticalFailures: model.criticalFailures,
      averageCost: model.samples ? model.totalCost / model.samples : 0,
      averageLatencyMs: model.samples ? model.totalLatencyMs / model.samples : 0,
      families: [...model.families.entries()].map(([taskFamily, stats]) => deepFreeze({ taskFamily, reliability: stats.alpha / (stats.alpha + stats.beta), samples: stats.samples })).sort((a, b) => a.taskFamily.localeCompare(b.taskFamily)),
      registeredAtMs: model.registeredAtMs, updatedAtMs: model.updatedAtMs,
    });
  }
}
