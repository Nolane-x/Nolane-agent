import { inferModelIdentity } from './model-identity-inference.mjs';
import { GENERIC_SIZE_TEMPLATES, MODEL_FAMILY_TEMPLATES, matchFamilyTemplate, matchSizeTemplate } from './model-family-catalog.mjs';
import { deepClone, deepFreeze, mergeDefined, normalizeModelProfile, sha256Receipt } from './model-profile-schema.mjs';

function memoryEstimate(totalParameters, quantization = 'fp16') {
  if (!Number.isFinite(totalParameters) || totalParameters <= 0) {
    return { estimatedRamGB: null, estimatedVramGB: null, estimateBasis: null };
  }
  const q = String(quantization ?? 'fp16').toLowerCase();
  let bits = 16;
  if (/q2|int2|2bit/.test(q)) bits = 2.5;
  else if (/q3|int3|3bit/.test(q)) bits = 3.5;
  else if (/q4|int4|4bit|awq|gptq|nf4/.test(q)) bits = 4.5;
  else if (/q5|5bit/.test(q)) bits = 5.5;
  else if (/q6|6bit/.test(q)) bits = 6.5;
  else if (/q8|int8|8bit|fp8/.test(q)) bits = 8.5;
  else if (/fp32/.test(q)) bits = 32;
  const weights = totalParameters * bits / 8 / 1e9;
  const ram = Math.round((weights * 1.18 + 1.2) * 10) / 10;
  return { estimatedRamGB: ram, estimatedVramGB: ram, estimateBasis: `parameter-count:${bits}bit-plus-18pct-overhead` };
}

function providerFromId(id, requested) {
  if (requested) return requested;
  const publisher = id.split('/')[0];
  return {
    openai: 'openai-api', anthropic: 'anthropic-api', google: 'google-api', deepseek: 'deepseek-api',
    moonshotai: 'moonshot-api', qwen: 'alibaba-api', mistralai: 'mistral-api', cohere: 'cohere-api',
    minimax: 'minimax-api', 'x-ai': 'xai-api', amazon: 'bedrock-api', writer: 'writer-api',
  }[publisher] ?? 'generic-local';
}

function isLocalDeployment(providerFamily, inferred, deployment) {
  if (typeof deployment?.local === 'boolean') return deployment.local;
  if (providerFamily === 'generic-local' || providerFamily === 'ollama' || providerFamily === 'lm-studio') return true;
  if (inferred.format || inferred.runtime || inferred.quantization) return true;
  return false;
}

function warning(code, message, severity = 'warning') {
  return { code, message, severity };
}

function addWarnings(profile) {
  const warnings = [...(profile.warnings ?? [])];
  if (profile.lifecycle?.status === 'deprecated' || profile.lifecycle?.status === 'retired') {
    warnings.push(warning('model-deprecated', `Model is ${profile.lifecycle.status}${profile.lifecycle.replacement ? `; use ${profile.lifecycle.replacement}` : ''}.`));
  }
  if (profile.architecture?.quantization) {
    warnings.push(warning('quantization-capability-variance', 'Quantization can change quality, tool reliability, context capacity, and runtime behavior.', 'info'));
  }
  if (profile.resolution?.kind === 'provisional') {
    warnings.push(warning('unverified-model', 'This model was not found in an exact or imported catalog; unknown fields remain null.'));
  }
  return [...new Map(warnings.map((item) => [item.code, item])).values()];
}

function mergeOperationalDiscovery(profile, discovered) {
  if (!discovered) return profile;
  // Preserve canonical identity and curated lifecycle; accept live operational limits/capabilities.
  const allowed = {
    providerModelId: discovered.providerModelId,
    context: discovered.context,
    modalities: discovered.modalities,
    capabilities: discovered.capabilities,
    toolCalling: discovered.toolCalling,
    reasoning: discovered.reasoning,
    pricing: discovered.pricing,
    limits: discovered.limits,
    deployment: discovered.deployment,
    localRequirements: discovered.localRequirements,
  };
  const merged = mergeDefined(profile, allowed);
  merged.provenance = mergeDefined(profile.provenance, {
    observedAt: discovered.source?.observedAt ?? discovered.observedAt ?? profile.provenance.observedAt,
    sources: [...(profile.provenance.sources ?? []), discovered.source ?? { type: 'discovery', observedAt: discovered.observedAt ?? null }],
    confidence: {
      overall: Math.max(profile.provenance.confidence.overall ?? 0, 0.82),
      limits: Math.max(profile.provenance.confidence.limits ?? 0, discovered.context ? 0.9 : 0),
      capabilities: Math.max(profile.provenance.confidence.capabilities ?? 0, discovered.capabilities || discovered.toolCalling ? 0.85 : 0),
    },
  });
  return merged;
}

export class ModelProfileRegistry {
  #profiles = new Map();
  #aliases = new Map();
  #discovered = new Map();
  #clock;

  constructor({ profiles = [], clock = () => new Date().toISOString() } = {}) {
    this.#clock = clock;
    for (const profile of profiles) this.register(profile);
  }

  register(profile) {
    const normalized = normalizeModelProfile(profile);
    this.#profiles.set(normalized.canonicalId, normalized);
    this.#aliases.set(normalized.canonicalId, normalized.canonicalId);
    for (const alias of normalized.aliases) this.#aliases.set(alias.toLowerCase(), normalized.canonicalId);
    return normalized;
  }

  registerDiscovered(record) {
    if (!record?.id) throw new TypeError('Discovered model record requires id');
    const key = String(record.id).toLowerCase();
    const normalized = deepClone(record);
    normalized.id = key;
    normalized.observedAt ??= normalized.source?.observedAt ?? this.#clock();
    this.#discovered.set(key, normalized);
    if (normalized.providerModelId) this.#discovered.set(String(normalized.providerModelId).toLowerCase(), normalized);
    return deepFreeze(deepClone(normalized));
  }

  importCatalog(records, { source = { type: 'catalog-import', observedAt: this.#clock() } } = {}) {
    const accepted = [];
    const rejected = [];
    for (const [index, record] of (records ?? []).entries()) {
      try {
        accepted.push(this.registerDiscovered({ ...record, source: record.source ?? source }));
      } catch (error) {
        rejected.push({ index, error: error.message });
      }
    }
    return deepFreeze({ accepted, rejected });
  }

  list({ providerFamily = null, publisher = null, capability = null, lifecycle = null } = {}) {
    return [...this.#profiles.values()].filter((profile) => {
      if (providerFamily && profile.providerFamily !== providerFamily) return false;
      if (publisher && profile.identity.publisher !== publisher) return false;
      if (capability && profile.capabilities[capability] !== true) return false;
      if (lifecycle && profile.lifecycle.status !== lifecycle) return false;
      return true;
    });
  }

  resolve(input) {
    const request = typeof input === 'string' ? { id: input } : input ?? {};
    if (!request.id) throw new TypeError('Model resolution requires id');
    const rawId = String(request.id);
    const normalizedId = rawId.toLowerCase();
    const inferred = inferModelIdentity(rawId);
    const exactCanonical = this.#aliases.get(normalizedId);
    const exact = exactCanonical ? this.#profiles.get(exactCanonical) : null;
    const discovered = this.#discovered.get(normalizedId) ?? (exact ? this.#discovered.get(exact.canonicalId) : null);

    if (exact) {
      let profile = deepClone(exact);
      profile.resolution = { kind: normalizedId === exact.canonicalId ? 'exact' : 'alias', matchedBy: normalizedId };
      profile = mergeOperationalDiscovery(profile, discovered);
      profile = this.#applyDeployment(profile, inferred, request.deployment, request.providerFamily);
      profile.warnings = addWarnings(profile);
      return normalizeModelProfile(profile);
    }

    const family = matchFamilyTemplate(normalizedId);
    const size = matchSizeTemplate(inferred.parameterCount);
    const providerFamily = providerFromId(normalizedId, request.providerFamily ?? discovered?.providerFamily);
    const local = isLocalDeployment(providerFamily, inferred, request.deployment);
    const isKnownByInference = Boolean(family || size || inferred.codingSpecialized || inferred.reasoningSpecialized || discovered);
    let profile = {
      canonicalId: normalizedId,
      aliases: [],
      providerFamily,
      providerModelId: discovered?.providerModelId ?? normalizedId.split('/').at(-1),
      identity: {
        publisher: inferred.publisher, family: inferred.family ?? family?.id ?? null, series: inferred.series,
        displayName: rawId.split('/').at(-1), openWeights: local ? true : null,
      },
      architecture: {
        type: inferred.architectureType, totalParameters: inferred.parameterCount,
        activeParameters: inferred.activeParameterCount, parameterScale: inferred.parameterScale,
        format: inferred.format, quantization: inferred.quantization, runtime: inferred.runtime,
      },
      capabilities: {
        coding: inferred.codingSpecialized ? true : null,
        reasoning: inferred.reasoningSpecialized ? true : null,
      },
      deployment: { local, remote: !local, selfHostable: local ? true : null, endpointType: local ? 'local-runtime' : 'provider-api' },
      localRequirements: local ? memoryEstimate(inferred.parameterCount, inferred.quantization ?? request.deployment?.quantization) : {},
      provenance: {
        sources: [{ type: 'identity-inference', observedAt: this.#clock() }],
        observedAt: this.#clock(), verifiedAt: null,
        confidence: {
          overall: isKnownByInference ? 0.58 : 0.28,
          identity: inferred.parameterCount || inferred.family ? 0.72 : 0.35,
          capabilities: family ? 0.62 : inferred.codingSpecialized || inferred.reasoningSpecialized ? 0.5 : 0.2,
          limits: 0.05, pricing: 0,
        },
      },
      resolution: { kind: isKnownByInference ? 'inferred' : 'provisional', matchedBy: family?.id ?? size?.id ?? null },
    };
    if (family) profile = mergeDefined(profile, family.defaults);
    if (size) profile = mergeDefined(profile, { quality: size.quality, taskEnvelope: size.taskEnvelope });
    profile = mergeOperationalDiscovery(profile, discovered);
    profile = this.#applyDeployment(profile, inferred, request.deployment, request.providerFamily);
    profile.warnings = addWarnings(profile);
    return normalizeModelProfile(profile);
  }

  #applyDeployment(profile, inferred, deployment = {}, requestedProviderFamily = null) {
    const output = deepClone(profile);
    if (requestedProviderFamily) output.providerFamily = requestedProviderFamily;
    const quantization = deployment?.quantization ?? inferred.quantization ?? output.architecture.quantization;
    const format = deployment?.format ?? inferred.format ?? output.architecture.format;
    const runtime = deployment?.runtime ?? inferred.runtime ?? output.architecture.runtime;
    output.architecture = mergeDefined(output.architecture, { quantization, format, runtime });
    const local = isLocalDeployment(output.providerFamily, { ...inferred, quantization, format, runtime }, deployment);
    output.deployment = mergeDefined(output.deployment, {
      ...deployment,
      local,
      remote: deployment?.remote ?? !local,
      selfHostable: deployment?.selfHostable ?? (local ? true : output.deployment.selfHostable),
    });
    if (local && output.architecture.totalParameters) {
      output.localRequirements = mergeDefined(output.localRequirements, memoryEstimate(output.architecture.totalParameters, quantization));
    }
    return output;
  }

  compatibility({ id, providerFamily = null, deployment = {}, requirements = {} }) {
    const profile = this.resolve({ id, providerFamily, deployment });
    const blockers = [];
    const warnings = [];
    const requireTrue = (field, actual, label) => {
      if (field !== true) return;
      if (actual !== true) blockers.push({ code: `missing-${label}`, message: `${label} is required but not verified as supported.` });
    };
    requireTrue(requirements.toolCalling, profile.toolCalling.supported, 'tool-calling');
    requireTrue(requirements.structuredOutput, profile.capabilities.structuredOutput, 'structured-output');
    requireTrue(requirements.vision, profile.modalities.input.image, 'vision');
    if (Number.isFinite(requirements.minContextWindow) && (!Number.isFinite(profile.context.contextWindow) || profile.context.contextWindow < requirements.minContextWindow)) {
      blockers.push({ code: 'context-too-small-or-unknown', message: `Required context ${requirements.minContextWindow}; available ${profile.context.contextWindow ?? 'unknown'}.` });
    }
    if (Number.isFinite(requirements.maxRamGB) && Number.isFinite(profile.localRequirements.estimatedRamGB) && profile.localRequirements.estimatedRamGB > requirements.maxRamGB) {
      blockers.push({ code: 'ram-budget-exceeded', message: `Estimated RAM ${profile.localRequirements.estimatedRamGB} GB exceeds ${requirements.maxRamGB} GB.` });
    }
    if (profile.provenance.confidence.overall < 0.6) warnings.push({ code: 'low-confidence-profile', message: 'Compatibility relies on inferred or incomplete metadata.' });
    const report = { id: profile.canonicalId, compatible: blockers.length === 0, blockers, warnings, profileReceiptSha256: profile.receiptSha256 };
    return deepFreeze({ ...report, receiptSha256: sha256Receipt(report) });
  }

  exportCatalog() {
    const payload = {
      schemaVersion: '1.0.0',
      generatedAt: this.#clock(),
      profiles: [...this.#profiles.values()].map((profile) => deepClone(profile)).sort((a, b) => a.canonicalId.localeCompare(b.canonicalId)),
      families: [
        ...MODEL_FAMILY_TEMPLATES.map((entry) => ({ id: entry.id, type: 'family' })),
        ...GENERIC_SIZE_TEMPLATES.map((entry) => ({ id: entry.id, type: 'size', maxParameters: Number.isFinite(entry.max) ? entry.max : null })),
      ].sort((a, b) => a.id.localeCompare(b.id)),
      discoveryRecords: [...new Set([...this.#discovered.values()])].map((record) => deepClone(record)).sort((a, b) => a.id.localeCompare(b.id)),
    };
    return deepFreeze({ ...payload, receiptSha256: sha256Receipt(payload) });
  }
}
