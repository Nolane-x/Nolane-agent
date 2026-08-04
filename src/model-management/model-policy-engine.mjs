import { deepFreeze, sha256Receipt } from '../model-profiles/model-profile-schema.mjs';

const TASK_ORDER = Object.freeze(['micro', 'small', 'medium', 'large', 'frontier']);
const DEFAULT_WEIGHTS = Object.freeze({ quality: 0.34, reliability: 0.23, cost: 0.14, latency: 0.12, confidence: 0.09, locality: 0.05, lifecycle: 0.03 });

function finite(value) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, Number(value) || 0)); }
function taskIndex(value) { const index = TASK_ORDER.indexOf(String(value ?? 'medium')); return index < 0 ? 2 : index; }
function capability(profile, name) {
  const map = {
    toolCalling: profile.toolCalling?.supported,
    parallelTools: profile.toolCalling?.parallel,
    structuredOutput: profile.capabilities?.structuredOutput,
    vision: profile.modalities?.input?.image ?? profile.capabilities?.vision,
    audio: profile.modalities?.input?.audio,
    video: profile.modalities?.input?.video,
    computerUse: profile.capabilities?.computerUse,
    embeddings: profile.capabilities?.embeddings,
    reasoning: profile.reasoning?.supported ?? profile.capabilities?.reasoning,
    coding: profile.capabilities?.coding,
    streaming: profile.capabilities?.streaming,
    promptCaching: profile.capabilities?.promptCaching,
    batch: profile.capabilities?.batch,
  };
  return map[name] ?? profile.capabilities?.[name];
}

function qualityFor(profile, request) {
  const dimensions = Array.isArray(request.qualityDimensions) && request.qualityDimensions.length
    ? request.qualityDimensions
    : request.taskKind === 'frontend' ? ['frontend', 'coding', 'instructionFollowing']
      : request.taskKind === 'debugging' ? ['debugging', 'coding', 'reasoning']
        : request.taskKind === 'large-refactor' ? ['largeRefactor', 'coding', 'toolUse']
          : ['coding', 'reasoning', 'toolUse'];
  const values = dimensions.map((key) => finite(profile.quality?.[key])).filter(Number.isFinite);
  return values.length ? clamp((values.reduce((sum, value) => sum + value, 0) / values.length) / 5) : 0.35;
}

function estimateCost(profile, request) {
  const inputTokens = Math.max(0, finite(request.expectedInputTokens) ?? 0);
  const outputTokens = Math.max(0, finite(request.expectedOutputTokens) ?? 0);
  const inputPrice = finite(profile.pricing?.inputPerMillion);
  const outputPrice = finite(profile.pricing?.outputPerMillion);
  if ((inputTokens > 0 && inputPrice == null) || (outputTokens > 0 && outputPrice == null)) return null;
  return (inputTokens * (inputPrice ?? 0) + outputTokens * (outputPrice ?? 0)) / 1_000_000;
}

function normalizeWeights(input = {}) {
  const merged = { ...DEFAULT_WEIGHTS, ...input };
  const positive = Object.fromEntries(Object.entries(merged).map(([key, value]) => [key, Math.max(0, finite(value) ?? 0)]));
  const total = Object.values(positive).reduce((sum, value) => sum + value, 0) || 1;
  return Object.freeze(Object.fromEntries(Object.entries(positive).map(([key, value]) => [key, value / total])));
}

export class ModelPolicyEngine {
  constructor({ defaultWeights = DEFAULT_WEIGHTS } = {}) {
    this.defaultWeights = normalizeWeights(defaultWeights);
  }

  evaluate(profile, { health = null, availability = null, request = {} } = {}) {
    if (!profile?.canonicalId) throw new TypeError('A normalized model profile is required');
    const blockers = [];
    const warnings = [];
    const requiredCapabilities = [...new Set((request.requiredCapabilities ?? []).map(String))];
    for (const name of requiredCapabilities) {
      const actual = capability(profile, name);
      if (actual !== true) blockers.push({ code: `capability-${name}`, message: `${name} is required but is ${actual === false ? 'unsupported' : 'unverified'}.` });
    }
    const requestedClass = request.taskClass ?? 'medium';
    const maximumClass = profile.taskEnvelope?.maximumClass;
    if (maximumClass && taskIndex(requestedClass) > taskIndex(maximumClass)) blockers.push({ code: 'task-envelope-exceeded', message: `${requestedClass} exceeds maximum class ${maximumClass}.` });
    const minContext = finite(request.minContextWindow);
    const context = finite(profile.context?.contextWindow ?? profile.context?.maxInputTokens);
    if (minContext != null && (context == null || context < minContext)) blockers.push({ code: 'context-insufficient', message: `Context ${context ?? 'unknown'} is below ${minContext}.` });
    if (request.localOnly === true && profile.deployment?.local !== true) blockers.push({ code: 'local-required', message: 'A local deployment is required.' });
    if (request.remoteAllowed === false && profile.deployment?.remote === true) blockers.push({ code: 'remote-forbidden', message: 'Remote deployments are forbidden.' });
    const ram = finite(profile.localRequirements?.estimatedRamGB);
    const maxRam = finite(request.maxRamGB);
    if (maxRam != null && ram != null && ram > maxRam) blockers.push({ code: 'ram-budget-exceeded', message: `Estimated RAM ${ram} GB exceeds ${maxRam} GB.` });
    const confidence = clamp(profile.provenance?.confidence?.overall ?? 0);
    const minimumConfidence = finite(request.minimumConfidence);
    if (minimumConfidence != null && confidence < minimumConfidence) blockers.push({ code: 'confidence-too-low', message: `Profile confidence ${confidence.toFixed(2)} is below ${minimumConfidence}.` });
    const lifecycle = String(profile.lifecycle?.status ?? 'unknown');
    if (['retired', 'disabled'].includes(lifecycle)) blockers.push({ code: 'lifecycle-blocked', message: `Model lifecycle is ${lifecycle}.` });
    else if (['deprecated', 'preview', 'experimental', 'unknown'].includes(lifecycle)) warnings.push({ code: `lifecycle-${lifecycle}`, message: `Model lifecycle is ${lifecycle}.` });
    if (request.allowPreview === false && ['preview', 'experimental'].includes(lifecycle)) blockers.push({ code: 'preview-forbidden', message: 'Preview or experimental models are forbidden.' });
    if (availability?.available === false || availability?.authenticated === false || availability?.healthy === false) blockers.push({ code: 'provider-unavailable', message: 'Provider deployment is not ready.' });
    if (health?.status === 'circuit-open' || health?.status === 'offline' || health?.status === 'maintenance') blockers.push({ code: `health-${health.status}`, message: `Model health is ${health.status}.` });
    else if (health?.status === 'degraded' || health?.status === 'unhealthy') warnings.push({ code: `health-${health.status}`, message: `Model health is ${health.status}.` });
    const estimatedCostUsd = estimateCost(profile, request);
    const maxCostUsd = finite(request.maxCostUsd);
    if (maxCostUsd != null && (estimatedCostUsd == null || estimatedCostUsd > maxCostUsd)) blockers.push({ code: 'cost-budget-exceeded-or-unknown', message: `Estimated cost ${estimatedCostUsd ?? 'unknown'} exceeds or cannot prove budget ${maxCostUsd}.` });
    const maxLatencyMs = finite(request.maxLatencyMs);
    const p95 = finite(health?.latencyMs?.p95);
    if (maxLatencyMs != null && p95 != null && p95 > maxLatencyMs) blockers.push({ code: 'latency-budget-exceeded', message: `Observed p95 ${p95} ms exceeds ${maxLatencyMs} ms.` });
    if (profile.taskEnvelope?.verificationRequired === true) warnings.push({ code: 'verification-required', message: 'Independent verification is required for autonomous changes.' });
    if (profile.resolution?.kind === 'provisional' || confidence < 0.6) warnings.push({ code: 'profile-uncertain', message: 'Routing relies on incomplete or inferred metadata.' });

    const weights = normalizeWeights(request.weights ?? this.defaultWeights);
    const quality = qualityFor(profile, request);
    const reliability = clamp(health?.reliability ?? (availability?.healthy === true ? 0.9 : 0.72));
    const costScore = estimatedCostUsd == null ? 0.45 : maxCostUsd != null ? clamp(1 - estimatedCostUsd / Math.max(maxCostUsd, 1e-9)) : 1 / (1 + estimatedCostUsd * 10);
    const latencyScore = p95 == null ? 0.5 : maxLatencyMs != null ? clamp(1 - p95 / Math.max(maxLatencyMs, 1)) : 1 / (1 + p95 / 2000);
    const locality = profile.deployment?.local === true ? (request.preferLocal === false ? 0.5 : 1) : request.preferLocal === true ? 0.2 : 0.7;
    const lifecycleScore = lifecycle === 'stable' ? 1 : lifecycle === 'unknown' ? 0.45 : lifecycle === 'deprecated' ? 0.2 : lifecycle === 'retired' ? 0 : 0.6;
    const components = { quality, reliability, cost: costScore, latency: latencyScore, confidence, locality, lifecycle: lifecycleScore };
    const rawScore = Object.entries(weights).reduce((sum, [key, weight]) => sum + weight * (components[key] ?? 0), 0);
    const score = blockers.length ? 0 : clamp(rawScore);
    const report = {
      schema: 'nolane.model-policy-evaluation.v1',
      modelId: profile.canonicalId,
      eligible: blockers.length === 0,
      score,
      estimatedCostUsd,
      components,
      weights,
      blockers,
      warnings,
      profileReceiptSha256: profile.receiptSha256,
      healthReceiptSha256: health?.receiptSha256 ?? null,
    };
    return deepFreeze({ ...report, receiptSha256: sha256Receipt(report) });
  }
}
