import { deepClone, deepFreeze, sha256Receipt } from './model-profile-schema.mjs';

export const MODEL_TRUTH_SCHEMAS = deepFreeze({
  bundle: 'nolane.model-truth-bundle.v1',
  base: 'nolane.model-base.v1',
  snapshot: 'nolane.model-snapshot.v1',
  deployment: 'nolane.model-deployment.v1',
  localArtifact: 'nolane.local-model-artifact.v1',
  alias: 'nolane.model-alias.v1',
  evaluation: 'nolane.model-evaluation.v1',
  observation: 'nolane.model-observation.v1',
});

function text(value, fallback = 'unknown') {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9._:/@+-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function entity(schema, id, value) {
  const base = { schema, id, ...deepClone(value) };
  return deepFreeze({ ...base, receiptSha256: sha256Receipt(base) });
}

function baseIdentity(profile) {
  const publisher = text(profile.identity?.publisher ?? profile.canonicalId?.split('/')[0]);
  const family = text(profile.identity?.family ?? profile.identity?.series ?? profile.canonicalId?.split('/').at(-1));
  return { publisher, family, id: `${publisher}/${family}` };
}

function aliasRecord(alias, canonicalId, source = 'legacy-profile') {
  return entity(MODEL_TRUTH_SCHEMAS.alias, `alias:${text(alias)}`, {
    alias: text(alias), canonicalId, effectiveAt: null, expiresAt: null,
    replacementId: null, source, scope: {},
  });
}

export function legacyProfileToTruthBundle(profile, { generatedAt = null } = {}) {
  if (!profile?.canonicalId) throw new TypeError('A normalized model profile is required');
  const canonicalId = text(profile.canonicalId);
  const base = baseIdentity(profile);
  const baseModelId = `base:${base.id}`;
  const snapshotId = `snapshot:${canonicalId}`;
  const providerFamily = text(profile.providerFamily);
  const providerModelId = text(profile.providerModelId ?? canonicalId.split('/').at(-1));
  const deploymentId = `deployment:${providerFamily}/${providerModelId}`;
  const local = profile.deployment?.local === true || Boolean(profile.architecture?.format || profile.architecture?.quantization || profile.architecture?.runtime);
  const localArtifactId = local
    ? `artifact:${canonicalId}/${text(profile.architecture?.runtime)}/${text(profile.architecture?.format)}/${text(profile.architecture?.quantization)}`
    : null;

  const baseModel = entity(MODEL_TRUTH_SCHEMAS.base, baseModelId, {
    modelOwner: profile.identity?.publisher ?? null,
    family: profile.identity?.family ?? null,
    series: profile.identity?.series ?? null,
    lineage: {
      parentModelIds: [], fineTuneOf: null, distilledFrom: [], mergedFrom: [],
      instructionTune: null, checkpointFamily: profile.identity?.family ?? null,
    },
    architecture: {
      type: profile.architecture?.type ?? null,
      totalParameters: profile.architecture?.totalParameters ?? null,
      activeParameters: profile.architecture?.activeParameters ?? null,
      parameterScale: profile.architecture?.parameterScale ?? null,
    },
    tokenization: {
      tokenizerId: profile.architecture?.tokenizerId ?? null,
      tokenizerFamily: null, vocabularySize: null, chatTemplateId: null,
      chatTemplateVersion: null, toolCallProtocol: null, reasoningTokenRepresentation: null,
    },
    nativeModalities: deepClone(profile.modalities ?? {}),
    weights: { openWeights: profile.identity?.openWeights ?? null, license: profile.identity?.license ?? null },
  });

  const snapshot = entity(MODEL_TRUTH_SCHEMAS.snapshot, snapshotId, {
    baseModelId,
    canonicalProfileId: canonicalId,
    semanticVersion: profile.identity?.version ?? null,
    snapshotDate: profile.identity?.releaseDate ?? null,
    releaseChannel: profile.lifecycle?.status === 'preview' ? 'preview' : null,
    knowledgeCutoff: profile.identity?.knowledgeCutoff ?? null,
    lifecycle: deepClone(profile.lifecycle ?? {}),
    capabilities: deepClone(profile.capabilities ?? {}),
    reasoning: deepClone(profile.reasoning ?? {}),
    quality: deepClone(profile.quality ?? {}),
    specialties: deepClone(profile.specialties ?? []),
    taskEnvelope: deepClone(profile.taskEnvelope ?? {}),
  });

  const deployment = entity(MODEL_TRUTH_SCHEMAS.deployment, deploymentId, {
    snapshotId,
    canonicalProfileId: canonicalId,
    servingProvider: profile.providerFamily ?? null,
    providerModelId: profile.providerModelId ?? null,
    region: null, accountTier: null,
    context: deepClone(profile.context ?? {}),
    modalities: deepClone(profile.modalities ?? {}),
    toolProtocol: deepClone(profile.toolCalling ?? {}),
    structuredOutput: {
      supported: profile.capabilities?.structuredOutput ?? null,
      jsonMode: null, strictSchema: profile.toolCalling?.strictSchema ?? null,
      grammarConstraints: null, streaming: null, validationSuccessRate: null,
    },
    economics: deepClone(profile.pricing ?? {}),
    serviceLimits: deepClone(profile.limits ?? {}),
    deployment: deepClone(profile.deployment ?? {}),
    safetyAndPolicy: {
      license: profile.identity?.license ?? null, dataRetention: null, trainingOnInput: null,
      zeroRetention: null, dataResidency: [], sensitiveDataSuitability: 'unknown', lastReviewedAt: null,
    },
    harnessCompatibility: deepClone(profile.harnessRecommendations ?? {}),
  });

  const localArtifact = local ? entity(MODEL_TRUTH_SCHEMAS.localArtifact, localArtifactId, {
    snapshotId,
    canonicalProfileId: canonicalId,
    format: profile.architecture?.format ?? null,
    quantization: profile.architecture?.quantization ?? null,
    runtime: profile.architecture?.runtime ?? null,
    artifactSha256: null,
    artifactSizeBytes: profile.localRequirements?.artifactSizeBytes ?? null,
    requirements: deepClone(profile.localRequirements ?? {}),
    measurements: [],
  }) : null;

  const aliases = [canonicalId, ...(profile.aliases ?? [])]
    .map((alias) => aliasRecord(alias, canonicalId))
    .sort((a, b) => a.alias.localeCompare(b.alias));

  const core = {
    schema: MODEL_TRUTH_SCHEMAS.bundle,
    generatedAt,
    canonicalProfileId: canonicalId,
    sourceProfileSchemaVersion: profile.schemaVersion ?? null,
    baseModel,
    snapshot,
    deployments: [deployment],
    localArtifacts: localArtifact ? [localArtifact] : [],
    aliases,
    provenance: deepClone(profile.provenance ?? {}),
    extensions: {
      legacyProfile: deepClone(profile),
      legacyProfileReceiptSha256: profile.receiptSha256 ?? sha256Receipt(profile),
    },
  };
  return deepFreeze({ ...core, receiptSha256: sha256Receipt(core) });
}

export function truthBundleToLegacyProfile(bundle) {
  if (bundle?.schema !== MODEL_TRUTH_SCHEMAS.bundle) throw new TypeError('Unsupported model truth bundle');
  const legacy = bundle.extensions?.legacyProfile;
  if (!legacy?.canonicalId) throw new TypeError('Model truth bundle does not contain a legacy compatibility projection');
  return deepFreeze(deepClone(legacy));
}

export function validateTruthBundle(bundle) {
  const failures = [];
  if (bundle?.schema !== MODEL_TRUTH_SCHEMAS.bundle) failures.push('bundle schema');
  if (!bundle?.canonicalProfileId) failures.push('canonicalProfileId');
  if (bundle?.baseModel?.schema !== MODEL_TRUTH_SCHEMAS.base) failures.push('base model');
  if (bundle?.snapshot?.schema !== MODEL_TRUTH_SCHEMAS.snapshot) failures.push('snapshot');
  if (!Array.isArray(bundle?.deployments) || !bundle.deployments.every((item) => item.schema === MODEL_TRUTH_SCHEMAS.deployment)) failures.push('deployments');
  if (!Array.isArray(bundle?.localArtifacts) || !bundle.localArtifacts.every((item) => item.schema === MODEL_TRUTH_SCHEMAS.localArtifact)) failures.push('local artifacts');
  if (!Array.isArray(bundle?.aliases) || !bundle.aliases.every((item) => item.schema === MODEL_TRUTH_SCHEMAS.alias)) failures.push('aliases');
  if (failures.length) throw new TypeError(`Invalid model truth bundle: ${failures.join(', ')}`);
  const withoutReceipt = deepClone(bundle); delete withoutReceipt.receiptSha256;
  if (bundle.receiptSha256 !== sha256Receipt(withoutReceipt)) throw new TypeError('Model truth bundle receipt mismatch');
  return true;
}
