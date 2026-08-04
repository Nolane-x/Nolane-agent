import { deepFreeze, sha256Receipt } from '../model-profiles/model-profile-schema.mjs';
import { ModelHealthLedger } from './model-health-ledger.mjs';
import { ModelPolicyEngine } from './model-policy-engine.mjs';
import { createModelProfileDossier } from './model-profile-dossier.mjs';

function availabilityMap(items = []) {
  return new Map(items.map((item) => [String(item.id ?? item.providerFamily ?? '').toLowerCase(), item]));
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => { const value = key(item); if (seen.has(value)) return false; seen.add(value); return true; });
}

export class ModelManagementService {
  constructor({ registry, truthPlane = null, healthLedger = new ModelHealthLedger(), policyEngine = new ModelPolicyEngine(), providerInventory = () => [], clock = () => new Date().toISOString() } = {}) {
    if (!registry?.resolve || !registry?.list || !registry?.exportCatalog) throw new TypeError('Advanced model profile registry is required');
    this.registry = registry;
    this.truthPlane = truthPlane;
    this.healthLedger = healthLedger;
    this.policyEngine = policyEngine;
    this.providerInventory = providerInventory;
    this.clock = clock;
    for (const observation of this.truthPlane?.runtimeObservations?.() ?? []) {
      this.healthLedger.record(observation.modelId, {
        at: observation.observedAt,
        success: observation.success,
        latencyMs: observation.latencyMs,
        inputTokens: observation.inputTokens,
        outputTokens: observation.outputTokens,
        costUsd: observation.costUsd,
        toolSuccess: observation.toolSuccess,
        errorCode: observation.errorCode,
        metadata: observation.scope,
      });
    }
  }

  resolve(input) { return this.registry.resolve(input); }

  listProfiles(options = {}) { return deepFreeze(this.registry.list(options)); }

  recordExecution(modelId, observation) {
    const profile = this.registry.resolve(modelId);
    const health = this.healthLedger.record(profile.canonicalId, observation);
    this.truthPlane?.recordRuntimeObservation?.(profile.canonicalId, observation);
    return health;
  }

  recommend({ candidateIds = null, request = {}, limit = 12 } = {}) {
    const ids = candidateIds?.length ? candidateIds.map(String) : this.registry.list().map((profile) => profile.canonicalId);
    const availability = availabilityMap(this.providerInventory() ?? []);
    const evaluations = uniqueBy(ids, (id) => id.toLowerCase()).map((id) => {
      const profile = this.registry.resolve(id);
      const health = this.healthLedger.get(profile.canonicalId);
      const providerState = availability.get(String(profile.providerFamily ?? '').toLowerCase()) ?? null;
      const evaluation = this.policyEngine.evaluate(profile, { health, availability: providerState, request });
      return { profile, health, availability: providerState, evaluation };
    }).sort((a, b) => b.evaluation.score - a.evaluation.score || a.profile.canonicalId.localeCompare(b.profile.canonicalId));
    const eligible = evaluations.filter((item) => item.evaluation.eligible);
    const selected = eligible[0] ?? null;
    const fallbacks = uniqueBy(eligible.slice(1), (item) => `${item.profile.providerFamily}:${item.profile.identity?.family ?? item.profile.canonicalId}`).slice(0, 4);
    const base = {
      schema: 'nolane.model-recommendation.v1',
      generatedAt: this.clock(),
      request,
      selected: selected ? { modelId: selected.profile.canonicalId, score: selected.evaluation.score, evaluationReceiptSha256: selected.evaluation.receiptSha256 } : null,
      fallbacks: fallbacks.map((item) => ({ modelId: item.profile.canonicalId, score: item.evaluation.score, providerFamily: item.profile.providerFamily, evaluationReceiptSha256: item.evaluation.receiptSha256 })),
      candidates: evaluations.slice(0, Math.max(1, Math.min(100, Number(limit) || 12))).map((item) => ({
        modelId: item.profile.canonicalId,
        displayName: item.profile.identity?.displayName,
        providerFamily: item.profile.providerFamily,
        lifecycle: item.profile.lifecycle?.status,
        score: item.evaluation.score,
        eligible: item.evaluation.eligible,
        blockers: item.evaluation.blockers,
        warnings: item.evaluation.warnings,
        estimatedCostUsd: item.evaluation.estimatedCostUsd,
        components: item.evaluation.components,
        profileReceiptSha256: item.profile.receiptSha256,
        healthReceiptSha256: item.health.receiptSha256,
        evaluationReceiptSha256: item.evaluation.receiptSha256,
      })),
    };
    return deepFreeze({ ...base, receiptSha256: sha256Receipt(base) });
  }

  select(input = {}) {
    const recommendation = this.recommend(input);
    if (!recommendation.selected) {
      const error = new Error('No eligible model satisfies the policy');
      error.code = 'no_eligible_model';
      error.recommendation = recommendation;
      throw error;
    }
    return recommendation;
  }

  createPortfolio({ candidateIds = null, baseRequest = {}, roles = null } = {}) {
    const requestedRoles = roles ?? {
      primary: { taskClass: 'large', requiredCapabilities: ['coding', 'toolCalling', 'structuredOutput'], weights: { quality: 0.48, reliability: 0.25, cost: 0.08, latency: 0.07 } },
      fast: { taskClass: 'small', requiredCapabilities: ['coding'], maxLatencyMs: 5_000, weights: { latency: 0.32, cost: 0.25, quality: 0.2 } },
      verifier: { taskClass: 'large', requiredCapabilities: ['reasoning', 'structuredOutput'], weights: { reliability: 0.35, quality: 0.35, confidence: 0.15 } },
      local: { taskClass: 'medium', requiredCapabilities: ['coding'], localOnly: true, weights: { locality: 0.35, cost: 0.25, reliability: 0.2 } },
    };
    const assignments = {};
    const used = new Set();
    for (const [role, roleRequest] of Object.entries(requestedRoles)) {
      const result = this.recommend({ candidateIds, request: { ...baseRequest, ...roleRequest }, limit: 40 });
      const chosen = result.candidates.find((item) => item.eligible && !used.has(item.modelId)) ?? result.candidates.find((item) => item.eligible) ?? null;
      if (chosen) used.add(chosen.modelId);
      assignments[role] = { selected: chosen, recommendationReceiptSha256: result.receiptSha256 };
    }
    const base = { schema: 'nolane.model-portfolio.v1', generatedAt: this.clock(), baseRequest, assignments };
    return deepFreeze({ ...base, receiptSha256: sha256Receipt(base) });
  }

  dossier(modelId, { request = null } = {}) {
    const profile = this.registry.resolve(modelId);
    const health = this.healthLedger.get(profile.canonicalId);
    const policyEvaluations = request ? [this.policyEngine.evaluate(profile, { health, request })] : [];
    const dossier = createModelProfileDossier(profile, { health, policyEvaluations, generatedAt: this.clock() });
    if (!this.truthPlane) return dossier;
    const truth = this.truthPlane.entities(profile.canonicalId);
    const base = { ...dossier, truth: { bundle: truth.bundle, facts: truth.facts, evaluations: truth.evaluations, runtimeObservations: truth.runtimeObservations }, legacyDossierReceiptSha256: dossier.receiptSha256 };
    delete base.receiptSha256;
    return deepFreeze({ ...base, receiptSha256: sha256Receipt(base) });
  }

  truthSnapshot() {
    if (!this.truthPlane) throw Object.assign(new Error('Model truth plane is not configured'), { statusCode: 503, code: 'model_truth_unavailable' });
    return this.truthPlane.snapshot();
  }

  truthEntities(modelId) {
    if (!this.truthPlane) throw Object.assign(new Error('Model truth plane is not configured'), { statusCode: 503, code: 'model_truth_unavailable' });
    return this.truthPlane.entities(modelId);
  }

  truthFacts(modelId, options = {}) {
    if (!this.truthPlane) throw Object.assign(new Error('Model truth plane is not configured'), { statusCode: 503, code: 'model_truth_unavailable' });
    return this.truthPlane.facts(modelId, options);
  }

  recordFact(input) {
    if (!this.truthPlane) throw Object.assign(new Error('Model truth plane is not configured'), { statusCode: 503, code: 'model_truth_unavailable' });
    return this.truthPlane.recordFact(input);
  }

  recordEvaluation(input) {
    if (!this.truthPlane) throw Object.assign(new Error('Model truth plane is not configured'), { statusCode: 503, code: 'model_truth_unavailable' });
    const profile = this.registry.resolve(input?.modelId);
    const truth = this.truthPlane.entities(profile.canonicalId);
    return this.truthPlane.recordEvaluation({
      ...input,
      modelId: profile.canonicalId,
      baseModelId: input?.baseModelId ?? truth.bundle.baseModel.id,
      snapshotId: input?.snapshotId ?? truth.bundle.snapshot.id,
      deploymentId: input?.deploymentId ?? truth.bundle.deployments[0]?.id ?? null,
      localArtifactId: input?.localArtifactId ?? truth.bundle.localArtifacts[0]?.id ?? null,
    });
  }

  compare(input = {}) {
    if (!this.truthPlane) throw Object.assign(new Error('Model truth plane is not configured'), { statusCode: 503, code: 'model_truth_unavailable' });
    const ids = input.modelIds ?? input.candidateIds ?? [];
    return this.truthPlane.compare(ids, { request: input.request ?? {}, evaluator: (profile, request) => this.policyEngine.evaluate(profile, { health: this.healthLedger.get(profile.canonicalId), availability: availabilityMap(this.providerInventory() ?? []).get(String(profile.providerFamily ?? '').toLowerCase()) ?? null, request }) });
  }

  explain(input = {}) {
    const recommendation = this.recommend(input);
    const candidates = recommendation.candidates.map((candidate) => ({
      modelId: candidate.modelId, selected: recommendation.selected?.modelId === candidate.modelId, eligible: candidate.eligible, score: candidate.score, blockers: candidate.blockers, warnings: candidate.warnings, estimatedCostUsd: candidate.estimatedCostUsd, components: candidate.components, facts: this.truthPlane?.summaryFor?.(candidate.modelId)?.facts ?? null, evaluationReceiptSha256: candidate.evaluationReceiptSha256, profileReceiptSha256: candidate.profileReceiptSha256,
    }));
    const base = { schema: 'nolane.model-routing-explanation.v1', generatedAt: this.clock(), request: input.request ?? {}, selected: recommendation.selected, fallbacks: recommendation.fallbacks, candidates, recommendationReceiptSha256: recommendation.receiptSha256 };
    return deepFreeze({ ...base, receiptSha256: sha256Receipt(base) });
  }

  snapshot() {
    const catalog = this.registry.exportCatalog();
    const health = this.healthLedger.export();
    const base = {
      schema: 'nolane.model-management-snapshot.v1',
      generatedAt: this.clock(),
      summary: {
        exactProfiles: catalog.profiles.length,
        familyAndSizeTemplates: catalog.families.length,
        discoveryRecords: catalog.discoveryRecords.length,
        healthRecords: health.models.length,
        providers: new Set(catalog.profiles.map((profile) => profile.providerFamily).filter(Boolean)).size,
        localProfiles: catalog.profiles.filter((profile) => profile.deployment?.local === true).length,
        deprecatedOrRetired: catalog.profiles.filter((profile) => ['deprecated', 'retired'].includes(profile.lifecycle?.status)).length,
      },
      catalogReceiptSha256: catalog.receiptSha256,
      healthReceiptSha256: health.receiptSha256,
      truth: this.truthPlane?.snapshot?.() ?? null,
    };
    return deepFreeze({ ...base, receiptSha256: sha256Receipt(base) });
  }
}
